# SwiftCheckout: Frontend Integration Guide

This guide provides the React Native (or React Web) frontend developer with everything needed to integrate the SwiftCheckout backend APIs and the Kite blockchain smart contracts.

The core philosophy of this app is **"Zero Crypto UX"**. Users should never see gas fees, seed phrases, or transaction hashes. All crypto interactions happen silently in the background using EIP-3009 gasless signatures.

---

## 1. System Architecture Overview

- **Backend API:** `https://api.yourdomain.com` (Handles NGN quotes, Bitnob bank transfers, and x402 AI Agent payments).
- **Blockchain:** Kite Testnet (`https://rpc-testnet.gokite.ai`, Chain ID: 2368).
- **Gasless Relayer:** Kite Gasless API (`https://gasless.gokite.ai`).
- **Smart Contract (Vault):** `0x1e7ceEA90067680b65fd90aE571f7bd19AacBFC1`
- **USDC Token (Mock):** `0xf19eAa3DF45C8ee8BB9f1F098bb300c688EB172E`

---

## 2. Wallet Management (Crucial First Step)

When a user opens the app for the first time, you must generate an Ethereum-compatible wallet in the background and store it securely.

**Dependencies:**
```bash
npm install ethers react-native-encrypted-storage
```

**Implementation:**
```javascript
import { ethers } from 'ethers';
import EncryptedStorage from 'react-native-encrypted-storage';

async function setupWallet() {
  let privateKey = await EncryptedStorage.getItem('user_pk');
  
  if (!privateKey) {
    const wallet = ethers.Wallet.createRandom();
    await EncryptedStorage.setItem('user_pk', wallet.privateKey);
    privateKey = wallet.privateKey;
  }
  
  const provider = new ethers.JsonRpcProvider('https://rpc-testnet.gokite.ai');
  return new ethers.Wallet(privateKey, provider);
}
```
*The `wallet.address` is what you pass to the backend as `kiteWallet` or `merchantKiteWallet`.*

---

## 3. Flow 1: Onramp (Deposit NGN → Get USDC)

**Goal:** The user sends NGN from their local bank app to a virtual account. The backend detects it and credits their app wallet with USDC.

### Step 1: Initiate Onramp
Call the backend to get a quote and bank transfer instructions.

```javascript
const response = await axios.post('https://api.yourdomain.com/api/onramp/initiate', {
  kiteWallet: wallet.address, // The wallet you generated in Step 2
  ngnAmount: 50000            // E.g., 50,000 Naira
});

const { orderId, usdcEstimate, instructions } = response.data;
// instructions contains: bankName, accountNumber, accountName, amount
```

### Step 2: UI & Waiting
1. Display the `instructions` to the user so they can make the transfer in their bank app.
2. Show a loading spinner: *"Waiting for transfer confirmation..."*
3. **Real-time update:** You should listen for a Firebase Push Notification (FCM) or poll a status endpoint. Once the backend webhook fires, the USDC will appear in the user's `wallet.address`.

---

## 4. Flow 2: Offramp (Withdraw USDC → Get NGN in Bank)

**Goal:** The user wants to cash out. They send USDC to the Vault, and the backend wires NGN to their local bank account.

### Step 1: Initiate Offramp API
Tell the backend where to send the fiat.

```javascript
const response = await axios.post('https://api.yourdomain.com/api/offramp/initiate', {
  usdcAmount: 25, // $25 USDC
  bankAccountNumber: "0123456789",
  bankName: "Guaranty Trust Bank",
  accountName: "John Doe"
});

const { orderId, vaultAddress, usdcAmount } = response.data;
```

### Step 2: The Gasless Transfer (EIP-3009)
*Do NOT ask the user to pay KITE for gas.* Instead, generate an EIP-3009 signature using their stored private key and submit it to the Kite Gasless Relayer.

```javascript
import { ethers } from 'ethers';

// 1. Convert orderId to bytes32 hash for the smart contract
const orderIdBytes32 = ethers.id(orderId);

// 2. Create the EIP-3009 TransferWithAuthorization signature
const nonce = ethers.hexlify(ethers.randomBytes(32)); 
const validAfter = 0;
const validBefore = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour

// You will sign this payload using the user's wallet
const domain = {
  name: "USD Coin",
  version: "2",
  chainId: 2368,
  verifyingContract: "0xf19eAa3DF45C8ee8BB9f1F098bb300c688EB172E" // USDC Address
};

const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

const value = ethers.parseUnits(usdcAmount.toString(), 6);

const message = {
  from: wallet.address,
  to: vaultAddress, // Send to SwiftVault
  value: value,
  validAfter: validAfter,
  validBefore: validBefore,
  nonce: nonce,
};

const signature = await wallet.signTypedData(domain, types, message);
const { v, r, s } = ethers.Signature.from(signature);

// 3. Submit to Kite Gasless Relayer (or your own backend to relay)
await axios.post('https://gasless.gokite.ai/relay', {
  target: vaultAddress,
  data: /* ABI encoded call to initiateOfframp(orderIdBytes32, value) with signature attached */
});
```
*Note: Once the relayer submits the transaction, the `OfframpInitiated` event fires on-chain. The backend listens for this and automatically wires the NGN to the user's bank.*

---

## 5. Flow 3: Merchant POS (QR Code Checkout)

**Goal:** A merchant generates a QR code for a specific NGN amount. A customer scans it and pays.

### Step 1: Merchant Generates QR
The merchant types an amount into the app keypad (e.g., `₦3,500`) and hits "Generate QR".

```javascript
const response = await axios.post('https://api.yourdomain.com/api/checkout/initiate', {
  merchantKiteWallet: wallet.address, // The merchant's app wallet
  ngnAmount: 3500
});

const { orderId, usdcEstimate, instructions } = response.data;
```

### Step 2: Display QR Code
Use `react-native-qrcode-svg` to display a QR code containing a JSON string:
```json
{
  "merchantId": "merchant_wallet_address",
  "orderId": "orderId_from_api",
  "usdcAmount": "2.33" 
}
```

### Step 3: Customer Scans & Pays
If another SwiftCheckout user scans the QR code, their app reads the `usdcAmount` and performs the exact same **EIP-3009 Gasless Transfer** (from Flow 2) to send USDC directly to the `merchantId`. 

If a non-crypto user wants to pay, display the `instructions` (Bitnob virtual account) from Step 1 so they can do a standard local bank transfer.

### Step 4: Merchant Confirmation
The merchant's app stays on the QR screen. When the backend successfully routes the payment to the merchant's wallet, it sends an FCM push notification. The app intercepts the notification and flashes a full-screen green success checkmark: *"₦3,500 Paid"*.

---

## 6. AI Agent Integration (x402)
If your app includes an AI agent that browses the web and buys things on behalf of the user, it will encounter HTTP `402 Payment Required` errors from x402-compatible merchants. 

Your frontend doesn't need to do anything special here. When the AI agent encounters a 402, it passes the required payment schema to the frontend. The frontend uses the user's stored private key to sign the EIP-3009 authorization and passes the signature back to the agent to complete the checkout autonomously.