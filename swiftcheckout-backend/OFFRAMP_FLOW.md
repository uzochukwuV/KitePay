# SwiftCheckout Offramp Flow Guide

## Gasless Offramp Pattern

Users don't need Kite ETH for gas. The backend acts as a relayer.

---

## Flow Overview

```
1. User → Backend: POST /api/offramp/initiate
2. Backend → User: Returns orderId + instructions
3. User → Vault: Approve USDC spending
4. User → Vault: Call initiateOfframp() (needs gas OR backend relays)
5. Backend: Detects on-chain event
6. Backend → Bitnob: Triggers NGN payout to user's bank
7. User: Receives NGN in bank account
```

---

## Step 1: Initiate Offramp

**Endpoint:** `POST /api/offramp/initiate`

**Request Body:**
```json
{
  "usdcAmount": 100,
  "bankAccountNumber": "1234567890",
  "bankName": "Opay",
  "accountName": "John Doe",
  "userWallet": "0x123...", // Optional
  "signature": "0xabc..." // Optional - for gasless relay
}
```

**Response:**
```json
{
  "orderId": "724afc51-a924-4494-843d-fb69e50f93cf",
  "vaultAddress": "0xa97a77408D47e15cB564270A2024f481d002f622",
  "usdcAddress": "0x667867a41AEa19C7689D6A106e266CfFc2F5D8b9",
  "usdcAmount": 100,
  "ngnEstimate": "150000",
  "instructions": {
    "method": "transfer_to_vault",
    "description": "Transfer USDC directly to the vault address. Backend will detect the deposit and process your offramp.",
    "steps": [
      "Approve vault to spend your USDC",
      "Call vault.initiateOfframp(orderIdHash, usdcAmount)",
      "Backend will automatically detect and process NGN payout"
    ]
  },
  "gaslessOption": "User must submit transaction directly"
}
```

---

## Step 2: User Initiates On-Chain (Two Options)

### Option A: User Submits Directly (Has Gas)

```javascript
// 1. Approve vault to spend USDC
await usdc.approve(VAULT_ADDRESS, ethers.parseUnits("100", 6));

// 2. Generate order hash
const orderIdHash = ethers.id(orderId);

// 3. Call vault
await vault.initiateOfframp(orderIdHash, ethers.parseUnits("100", 6));
```

### Option B: Backend Relays Transaction (Gasless for User)

**Endpoint:** `POST /api/offramp/:orderId/submit-tx`

**Request Body:**
```json
{
  "txHash": "0xabc123..." // Transaction hash after user initiates on-chain
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "724afc51-a924-4494-843d-fb69e50f93cf",
  "txHash": "0xabc123...",
  "status": "submitted",
  "message": "Transaction submitted. Backend will detect event and process NGN payout automatically."
}
```

---

## Step 3: Automatic NGN Payout

Backend automatically:
1. Detects `OfframpInitiated` event on-chain (polls every 5 seconds)
2. Matches event to order in database
3. Calls Bitnob API to payout NGN to user's bank account
4. Updates order status to `settled`

**No user action required!**

---

## Step 4: Check Order Status

**Endpoint:** `GET /api/order/:orderId`

**Response:**
```json
{
  "orderId": "724afc51-a924-4494-843d-fb69e50f93cf",
  "type": "offramp",
  "usdcAmount": 100,
  "ngnAmount": "150000",
  "bankDetails": {
    "accountNumber": "1234567890",
    "bankName": "Opay",
    "accountName": "John Doe"
  },
  "status": "settled", // pending → detected → settled
  "txHash": "0xabc123...",
  "submittedAt": "2026-04-13T12:00:00Z",
  "detectedAt": "2026-04-13T12:00:30Z",
  "paidAt": "2026-04-13T12:01:00Z"
}
```

**On-Chain Status:**
```
GET /api/order/:orderId/onchain-status

{
  "orderId": "724afc51-a924-4494-843d-fb69e50f93cf",
  "localStatus": "settled",
  "isSettledOnChain": true,
  "orderType": "OFFRAMP"
}
```

---

## Order Status Flow

```
pending → submitted → detected → settled
   ↓
   └─→ payout_failed (if Bitnob fails, auto-retries 5x)
```

---

## Retry Queue

If Bitnob payout fails:
- Automatically added to retry queue
- Retries every 60 seconds (max 5 attempts)
- Marks as `payout_failed` after max retries
- Can monitor via: `GET /api/admin/retry-queue`

---

## Complete Frontend Flow Example

```javascript
// 1. User initiates offramp
const response = await fetch('http://localhost:8080/api/offramp/initiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    usdcAmount: 100,
    bankAccountNumber: '1234567890',
    bankName: 'Opay',
    accountName: 'John Doe'
  })
});

const { orderId, vaultAddress, usdcAddress } = await response.json();

// 2. User approves USDC
await usdcContract.approve(vaultAddress, ethers.parseUnits('100', 6));

// 3. User initiates on-chain
const orderIdHash = ethers.id(orderId);
const tx = await vaultContract.initiateOfframp(orderIdHash, ethers.parseUnits('100', 6));
await tx.wait();

// 4. Notify backend (optional - backend will detect automatically)
await fetch(`http://localhost:8080/api/offramp/${orderId}/submit-tx`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ txHash: tx.hash })
});

// 5. Poll for status updates
const checkStatus = setInterval(async () => {
  const res = await fetch(`http://localhost:8080/api/order/${orderId}`);
  const order = await res.json();
  
  if (order.status === 'settled') {
    console.log('✅ NGN payout completed!');
    clearInterval(checkStatus);
  } else if (order.status === 'payout_failed') {
    console.log('❌ Payout failed. Contact support.');
    clearInterval(checkStatus);
  } else {
    console.log(`⏳ Status: ${order.status}`);
  }
}, 5000);
```

---

## Gasless Future Enhancement

To enable **fully gasless** offramp (user signs, backend pays gas):

1. Upgrade Mock USDC to support EIP-2612 `permit()`
2. User signs permit off-chain
3. Backend calls `permit()` + `initiateOfframp()` in single transaction
4. User pays zero gas

**Not implemented yet** - current flow requires user to have small amount of Kite ETH for gas (~$0.01 per transaction).
