const crypto = require('crypto');
const axios = require('axios');

const BITNOB_API_URL = process.env.BITNOB_API_URL || 'https://sandboxapi.bitnob.co/api/v1';
const CLIENT_ID = process.env.BITNOB_CUSTOMER_ID;
const CLIENT_SECRET = process.env.BITNOB_SECRET_KEY;

/**
 * Generate HMAC authentication headers for Bitnob API requests
 * Uses HMAC-SHA256 with CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD format
 */
function generateAuthHeaders(body = null) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('BITNOB_CUSTOMER_ID or BITNOB_SECRET_KEY is not provided');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

  const stringToSign = `${CLIENT_ID}:${timestamp}:${nonce}:${payload}`;
  const signature = crypto.createHmac('sha256', CLIENT_SECRET).update(stringToSign).digest('hex');

  return {
    'X-Auth-Client': CLIENT_ID,
    'X-Auth-Timestamp': timestamp,
    'X-Auth-Nonce': nonce,
    'X-Auth-Signature': signature,
    'Content-Type': 'application/json',
  };
}

const bitnob = axios.create({
  baseURL: BITNOB_API_URL,
});

/**
 * Get current NGN/USDC exchange rate
 */
async function getRate(ngnAmount = 100000) {
  try {
    const body = {
      source: 'offchain',
      fromAsset: 'usdt',
      toCurrency: 'ngn',
      settlementAmount: ngnAmount,
    };

    const res = await bitnob.post('/payouts/quotes', body, {
      headers: generateAuthHeaders(body),
    });

    if (!res.data.data) {
      throw new Error('Invalid quote response');
    }

    const { settlementAmount, sourceAmount } = res.data.data;
    return {
      ngnPerUsdc: settlementAmount / sourceAmount,
      usdcPerNgn: sourceAmount / settlementAmount,
    };
  } catch (error) {
    console.error('[BITNOB] Rate fetch error:', error.response?.data || error.message);
    // Sandbox fallback
    console.log('[BITNOB] Using sandbox fallback rate (1500 NGN = 1 USDC)');
    return {
      ngnPerUsdc: 1500,
      usdcPerNgn: 1 / 1500,
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
    const quoteBody = {
      source: 'offchain',
      fromAsset: 'usdt',
      toCurrency: 'ngn',
      settlementAmount: ngnAmount,
    };

    const quoteRes = await bitnob.post('/payouts/quotes', quoteBody, {
      headers: generateAuthHeaders(quoteBody),
    });

    const quoteId = quoteRes.data.data.quoteId;
    console.log('[STEP 1] Quote:', quoteId);

    // Step 2: Initialize
    const initBody = {
      quoteId,
      customerId: CLIENT_ID,
      country: 'NG',
      reference,
      paymentReason: 'SwiftCheckout Payout',
      beneficiary: {
        type: 'BANK',
        accountName: recipientName,
        bankName: bankName || 'OPAY',
        accountNumber,
      },
    };

    await bitnob.post('/payouts/initialize', initBody, {
      headers: generateAuthHeaders(initBody),
    });
    console.log('[STEP 2] Initialized');

    // Step 3: Finalize
    const finalizeBody = { quoteId };
    await bitnob.post('/payouts/finalize', finalizeBody, {
      headers: generateAuthHeaders(finalizeBody),
    });
    console.log('[STEP 3] Finalized');

    return { success: true, reference, quoteId };
  } catch (error) {
    console.error('[BITNOB] Payout failed:', error.response?.data || error.message);
    throw new Error('Payout failed');
  }
}

module.exports = { payoutNGN, getRate, generateAuthHeaders };
