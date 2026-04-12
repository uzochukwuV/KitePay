const axios = require('axios');

const bitnob = axios.create({
  baseURL: process.env.BITNOB_API_URL || 'https://sandboxapi.bitnob.co/api/v1',
  headers: {
    Authorization: `Bearer ${process.env.BITNOB_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Get current NGN/USDC exchange rate
 */
async function getRate(ngnAmount = 100000) {
  try {
    const res = await bitnob.post('/payouts/quotes', {
      source: 'offchain',
      fromAsset: 'usdt',
      toCurrency: 'ngn',
      settlementAmount: ngnAmount,
    });
    
    // In sandbox this might look different. 
    // Fallback static rate for testing if Bitnob sandbox throws errors for empty accounts
    if (!res.data.data) {
        throw new Error("Invalid quote response");
    }

    const { settlementAmount, sourceAmount } = res.data.data;
    return {
      ngnPerUsdc: settlementAmount / sourceAmount,
      usdcPerNgn: sourceAmount / settlementAmount,
    };
  } catch (error) {
    console.error("[BITNOB] Rate fetch error:", error.response?.data || error.message);
    // Sandbox fallback
    console.log("[BITNOB] Using sandbox fallback rate (1500 NGN = 1 USDC)");
    return {
      ngnPerUsdc: 1500,
      usdcPerNgn: 1 / 1500
    };
  }
}

/**
 * Full Bitnob payout flow (3 steps)
 * Used for OFFRAMP: after user sends USDC to vault,
 * we pay NGN to their bank account
 */
async function payoutNGN({ reference, recipientName, accountNumber, bankName, ngnAmount }) {
  try {
    // Step 1: Quote
    const quoteRes = await bitnob.post('/payouts/quotes', {
      source: 'offchain',
      fromAsset: 'usdt',
      toCurrency: 'ngn',
      settlementAmount: ngnAmount,
    });
    
    const quoteId = quoteRes.data.data.quoteId;
    console.log('[STEP 1] Quote:', quoteId);

    // Step 2: Initialize
    await bitnob.post('/payouts/initialize', {
      quoteId,
      customerId: process.env.BITNOB_CUSTOMER_ID, // Must be provided in .env
      country: 'NG',
      reference,
      paymentReason: 'SwiftCheckout Payout',
      beneficiary: {
        type: 'BANK',
        accountName: recipientName,
        bankName: bankName || 'OPAY',
        accountNumber,
      },
    });
    console.log('[STEP 2] Initialized');

    // Step 3: Finalize
    await bitnob.post('/payouts/finalize', { quoteId });
    console.log('[STEP 3] Finalized');

    return { success: true, reference, quoteId };
  } catch (error) {
    console.error("[BITNOB] Payout failed:", error.response?.data || error.message);
    throw new Error("Payout failed");
  }
}

module.exports = { payoutNGN, getRate };
