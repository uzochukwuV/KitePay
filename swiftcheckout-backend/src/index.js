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
  processedWebhooks: new Set() // eventId -> bool (for strict idempotency)
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
async function processWebhookEventInBackground(event) {
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
  } catch (err) {
    console.error(`[PROCESSOR] Failed to process event for ${event.data?.reference || event.reference}:`, err.message);
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

    // Idempotency check: prevent duplicate processing
    // In production, use the unique event ID from Bitnob if provided, otherwise use reference + event
    const idempotencyKey = `${event.event}-${reference}`;
    if (DB.processedWebhooks.has(idempotencyKey)) {
        console.log(`[WEBHOOK] Idempotency hit. Already handled ${idempotencyKey}`);
        return res.status(200).send('already handled');
    }
    DB.processedWebhooks.add(idempotencyKey);

    // If it's a relevant payment/transfer event
    if (
        event.event === 'payment.received' || 
        event.event === 'payout.completed' ||
        event.event === 'transfer.success'
    ) {
      // Fire and forget (Background Processing) -> Allows immediate 200 OK
      processWebhookEventInBackground(event);
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

      // In a real app we would link merchantId to their Kite wallet address
      const dummyMerchantWallet = "0x0000000000000000000000000000000000000000";

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[SERVER] SwiftCheckout backend listening on port ${PORT}`);
});
