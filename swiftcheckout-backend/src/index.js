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

// Validation helpers
function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateAmount(amount, fieldName, min = 0.01, max = 1000000) {
  const num = parseFloat(amount);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`${fieldName} must be a number between ${min} and ${max}`);
  }
  return num;
}

// Temporary in-memory DB for Hackathon
const DB = {
  orders: {}, // id -> { type, amount, status, userKiteWallet, etc. }
  orderHashes: {}, // keccak256(orderId) -> original orderId (UUID)
  processedWebhooks: new Map() // eventId -> status ('in_progress' or 'settled')
};

// Retry queue for failed offramp payouts
const payoutRetryQueue = new Map(); // orderId -> { order, attempts, lastAttempt }
const MAX_PAYOUT_RETRIES = 5;
const PAYOUT_RETRY_DELAY_MS = 60000; // 1 minute between retries

async function retryFailedPayouts() {
  const now = Date.now();
  
  for (const [orderId, retryData] of payoutRetryQueue.entries()) {
    // Skip if we haven't waited long enough since last attempt
    if (now - retryData.lastAttempt < PAYOUT_RETRY_DELAY_MS) {
      continue;
    }

    // Skip if max retries exceeded
    if (retryData.attempts >= MAX_PAYOUT_RETRIES) {
      console.error(`[PAYOUT] Max retries (${MAX_PAYOUT_RETRIES}) exceeded for offramp ${orderId}. Manual intervention required.`);
      payoutRetryQueue.delete(orderId);
      continue;
    }

    retryData.attempts++;
    retryData.lastAttempt = now;

    try {
      console.log(`[PAYOUT] Retry attempt ${retryData.attempts}/${MAX_PAYOUT_RETRIES} for offramp ${orderId}...`);
      
      await bitnobService.payoutNGN({
        reference: orderId,
        recipientName: retryData.order.bankDetails.accountName,
        accountNumber: retryData.order.bankDetails.accountNumber,
        bankName: retryData.order.bankDetails.bankName,
        ngnAmount: retryData.order.ngnAmount
      });

      // Success - mark order as settled and remove from queue
      retryData.order.status = 'settled';
      payoutRetryQueue.delete(orderId);
      console.log(`[PAYOUT] Retry successful for offramp ${orderId}`);
    } catch (payoutError) {
      console.error(`[PAYOUT] Retry ${retryData.attempts} failed for ${orderId}:`, payoutError.message);
      
      if (retryData.attempts >= MAX_PAYOUT_RETRIES) {
        retryData.order.status = 'payout_failed';
        console.error(`[PAYOUT] Offramp ${orderId} marked as failed after ${MAX_PAYOUT_RETRIES} retries`);
      }
    }
  }
}

// Start retry queue processor
setInterval(retryFailedPayouts, 10000).unref();

