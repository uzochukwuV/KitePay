# SwiftCheckout Backend - Critical Bug Fixes Summary

## Date: 2026-04-13

### Overview
Fixed critical bugs in the backend that would have caused production failures, security issues, and lost funds.

---

## 🔴 Critical Fixes

### 1. Fixed Hardcoded Merchant Wallet in x402 Checkout
**File:** `src/index.js` (line ~203)

**Before:**
```javascript
const dummyMerchantWallet = "0x1111111111111111111111111111111111111111";
// All payments went to this hardcoded address!
```

**After:**
```javascript
const { merchantWallet, usdcAmount } = req.body;

// Validate merchant wallet address
if (!merchantWallet || !/^0x[a-fA-F0-9]{40}$/.test(merchantWallet)) {
  return res.status(400).json({ error: 'Invalid or missing merchant wallet address' });
}

// Uses actual merchant wallet from request
const txHash = await kiteService.settleCheckout(
  orderId,
  merchantWallet, // ✅ Real merchant wallet
  usdcAmount || "1",
  0
);
```

**Impact:** 🔴 **CRITICAL** - Previously ALL x402 AI agent payments would go to a hardcoded address instead of the actual merchant.

---

### 2. Implemented Real Merchant Registration
**File:** `src/index.js` (line ~358)
**File:** `src/services/kite.service.js` (added functions)

**Before:**
```javascript
// Just returned success without doing anything!
res.json({ success: true, message: `Merchant ${merchantWallet} registered on-chain.` });
```

**After:**
```javascript
// Validates input
if (!merchantWallet || !isValidEthereumAddress(merchantWallet)) {
  return res.status(400).json({ error: 'Invalid merchant wallet address' });
}

// Checks if already registered
const isRegistered = await kiteService.isMerchantRegistered(merchantWallet);
if (isRegistered) {
  return res.status(400).json({ error: 'Merchant already registered' });
}

// Actually calls smart contract
const txHash = await kiteService.registerMerchant(merchantWallet);

res.json({ 
  success: true, 
  message: `Merchant registered on-chain`,
  txHash
});
```

**Added to kite.service.js:**
```javascript
async function registerMerchant(merchantAddress) {
  const tx = await getVault().registerMerchant(merchantAddress);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function isMerchantRegistered(merchantAddress) {
  return await getVault().merchants(merchantAddress);
}
```

**Impact:** 🔴 **CRITICAL** - Merchants were never actually registered on-chain, so all checkout settlements would fail with "Merchant not registered" error.

---

### 3. Added Input Validation to All Endpoints
**File:** `src/index.js` (lines 13-23)

**Added validation helpers:**
```javascript
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
```

**Protected endpoints:**
- ✅ `/api/onramp/initiate` - validates `kiteWallet` address and `ngnAmount`
- ✅ `/api/checkout/initiate` - validates `merchantKiteWallet` address and `ngnAmount`
- ✅ `/api/offramp/initiate` - validates `usdcAmount`, `bankAccountNumber`, `bankName`, `accountName`
- ✅ `/api/checkout/x402` - validates `merchantWallet` address
- ✅ `/api/merchant/register` - validates `merchantWallet` address

**Impact:** 🟡 **HIGH** - Prevents invalid inputs from causing on-chain reverts or sending funds to wrong addresses.

---

### 4. Added Offramp Payout Retry Logic
**File:** `src/index.js` (lines 35-85, 475-485)

**Before:**
```javascript
} catch (payoutError) {
  console.error(`Payout failed for ${originalOrderId}:`, payoutError.message);
  // ❌ Error silently swallowed - user's USDC locked, no NGN payout!
}
```

**After:**
```javascript
// Retry queue for failed payouts
const payoutRetryQueue = new Map();
const MAX_PAYOUT_RETRIES = 5;
const PAYOUT_RETRY_DELAY_MS = 60000; // 1 minute

async function retryFailedPayouts() {
  // Automatically retries failed payouts with exponential backoff
  // Marks as 'payout_failed' after max retries exceeded
}

// Failed payouts are added to retry queue
} catch (payoutError) {
  console.error(`Payout failed for ${originalOrderId}:`, payoutError.message);
  payoutRetryQueue.set(originalOrderId, {
    order,
    attempts: 0,
    lastAttempt: Date.now()
  });
}
```

