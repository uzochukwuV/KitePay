require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bitnobService = require('./services/bitnob.service');
const kiteService = require('./services/kite.service');

const { x402Required } = require('./middleware/x402.middleware');

const app = express();
app.use(cors());

// Temporary in-memory DB for Hackathon
const DB = {
  orders: {}, // id -> { type, amount, status, userKiteWallet, etc. }
  orderHashes: {}, // keccak256(orderId) -> original orderId (UUID)
  processedWebhooks: new Map() // eventId -> status ('in_progress' or 'settled')
};

function verifySignature(payload, signature, secret) {
  const payloadString = typeof payload === 'string' ? payload : payload.toString();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// Background processor to keep webhooks fast
async function processWebhookEventInBackground(event, idempotencyKey) {
  try {
    // If event comes as { event: "...", data: { reference, ... } } or { event: "...", reference: "..." }
    const orderId = event.data?.reference || event.reference;
    if (!orderId) return;

    const order = DB.orders[orderId];

    if (!order) {
      console.log(`[PROCESSOR] Order ${orderId} not found in DB.`);
      return;
    }

    if (order.status === 'settled') {
      console.log(`[PROCESSOR] Order ${orderId} already settled.`);
      return;
    }

    // Settle Onramp
    if (order.type === 'onramp') {
       console.log(`[PROCESSOR] Settling Onramp to ${order.kiteWallet}...`);
       await kiteService.settleOnramp(
           orderId, 
           order.kiteWallet, 
           order.usdcAmount, 
           order.ngnAmount
       );
       order.status = 'settled';
    }
    
    // Settle Checkout
    if (order.type === 'checkout') {
       console.log(`[PROCESSOR] Settling Checkout to Merchant ${order.merchantKiteWallet}...`);
       await kiteService.settleCheckout(
           orderId,
           order.merchantKiteWallet,
           order.usdcAmount,
           order.ngnAmount
       );
       order.status = 'settled';
    }

    // CRITICAL: Only mark as settled AFTER successful on-chain transaction.
    // If settlement fails, it will throw and skip this.
    DB.processedWebhooks.set(idempotencyKey, 'settled');
  } catch (err) {
    console.error(`[PROCESSOR] Failed to process event for ${event.data?.reference || event.reference}:`, err.message);
    // Remove from in_progress so it can be retried later
    DB.processedWebhooks.delete(idempotencyKey);
  }
}

// Webhook endpoint needs raw body to verify signature
app.post('/api/webhooks/bitnob', express.raw({ type: '*/*' }), (req, res) => {
  try {
    const signature = req.headers['x-bitnob-signature'];
    const secret = process.env.BITNOB_WEBHOOK_SECRET;

    if (!secret) {
        console.warn("[WEBHOOK] Missing BITNOB_WEBHOOK_SECRET");
        return res.status(500).json({ error: "Missing config" });
    }

    if (!signature || !verifySignature(req.body, signature, secret)) {
      console.warn("[WEBHOOK] Invalid signature");
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());
    const reference = event.data?.reference || event.reference;
    
    console.log("[WEBHOOK] Received:", {
      event: event.event,
      reference: reference,
      timestamp: new Date().toISOString()
    });

    // Idempotency check: prevent duplicate processing (Race Condition fix)
    const idempotencyKey = `${event.event}-${reference}`;
    if (DB.processedWebhooks.has(idempotencyKey)) {
        console.log(`[WEBHOOK] Idempotency hit. Already ${DB.processedWebhooks.get(idempotencyKey)}: ${idempotencyKey}`);
        return res.status(200).send('already handled');
    }
    
    // Mark as in_progress to prevent race conditions if Bitnob retries rapidly
    DB.processedWebhooks.set(idempotencyKey, 'in_progress');

    // If it's a relevant payment/transfer event
    if (
        event.event === 'payment.received' || 
        event.event === 'payout.completed' ||
        event.event === 'transfer.success'
    ) {
      // Fire and forget (Background Processing) -> Allows immediate 200 OK
      processWebhookEventInBackground(event, idempotencyKey);
    }

    // Fast 200 OK to prevent retries
    res.status(200).send('ok');
  } catch (error) {
    console.error("[WEBHOOK] Error parsing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Regular JSON parsing for other routes
app.use(express.json());

// API: Start an Onramp (NGN -> USDC)
app.post('/api/onramp/initiate', async (req, res) => {
  try {
    const { kiteWallet, ngnAmount } = req.body;
    
    // 1. Get Rate
    const rate = await bitnobService.getRate(ngnAmount);
    const usdcAmount = rate.usdcPerNgn * ngnAmount;

    // 2. Generate Order
    const orderId = uuidv4();
    DB.orders[orderId] = {
      type: 'onramp',
      kiteWallet,
      ngnAmount,
      usdcAmount: usdcAmount.toFixed(2), // store 2 decimal representation
      status: 'pending'
    };

    // 3. Return Bitnob payment details (In reality you'd call Bitnob to generate a virtual account here)
    // For Sandbox we return a dummy bank transfer instruction
    res.json({
      orderId,
      usdcEstimate: usdcAmount.toFixed(2),
      instructions: {
        bankName: "Sandbox Bank",
        accountNumber: "0123456789",
        accountName: "SwiftCheckout Onramp",
        amount: ngnAmount,
        reference: orderId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: x402 Agentic Checkout
// Any AI Agent with a Kite Passport can discover this endpoint and pay it autonomously
app.post(
  '/api/checkout/x402',
  x402Required({
    amount: '1000000', // Example: 1 USDC (6 decimals)
    description: 'SwiftCheckout AI Agent Payment',
    merchantName: 'SwiftCheckout Protocol',
  }),
  async (req, res) => {
    try {
      const { merchantId, usdcAmount } = req.body;
      const orderId = req.paymentData.nonce;

      // In a real app we would link merchantId to their Kite wallet address from DB
      // We will mock this to a random generated wallet instead of address(0) to prevent on-chain reverts
      const dummyMerchantWallet = "0x1111111111111111111111111111111111111111";

      // The payment has already been verified and settled by the x402 middleware.
      // We just need to trigger the vault to release funds to the merchant.
      const txHash = await kiteService.settleCheckout(
        orderId, 
        dummyMerchantWallet, 
        usdcAmount || "1", 
        0 // ngnAmount is 0 since this is a pure USDC payment
      );

      res.json({ orderId, txHash, status: 'settled' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// API: Start an Offramp (USDC -> NGN)
app.post('/api/offramp/initiate', async (req, res) => {
  try {
    const { usdcAmount, bankAccountNumber, bankName, accountName } = req.body;
    
    // 1. Get Rate
    const rate = await bitnobService.getRate();
    const ngnEstimate = rate.ngnPerUsdc * usdcAmount;

    // 2. Generate Order
    const orderId = uuidv4();
    const orderHash = require('ethers').ethers.id(orderId);
    DB.orderHashes[orderHash] = orderId;

    DB.orders[orderId] = {
      type: 'offramp',
      usdcAmount,
      ngnAmount: ngnEstimate.toFixed(0),
      bankDetails: {
        accountNumber: bankAccountNumber,
        bankName,
        accountName
      },
      status: 'pending'
    };

    // 3. Return details to user so they can trigger the smart contract
    res.json({
      orderId,
      vaultAddress: process.env.VAULT_ADDRESS,
      usdcAmount,
      ngnEstimate: ngnEstimate.toFixed(0),
      instructions: "Call initiateOfframp(orderId, usdcAmount) on the SwiftVault contract to complete this transaction."
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Standard POS Checkout (Customer pays NGN to Merchant)
app.post('/api/checkout/initiate', async (req, res) => {
  try {
    const { merchantKiteWallet, ngnAmount } = req.body;

    const rate = await bitnobService.getRate(ngnAmount);
    const usdcAmount = rate.usdcPerNgn * ngnAmount;

    const orderId = uuidv4();
    DB.orders[orderId] = {
      type: 'checkout',
      merchantKiteWallet,
      ngnAmount,
      usdcAmount: usdcAmount.toFixed(2),
      status: 'pending'
    };

    // Return Bitnob virtual account instructions for the customer to pay NGN into
    res.json({
      orderId,
      usdcEstimate: usdcAmount.toFixed(2),
      instructions: {
        bankName: "Sandbox Bank",
        accountNumber: "0987654321",
        accountName: "SwiftCheckout Merchant",
        amount: ngnAmount,
        reference: orderId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Vault Stats
app.get('/api/vault/stats', async (req, res) => {
  try {
    // In reality you would query the contract here, but we will mock it if ethers is not initialized
    res.json({
      tvl: "10000.00",
      liquidBalance: "2000.00",
      yieldBalance: "8000.00",
      status: "active"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Register Merchant (Admin)
app.post('/api/merchant/register', async (req, res) => {
  try {
    const { merchantWallet } = req.body;
    // Call vault.registerMerchant(merchantWallet) via kiteService
    // For now we just return success
    res.json({ success: true, message: `Merchant ${merchantWallet} registered on-chain.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[SERVER] SwiftCheckout backend listening on port ${PORT}`);

  // Start background cron job for yield (defaults to every hour)
  const yieldInterval = parseInt(process.env.YIELD_CHECK_INTERVAL_MS) || 3600000;
  setInterval(async () => {
    try {
      console.log('[CRON] Running yield cycle...');
      await kiteService.deployToYield();
    } catch (err) {
      console.error('[CRON] Yield cycle failed:', err.message);
    }
  }, yieldInterval);

  // Start listening to the Kite blockchain for user offramp requests
  try {
    kiteService.listenForOfframps(async (offrampData) => {
      console.log('[KITE] Detected offramp on-chain:', offrampData);
      
      const originalOrderId = DB.orderHashes[offrampData.orderId];
      if (!originalOrderId) {
        console.error(`[KITE] Unrecognized offramp hash: ${offrampData.orderId}`);
        return;
      }

      const order = DB.orders[originalOrderId];
      if (!order || order.type !== 'offramp') {
        console.error(`[KITE] Invalid order data for: ${originalOrderId}`);
        return;
      }

      if (order.status === 'settled') {
        console.log(`[KITE] Offramp ${originalOrderId} already paid out.`);
        return;
      }

      try {
        console.log(`[BITNOB] Triggering fiat payout for offramp ${originalOrderId}...`);
        await bitnobService.payoutNGN({
          reference: originalOrderId,
          recipientName: order.bankDetails.accountName,
          accountNumber: order.bankDetails.accountNumber,
          bankName: order.bankDetails.bankName,
          ngnAmount: order.ngnAmount
        });
        
        order.status = 'settled';
        console.log(`[BITNOB] Payout successful for ${originalOrderId}.`);
      } catch (payoutError) {
        console.error(`[BITNOB] Payout failed for ${originalOrderId}:`, payoutError.message);
      }
    });
  } catch (err) {
    console.error('[SERVER] Failed to start blockchain listener:', err.message);
  }
});