function verifySignature(payload, signature, secret) {
  const payloadString = typeof payload === 'string' ? payload : payload.toString();
  const expected = crypto
    .createHmac('sha512', secret) // Bitnob uses SHA512, not SHA256
    .update(payloadString)
    .digest('hex');
  
  // Try hex comparison first
  try {
    if (crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      return true;
    }
  } catch {}
  
  // Try base64 comparison as fallback
  try {
    const expectedBase64 = crypto
      .createHmac('sha512', secret)
      .update(payloadString)
      .digest('base64');
    if (signature === expectedBase64) {
      return true;
    }
  } catch {}
  
  return false;
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

    // Validate inputs
    if (!kiteWallet || !isValidEthereumAddress(kiteWallet)) {
      return res.status(400).json({ error: 'Invalid kiteWallet address. Must be a valid Ethereum address.' });
    }

    let validatedNgnAmount;
    try {
      validatedNgnAmount = validateAmount(ngnAmount, 'ngnAmount', 100, 10000000);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    // 1. Get Rate
    const rate = await bitnobService.getRate(validatedNgnAmount);
    const usdcAmount = rate.usdcPerNgn * validatedNgnAmount;

    // 2. Generate Order
    const orderId = uuidv4();
    DB.orders[orderId] = {
      type: 'onramp',
      kiteWallet,
      ngnAmount: validatedNgnAmount,
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
        amount: validatedNgnAmount,
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
      const { merchantWallet, usdcAmount } = req.body;

      // Validate merchant wallet address
      if (!merchantWallet || !/^0x[a-fA-F0-9]{40}$/.test(merchantWallet)) {
        return res.status(400).json({ error: 'Invalid or missing merchant wallet address' });
      }

      const orderId = req.paymentData.nonce;

      // The payment has already been verified and settled by the x402 middleware.
      // We just need to trigger the vault to release funds to the merchant.
      const txHash = await kiteService.settleCheckout(
        orderId,
        merchantWallet, // Use actual merchant wallet from request
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
    const { usdcAmount, bankAccountNumber, bankName, accountName, userWallet, signature } = req.body;

    // Validate inputs
    let validatedUsdcAmount;
    try {
      validatedUsdcAmount = validateAmount(usdcAmount, 'usdcAmount', 0.01, 100000);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    if (!bankAccountNumber || !/^\d{10}$/.test(bankAccountNumber)) {
      return res.status(400).json({ error: 'Invalid bankAccountNumber. Must be a 10-digit number.' });
    }

    if (!bankName || typeof bankName !== 'string' || bankName.trim().length === 0) {
      return res.status(400).json({ error: 'bankName is required.' });
    }

    if (!accountName || typeof accountName !== 'string' || accountName.trim().length === 0) {
      return res.status(400).json({ error: 'accountName is required.' });
    }

    // 1. Get Rate
    const rate = await bitnobService.getRate();
    const ngnEstimate = rate.ngnPerUsdc * validatedUsdcAmount;

    // 2. Generate Order
    const orderId = uuidv4();
    const orderHash = require('ethers').ethers.id(orderId);
    DB.orderHashes[orderHash] = orderId;

    DB.orders[orderId] = {
      type: 'offramp',
      usdcAmount: validatedUsdcAmount,
      ngnAmount: ngnEstimate.toFixed(0),
      bankDetails: {
        accountNumber: bankAccountNumber,
        bankName,
        accountName
      },
      userWallet: userWallet || null,
      status: 'pending'
    };

    // 3. Return instructions for gasless flow
    res.json({
      orderId,
      vaultAddress: process.env.VAULT_ADDRESS,
      usdcAddress: process.env.USDC_ADDRESS,
      usdcAmount: validatedUsdcAmount,
      ngnEstimate: ngnEstimate.toFixed(0),
      instructions: {
        method: "transfer_to_vault",
        description: "Transfer USDC directly to the vault address. Backend will detect the deposit and process your offramp.",
        steps: [
          "Approve vault to spend your USDC",
          "Call vault.initiateOfframp(orderIdHash, usdcAmount)",
          "Backend will automatically detect and process NGN payout"
        ]
      },
      // For gasless: backend will submit on behalf of user if they provide signature
      gaslessOption: signature ? "Backend will submit transaction on your behalf" : "User must submit transaction directly"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Standard POS Checkout (Customer pays NGN to Merchant)
app.post('/api/checkout/initiate', async (req, res) => {
  try {
    const { merchantKiteWallet, ngnAmount } = req.body;

    // Validate inputs
    if (!merchantKiteWallet || !isValidEthereumAddress(merchantKiteWallet)) {
      return res.status(400).json({ error: 'Invalid merchantKiteWallet address. Must be a valid Ethereum address.' });
    }

    let validatedNgnAmount;
    try {
      validatedNgnAmount = validateAmount(ngnAmount, 'ngnAmount', 100, 10000000);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const rate = await bitnobService.getRate(validatedNgnAmount);
    const usdcAmount = rate.usdcPerNgn * validatedNgnAmount;

    const orderId = uuidv4();
    DB.orders[orderId] = {
      type: 'checkout',
      merchantKiteWallet,
      ngnAmount: validatedNgnAmount,
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
        amount: validatedNgnAmount,
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
    // Query real on-chain data
    const stats = await kiteService.getVaultStats();
    res.json(stats);
  } catch (error) {
    console.error('[VAULT] Failed to get vault stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get Order Status
app.get('/api/order/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = DB.orders[orderId];

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId,
      ...order
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Check if order is settled on-chain
app.get('/api/order/:orderId/onchain-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = DB.orders[orderId];

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderType = order.type === 'onramp' ? 'ONRAMP' : 
                      order.type === 'offramp' ? 'OFFRAMP' : 'CHECKOUT';
    
    const isSettled = await kiteService.isOrderSettledOnChain(orderId, orderType);

    res.json({
      orderId,
      localStatus: order.status,
      isSettledOnChain: isSettled,
      orderType
    });
  } catch (error) {
    console.error('[ORDER] Failed to get on-chain status:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Submit Offramp Transaction (Gasless)
app.post('/api/offramp/:orderId/submit-tx', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { txHash } = req.body;

    if (!txHash || typeof txHash !== 'string') {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    const order = DB.orders[orderId];
    if (!order || order.type !== 'offramp') {
      return res.status(404).json({ error: 'Offramp order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Order is already ${order.status}` });
    }

    // Mark order as submitted on-chain
    order.status = 'submitted';
    order.txHash = txHash;
    order.submittedAt = new Date().toISOString();

    console.log(`[OFFRAMP] Order ${orderId} submitted on-chain: ${txHash}`);
    console.log(`[OFFRAMP] Waiting for event detection...`);

    res.json({
      success: true,
      orderId,
      txHash,
      status: 'submitted',
      message: 'Transaction submitted. Backend will detect event and process NGN payout automatically.'
    });
  } catch (error) {
    console.error('[OFFRAMP] Failed to submit transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get Merchant Info
app.get('/api/merchant/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isValidEthereumAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const merchantInfo = await kiteService.getMerchantInfo(address);
    res.json(merchantInfo);
  } catch (error) {
    console.error('[MERCHANT] Failed to get merchant info:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get Token Balance
app.get('/api/balance/:tokenAddress/:ownerAddress', async (req, res) => {
  try {
    const { tokenAddress, ownerAddress } = req.params;

    if (!isValidEthereumAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }

    if (!isValidEthereumAddress(ownerAddress)) {
      return res.status(400).json({ error: 'Invalid owner address' });
    }

    const balance = await kiteService.getTokenBalance(tokenAddress, ownerAddress);
    res.json(balance);
  } catch (error) {
    console.error('[BALANCE] Failed to get token balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get Offramp Retry Queue Status
app.get('/api/admin/retry-queue', (req, res) => {
  try {
    const queueStatus = {
      totalPending: payoutRetryQueue.size,
      orders: []
    };

    for (const [orderId, retryData] of payoutRetryQueue.entries()) {
      queueStatus.orders.push({
        orderId,
        attempts: retryData.attempts,
        maxRetries: MAX_PAYOUT_RETRIES,
        lastAttempt: new Date(retryData.lastAttempt).toISOString(),
        orderStatus: retryData.order.status,
        ngnAmount: retryData.order.ngnAmount
      });
    }

    res.json(queueStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get All Orders (Admin)
app.get('/api/admin/orders', (req, res) => {
  try {
    const { status, type } = req.query;
    
    let orders = Object.entries(DB.orders).map(([id, data]) => ({
      orderId: id,
      ...data
    }));

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    if (type) {
      orders = orders.filter(o => o.type === type);
    }

    res.json({
      total: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Register Merchant (Admin)
app.post('/api/merchant/register', async (req, res) => {
  try {
    const { merchantWallet } = req.body;

    // Validate merchant wallet address
    if (!merchantWallet || !/^0x[a-fA-F0-9]{40}$/.test(merchantWallet)) {
      return res.status(400).json({ error: 'Invalid or missing merchant wallet address. Must be a valid Ethereum address.' });
    }

    // Check if already registered
    const isRegistered = await kiteService.isMerchantRegistered(merchantWallet);
    if (isRegistered) {
      return res.status(400).json({ error: `Merchant ${merchantWallet} is already registered.` });
    }

    // Register merchant on-chain
    const txHash = await kiteService.registerMerchant(merchantWallet);

    res.json({ 
      success: true, 
      message: `Merchant ${merchantWallet} registered on-chain.`,
      txHash
    });
  } catch (error) {
    console.error('[MERCHANT] Registration failed:', error);
    res.status(500).json({ error: error.message || 'Merchant registration failed' });
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

      // Try to find order by hash first
      let originalOrderId = DB.orderHashes[offrampData.orderId];

      // If not found, try to match by iterating through pending offramp orders
      if (!originalOrderId) {
        console.log('[KITE] Hash not found in DB, searching pending offramps...');
        for (const [orderId, order] of Object.entries(DB.orders)) {
          if (order.type === 'offramp' && (order.status === 'pending' || order.status === 'submitted')) {
            const expectedHash = require('ethers').ethers.id(orderId);
            if (expectedHash === offrampData.orderId) {
              originalOrderId = orderId;
              DB.orderHashes[offrampData.orderId] = orderId;
              console.log(`[KITE] Matched order by hash: ${orderId}`);
              break;
            }
          }
        }
      }

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

      if (order.status === 'payout_failed') {
        console.error(`[KITE] Offramp ${originalOrderId} previously failed. Skipping.`);
        return;
      }

      // Update order status
      if (order.status === 'pending') {
        order.status = 'detected';
      }
      order.onchainTxHash = offrampData.txHash;
      order.detectedAt = new Date().toISOString();

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
        order.paidAt = new Date().toISOString();
        console.log(`[BITNOB] Payout successful for ${originalOrderId}.`);
      } catch (payoutError) {
        console.error(`[BITNOB] Payout failed for ${originalOrderId}:`, payoutError.message);

        // Add to retry queue instead of silently failing
        console.warn(`[BITNOB] Adding offramp ${originalOrderId} to retry queue...`);
        payoutRetryQueue.set(originalOrderId, {
          order,
          attempts: 0,
          lastAttempt: Date.now()
        });
      }
    });
  } catch (err) {
    console.error('[SERVER] Failed to start blockchain listener:', err.message);
  }
});