**Features:**
- ✅ Automatic retry up to 5 times
- ✅ 1-minute delay between retries
- ✅ Tracks retry state in memory
- ✅ Marks as `payout_failed` after max retries for manual intervention
- ✅ Runs every 10 seconds to process queue

**Impact:** 🟡 **HIGH** - Previously failed payouts would be lost forever with user's USDC already taken on-chain.

---

### 5. Created `.env.example` File
**File:** `.env.example` (new file)

**Documented all required environment variables:**
```bash
# Server
PORT=8080
BASE_URL=http://localhost:8080

# Bitnob (Sandbox)
BITNOB_API_URL=https://sandboxapi.bitnob.co/api/v1
BITNOB_SECRET_KEY=your_bitnob_secret_key_here
BITNOB_WEBHOOK_SECRET=your_bitnob_webhook_secret_here
BITNOB_CUSTOMER_ID=your_bitnob_customer_id_here

# Kite Blockchain
KITE_RPC_URL=https://rpc-testnet.gokite.ai
KITE_NETWORK=kite-testnet
OPERATOR_PRIVATE_KEY=your_operator_private_key_here
VAULT_ADDRESS=your_deployed_vault_address_here
USDC_ADDRESS=0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9

# Optional
YIELD_CHECK_INTERVAL_MS=3600000
```

**Impact:** 🟢 **MEDIUM** - Makes it much easier for developers to set up the project correctly.

---

## 📊 Summary of Changes

| File | Lines Changed | Type |
|------|---------------|------|
| `src/index.js` | ~150 lines | Bug fixes + features |
| `src/services/kite.service.js` | +30 lines | New functions |
| `.env.example` | New file | Documentation |

---

## ✅ What's Fixed

1. ✅ **x402 payments go to correct merchant** (not hardcoded address)
2. ✅ **Merchant registration actually works** (calls smart contract)
3. ✅ **All endpoints validate inputs** (prevents invalid addresses/amounts)
4. ✅ **Failed payouts are retried automatically** (not silently lost)
5. ✅ **Environment variables are documented** (easier setup)

---

## 🚀 Next Steps (Not Yet Implemented)

These items were identified but not fixed yet:

1. **Bitnob Integration** - Still using sandbox bank instructions instead of real Bitnob virtual accounts
   - Need to implement customer creation (`POST /customers`)
   - Need to implement address generation (`POST /addresses/generate`)
   - Fix USDT/USDC asset mismatch in payout quotes

2. **Webhook Idempotency** - Key uses `${event}-${reference}` which could allow double-settlement
   - Should use just `reference` as key

3. **In-memory DB** - All state lost on server restart
   - Need to persist `processedWebhooks` to prevent replay attacks

4. **CORS/Rate Limiting** - Still wide open
   - Should restrict CORS to specific domains
   - Add `express-rate-limit` middleware

5. **Error Handling in `ngnAmount`** - Still passed as raw number to smart contract
   - May need decimal parsing depending on vault contract expectations

---

## 🧪 Testing Checklist

Before deploying:

- [ ] Create `.env` file from `.env.example`
- [ ] Deploy SwiftVault contract and set `VAULT_ADDRESS`
- [ ] Fund operator wallet with testnet ETH
- [ ] Test merchant registration: `POST /api/merchant/register`
- [ ] Test onramp with invalid wallet address (should reject)
- [ ] Test onramp with valid data (should work)
- [ ] Test checkout with invalid merchant (should reject)
- [ ] Test x402 checkout with real merchant wallet
- [ ] Test offramp and verify payout retry logic
- [ ] Monitor logs for any errors

---

## ⚠️ Important Notes

1. **Sandbox Mode**: Still using dummy bank instructions (`"Sandbox Bank"`, `"0123456789"`) instead of real Bitnob virtual accounts
2. **USDT vs USDC**: Bitnob API uses `fromAsset: 'usdt'` but we're calling it USDC - this works for NGN rates but is semantically incorrect
3. **In-memory DB**: All orders are lost on restart - webhook replays could cause double-processing
4. **No Authentication**: `/api/merchant/register` has no auth guard - anyone can call it

---

## 🐛 Remaining Bugs (Lower Priority)

- Webhook body parser conflicts with express.json()
- `require('ethers').ethers.id()` redundant import
- Event polling starts from 'latest' block - might miss early events on fresh deploy
- No merchant deregistration function
- `emergencyWithdraw` can drain L-USDC yield position

---

**Status:** ✅ All critical bugs fixed. Ready for sandbox testing.
