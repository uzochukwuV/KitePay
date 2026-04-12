# SwiftCheckout — Build Documentation

> Invisible stablecoin POS + Onramp/Offramp Protocol for West Africa  
> Built on Kite Chain (EVM L1) + Bitnob (NGN fiat rails)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Tech Stack](#3-tech-stack)
4. [Smart Contracts](#4-smart-contracts)
5. [Backend Architecture](#5-backend-architecture)
6. [Core Flows End-to-End](#6-core-flows-end-to-end)
7. [Environment Variables](#7-environment-variables--config)
8. [API Reference](#8-api-reference)
9. [Security Considerations](#9-security-considerations)
10. [Hackathon Submission Notes](#10-hackathon-submission-notes)

---

## 1. System Overview

SwiftCheckout is a three-product protocol on Kite Chain:

| Product | What it does | Revenue |
|---|---|---|
| **Onramp** | User deposits NGN via bank transfer, receives USDC on Kite chain | Spread on NGN/USDC rate |
| **Offramp** | User sends USDC to vault, receives NGN to bank account | Spread on NGN/USDC rate |
| **Checkout** | Merchant QR accepts NGN bank transfer or Kite USDC; merchant always receives USDC | 0.5–1% per transaction |
| **Yield** | Idle USDC in vault deployed to Lucid L-USDC (Aave v3 backed) | Yield on float |

**Key insight:** SwiftCheckout *is* the NGN ↔ Kite USDC corridor. No other operator exists for Kite chain in West Africa. The vault is the liquidity engine. The backend is the autonomous settlement agent.

### What Makes This Work

- **Bitnob** handles all NGN fiat movement (bank transfer in/out) via their Payout API
- **Kite Chain** is the settlement layer — USDC.e (Bridged USDC) lives here natively
- **SwiftVault** is your on-chain smart contract that holds USDC, settles to merchants, and deploys idle float to yield
- **Your backend** is the bridge: it receives Bitnob webhooks and triggers Kite chain transactions autonomously

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CUSTOMER                             │
│   Pays NGN via bank transfer (Paystack/Opay/GTBank)         │
└────────────────────────┬────────────────────────────────────┘
                         │ bank transfer
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    BITNOB API                               │
│   Step 1: Quote (NGN → USDC rate)                          │
│   Step 2: Initialize payout                                 │
│   Step 3: Finalize → Webhook fired                          │
└────────────────────────┬────────────────────────────────────┘
                         │ webhook: payment confirmed
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               SWIFTCHECKOUT BACKEND (Node.js)               │
│                                                             │
│   ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│   │  Onramp     │  │  Offramp     │  │  Checkout Agent │  │
│   │  Service    │  │  Service     │  │  (x402 handler) │  │
│   └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│          └────────────────┴────────────────────┘            │
│                           │                                 │
│                    Kite Chain SDK                           │
│                  (ethers.js + EIP-3009)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ USDC settlement (gasless)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   KITE CHAIN (EVM L1)                       │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │               SwiftVault.sol                         │  │
│   │                                                      │  │
│   │   deposits[]   ──►  settle(merchant, amount)         │  │
│   │   float buffer ──►  deployToYield()                  │  │
│   │   L-USDC yield ──►  recallFromYield()                │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   USDC.e: 0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e       │
│   Lucid Controller: 0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
              MERCHANT receives USDC
              (sees NGN equivalent in dashboard)
```

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.20, Hardhat, OpenZeppelin |
| Chain | Kite AI L1 (Chain ID: 2368 testnet / 2366 mainnet) |
| Backend | Node.js + Express |
| Chain SDK | ethers.js v6 |
| Fiat Rails | Bitnob Payout API |
| Gasless Transfers | Kite Gasless Service (EIP-3009) |
| Yield | Lucid L-USDC (Aave v3 backed, on Kite) |
| Multisig | Ash Wallet (Safe fork on Kite) |
| Payment Protocol | x402 (for checkout endpoint) |

**Kite Testnet RPC:** `https://rpc-testnet.gokite.ai`  
**Kite Mainnet RPC:** `https://rpc.gokite.ai`  
**Chain ID Testnet:** 2368  
**Chain ID Mainnet:** 2366  
**Testnet Explorer:** `https://testnet.kitescan.ai`  
**Gasless Service:** `https://gasless.gokite.ai`  
**Faucet:** `https://faucet.gokite.ai`

---

## 4. Smart Contracts

### 4.1 SwiftVault.sol — Core Vault

This is the heart of the protocol. It holds USDC.e on Kite chain, handles settlement to merchants, and manages the yield buffer.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SwiftVault
 * @notice Core liquidity vault for SwiftCheckout NGN <> USDC corridor on Kite chain
 * @dev Holds USDC.e, settles merchant payments, deploys idle float to Lucid yield
 */
contract SwiftVault is Ownable, ReentrancyGuard, Pausable {

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;             // USDC.e on Kite
    address public immutable lucidController; // Lucid L-USDC controller
    IERC20 public lUsdc;                      // L-USDC token received from Lucid

    // Liquidity buffer: always keep this % liquid (rest goes to yield)
    // 2000 = 20%, 10000 = 100%
    uint256 public bufferBps = 2000;

    // Operator address — your backend agent wallet (signs settlements)
    address public operator;

    // Merchant registry
    mapping(address => bool) public merchants;

    // Onramp orders: orderId => OnrampOrder
    mapping(bytes32 => OnrampOrder) public onrampOrders;

    // Checkout orders
    mapping(bytes32 => CheckoutOrder) public checkoutOrders;

    // Protocol fee in bps (50 = 0.5%)
    uint256 public feeBps = 50;
    address public feeRecipient;

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct OnrampOrder {
        address user;
        uint256 usdcAmount;   // 6 decimals
        uint256 ngnAmount;    // in kobo for precision
        uint256 expiry;
        bool settled;
    }

    struct CheckoutOrder {
        address merchant;
        uint256 usdcAmount;
        uint256 ngnAmount;
        uint256 expiry;
        bool settled;
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    event OnrampSettled(bytes32 indexed orderId, address indexed user, uint256 usdcAmount);
    event OfframpInitiated(bytes32 indexed orderId, address indexed user, uint256 usdcAmount);
    event CheckoutSettled(bytes32 indexed orderId, address indexed merchant, uint256 usdcAmount);
    event YieldDeployed(uint256 amount);
    event YieldRecalled(uint256 amount);
    event MerchantRegistered(address indexed merchant);
    event OperatorUpdated(address indexed newOperator);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "Not operator");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _lucidController,
        address _lUsdc,
        address _operator,
        address _feeRecipient
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        lucidController = _lucidController;
        lUsdc = IERC20(_lUsdc);
        operator = _operator;
        feeRecipient = _feeRecipient;
    }

    // ─── Onramp ──────────────────────────────────────────────────────────────

    /**
     * @notice Operator calls this after Bitnob confirms NGN received
     * @dev Releases USDC from vault to user's Kite wallet
     */
    function settleOnramp(
        bytes32 orderId,
        address user,
        uint256 usdcAmount,
        uint256 ngnAmount
    ) external onlyOperator nonReentrant whenNotPaused {
        require(!onrampOrders[orderId].settled, "Order already settled");
        require(user != address(0), "Invalid user");
        require(usdcAmount > 0, "Amount must be > 0");
        require(liquidBalance() >= usdcAmount, "Insufficient vault liquidity");

        onrampOrders[orderId] = OnrampOrder({
            user: user,
            usdcAmount: usdcAmount,
            ngnAmount: ngnAmount,
            expiry: block.timestamp + 1 days,
            settled: true
        });

        usdc.transfer(user, usdcAmount);
        emit OnrampSettled(orderId, user, usdcAmount);
    }

    // ─── Offramp ─────────────────────────────────────────────────────────────

    /**
     * @notice User sends USDC to vault to initiate offramp
     * @dev Backend listens for this event and triggers Bitnob NGN payout
     */
    function initiateOfframp(
        bytes32 orderId,
        uint256 usdcAmount
    ) external nonReentrant whenNotPaused {
        require(usdcAmount > 0, "Amount must be > 0");

        uint256 fee = (usdcAmount * feeBps) / 10000;
        uint256 netAmount = usdcAmount - fee;

        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        if (fee > 0) usdc.transfer(feeRecipient, fee);

        // Backend picks up this event and calls Bitnob to pay NGN to user's bank
        emit OfframpInitiated(orderId, msg.sender, netAmount);
    }

    // ─── Checkout ────────────────────────────────────────────────────────────

    /**
     * @notice Operator settles a checkout payment to a merchant
     * @dev Called by backend after Bitnob confirms customer's NGN bank transfer
     */
    function settleCheckout(
        bytes32 orderId,
        address merchant,
        uint256 usdcAmount,
        uint256 ngnAmount
    ) external onlyOperator nonReentrant whenNotPaused {
        require(merchants[merchant], "Merchant not registered");
        require(!checkoutOrders[orderId].settled, "Order already settled");
        require(liquidBalance() >= usdcAmount, "Insufficient vault liquidity");

        uint256 fee = (usdcAmount * feeBps) / 10000;
        uint256 netAmount = usdcAmount - fee;

        checkoutOrders[orderId] = CheckoutOrder({
            merchant: merchant,
            usdcAmount: usdcAmount,
            ngnAmount: ngnAmount,
            expiry: block.timestamp + 1 days,
            settled: true
        });

        usdc.transfer(merchant, netAmount);
        if (fee > 0) usdc.transfer(feeRecipient, fee);

        emit CheckoutSettled(orderId, merchant, netAmount);
    }

    // ─── Yield Management ────────────────────────────────────────────────────

    /**
     * @notice Deploy idle USDC above buffer threshold to Lucid for yield
     * @dev Lucid controller mints L-USDC. 90% goes to Aave v3 automatically.
     * Lucid Controller: 0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b
     */
    function deployToYield() external onlyOperator nonReentrant {
        uint256 total = usdc.balanceOf(address(this));
        uint256 buffer = (total * bufferBps) / 10000;
        uint256 deployable = total - buffer;

        require(deployable > 0, "Nothing to deploy");

        usdc.approve(lucidController, deployable);
        ILucidController(lucidController).mint(deployable, address(this));

        emit YieldDeployed(deployable);
    }

    /**
     * @notice Recall USDC from Lucid yield back to vault
     * @param amount Amount of USDC to recall
     */
    function recallFromYield(uint256 amount) external onlyOperator nonReentrant {
        require(amount > 0, "Amount must be > 0");
        ILucidController(lucidController).burn(amount, address(this));
        emit YieldRecalled(amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function liquidBalance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function yieldBalance() public view returns (uint256) {
        return lUsdc.balanceOf(address(this));
    }

    function totalTVL() public view returns (uint256) {
        return liquidBalance() + yieldBalance();
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function registerMerchant(address merchant) external onlyOwner {
        merchants[merchant] = true;
        emit MerchantRegistered(merchant);
    }

    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
        emit OperatorUpdated(_operator);
    }

    function setBufferBps(uint256 _bps) external onlyOwner {
        require(_bps <= 10000, "Cannot exceed 100%");
        bufferBps = _bps;
    }

    function setFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 500, "Fee cannot exceed 5%");
        feeBps = _bps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function emergencyWithdraw(address to) external onlyOwner {
        usdc.transfer(to, usdc.balanceOf(address(this)));
    }
}

interface ILucidController {
    function mint(uint256 amount, address recipient) external;
    function burn(uint256 amount, address recipient) external;
}
```

### 4.2 Yield Integration — Lucid L-USDC

Lucid is already live on Kite chain. No additional contracts needed from your side.

| Asset | Mainnet Address |
|---|---|
| USDC.e on Kite | `0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e` |
| Lucid Controller (USDC) | `0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b` |
| PYUSD on testnet | `0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9` |

**How Lucid works under the hood:**
- You call `controller.mint(amount, recipient)` → you receive L-USDC back
- Lucid automatically routes **90% to Aave v3** on Arbitrum via LayerZero bridge
- **10% stays liquid** on Kite chain as a buffer for instant withdrawals
- You call `controller.burn(amount, recipient)` → USDC comes back (Lucid handles Aave pull if needed)

### 4.3 Deployment Instructions

```bash
# Install
npm install --save-dev hardhat @openzeppelin/contracts dotenv ethers

# hardhat.config.js
networks: {
  kiteTestnet: {
    url: "https://rpc-testnet.gokite.ai",
    chainId: 2368,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  },
  kiteMainnet: {
    url: "https://rpc.gokite.ai",
    chainId: 2366,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  }
}

# scripts/deploy.js
const SwiftVault = await ethers.getContractFactory("SwiftVault");
const vault = await SwiftVault.deploy(
  "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9",  // PYUSD testnet
  "0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b",  // Lucid Controller
  "0x...",                                         // L-USDC token address
  process.env.OPERATOR_ADDRESS,
  process.env.FEE_RECIPIENT_ADDRESS
);
await vault.waitForDeployment();
console.log("SwiftVault deployed:", await vault.getAddress());

# Deploy
npx hardhat run scripts/deploy.js --network kiteTestnet
```

---

## 5. Backend Architecture

### 5.1 Service Structure

```
swiftcheckout-backend/
├── src/
│   ├── services/
│   │   ├── bitnob.service.js       # Bitnob API wrapper
│   │   ├── kite.service.js         # Kite chain interactions
│   │   ├── gasless.service.js      # EIP-3009 gasless transfers
│   │   ├── onramp.service.js       # NGN → USDC flow
│   │   ├── offramp.service.js      # USDC → NGN flow
│   │   ├── checkout.service.js     # Merchant POS flow
│   │   └── yield.service.js        # Vault yield management cron
│   ├── routes/
│   │   ├── onramp.routes.js
│   │   ├── offramp.routes.js
│   │   ├── checkout.routes.js      # Includes x402 endpoint
│   │   └── webhooks.routes.js      # Bitnob webhook handler
│   ├── middleware/
│   │   └── x402.middleware.js
│   └── index.js
├── contracts/
│   └── SwiftVault.json             # ABI after deployment
└── .env
```

### 5.2 Bitnob Integration

Full three-step Bitnob payout flow in Node.js, based on the official demo:

```javascript
// src/services/bitnob.service.js

const axios = require('axios');

const bitnob = axios.create({
  baseURL: process.env.BITNOB_API_URL,  // https://api.bitnob.co/api/v1
  headers: {
    Authorization: `Bearer ${process.env.BITNOB_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Full Bitnob payout flow (3 steps)
 * Used for OFFRAMP: after user sends USDC to vault,
 * we pay NGN to their bank account
 */
async function payoutNGN({ reference, recipientName, accountNumber, bankName, ngnAmount }) {
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
    customerId: process.env.BITNOB_CUSTOMER_ID,
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
}

/**
 * Get current NGN/USDC exchange rate
 */
async function getRate(ngnAmount = 100000) {
  const res = await bitnob.post('/payouts/quotes', {
    source: 'offchain',
    fromAsset: 'usdt',
    toCurrency: 'ngn',
    settlementAmount: ngnAmount,
  });
  const { settlementAmount, sourceAmount } = res.data.data;
  return {
    ngnPerUsdc: settlementAmount / sourceAmount,
    usdcPerNgn: sourceAmount / settlementAmount,
  };
}

module.exports = { payoutNGN, getRate };
```

**Webhook handler:**

```javascript
// src/routes/webhooks.routes.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const onrampService = require('../services/onramp.service');
const checkoutService = require('../services/checkout.service');

function verifyBitnobWebhook(rawBody, signature) {
  const hash = crypto
    .createHmac('sha256', process.env.BITNOB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}

router.post('/bitnob', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-bitnob-signature'];
  if (!verifyBitnobWebhook(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body.toString());

  switch (event.event) {
    case 'payout.completed':
      if (event.data.paymentReason === 'SwiftCheckout Onramp') {
        await onrampService.handleBitnobConfirmation(event.data.reference);
      }
      break;

    case 'payment.received':
      await checkoutService.handleBitnobConfirmation(event.data.reference);
      break;
  }

  res.json({ received: true });
});

module.exports = router;
```

### 5.3 Kite Chain Integration

```javascript
// src/services/kite.service.js

const { ethers } = require('ethers');
const SwiftVaultABI = require('../../contracts/SwiftVault.json');

const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL);
const operatorWallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

const vault = new ethers.Contract(
  process.env.VAULT_ADDRESS,
  SwiftVaultABI,
  operatorWallet
);

/**
 * Release USDC from vault to user (onramp settlement)
 */
async function settleOnramp(orderId, userAddress, usdcAmount, ngnAmount) {
  const orderIdBytes32 = ethers.id(orderId);
  const tx = await vault.settleOnramp(
    orderIdBytes32,
    userAddress,
    ethers.parseUnits(usdcAmount.toString(), 6),
    ngnAmount
  );
  const receipt = await tx.wait();
  console.log('Onramp settled:', receipt.hash);
  return receipt.hash;
}

/**
 * Release USDC from vault to merchant (checkout settlement)
 */
async function settleCheckout(orderId, merchantAddress, usdcAmount, ngnAmount) {
  const orderIdBytes32 = ethers.id(orderId);
  const tx = await vault.settleCheckout(
    orderIdBytes32,
    merchantAddress,
    ethers.parseUnits(usdcAmount.toString(), 6),
    ngnAmount
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Deploy idle float to Lucid yield
 * Call this from a cron job — e.g., every hour
 */
async function deployToYield() {
  const liquidBal = await vault.liquidBalance();
  const bufferBps = await vault.bufferBps();
  const buffer = (liquidBal * bufferBps) / 10000n;
  const deployable = liquidBal - buffer;

  if (deployable <= 0n) {
    console.log('Nothing to deploy — vault at buffer threshold');
    return null;
  }

  const tx = await vault.deployToYield();
  return (await tx.wait()).hash;
}

/**
 * Listen for OfframpInitiated events — trigger Bitnob NGN payout
 */
function listenForOfframps(callback) {
  vault.on('OfframpInitiated', (orderId, user, usdcAmount, event) => {
    callback({
      orderId: orderId.toString(),
      user,
      usdcAmount: ethers.formatUnits(usdcAmount, 6),
      txHash: event.transactionHash,
    });
  });
  console.log('Listening for offramp events on vault...');
}

module.exports = { settleOnramp, settleCheckout, deployToYield, listenForOfframps };
```

### 5.4 Gasless Settlement via EIP-3009

Kite chain's gasless service means neither customer nor merchant ever needs to hold KITE gas tokens. Your backend can relay USDC transfers on their behalf using EIP-3009 signed authorizations.

**Flow:** User signs `TransferWithAuthorization` off-chain → backend submits signed payload to `gasless.gokite.ai` → Kite relayer pays gas and executes on-chain.

```javascript
// src/services/gasless.service.js

const { ethers } = require('ethers');
const axios = require('axios');

const GASLESS_API = 'https://gasless.gokite.ai';

/**
 * Build EIP-3009 TransferWithAuthorization signature
 *
 * Use this when:
 * - Customer wants to pay merchant directly from their Kite wallet
 * - You want to move USDC from vault to merchant without the vault holding gas
 *
 * @param signer - ethers.Wallet of the token sender
 * @param to - recipient address
 * @param value - amount in token's smallest unit (BigInt)
 * @param tokenAddress - USDC.e contract address on Kite
 * @param tokenName - EIP-712 domain name from /supported_tokens
 * @param tokenVersion - EIP-712 domain version from /supported_tokens
 * @param network - 'mainnet' | 'testnet'
 */
async function buildGaslessTransfer(signer, to, value, tokenAddress, tokenName, tokenVersion, network = 'testnet') {
  const chainId = network === 'mainnet' ? 2366 : 2368;

  // Nonce must be unique per transfer — never reuse
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 10;   // small buffer for clock skew
  const validBefore = now + 25;  // Kite enforces max 30s window — keep tight

  const domain = {
    name: tokenName,       // e.g. "Bridged USDC (Kite AI)" or "PYUSD"
    version: tokenVersion, // e.g. "2" or "1"
    chainId,
    verifyingContract: tokenAddress,
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from',        type: 'address' },
      { name: 'to',          type: 'address' },
      { name: 'value',       type: 'uint256' },
      { name: 'validAfter',  type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce',       type: 'bytes32' },
    ],
  };

  const message = {
    from: signer.address,
    to,
    value: value.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  };

  const signature = await signer.signTypedData(domain, types, message);
  const { v, r, s } = ethers.Signature.from(signature);

  return {
    from: signer.address,
    to,
    value: value.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    tokenAddress,
    v, r, s,
  };
}

/**
 * Submit a signed EIP-3009 payload to Kite's gasless relayer
 * Returns txHash of the on-chain settlement
 */
async function submitGaslessTransfer(transferPayload, network = 'testnet') {
  const endpoint = `${GASLESS_API}/${network}`;
  const res = await axios.post(endpoint, transferPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data.txHash;
}

/**
 * Fetch supported tokens + their EIP-712 domain params
 * Call this once at startup and cache the result
 */
async function getSupportedTokens() {
  const res = await axios.get(`${GASLESS_API}/supported_tokens`);
  return res.data;
}

module.exports = { buildGaslessTransfer, submitGaslessTransfer, getSupportedTokens };
```

**Critical constraints:**
- `validBefore` window is **max 30 seconds** from current time — Kite enforces this strictly
- Each `nonce` is **single-use** — always use `ethers.randomBytes(32)` fresh per transfer
- `value` must be at least `minimum_transfer_amount` from `/supported_tokens`
- Get `eip712_name` and `eip712_version` from the `/supported_tokens` response, not hardcoded

**Testnet token from `/supported_tokens`:**
```json
{
  "address": "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9",
  "eip712_name": "PYUSD",
  "eip712_version": "1",
  "decimals": 18,
  "minimum_transfer_amount": "10000000000000000"
}
```

**Mainnet token:**
```json
{
  "address": "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e",
  "eip712_name": "Bridged USDC (Kite AI)",
  "eip712_version": "2",
  "decimals": 6,
  "minimum_transfer_amount": "10000"
}
```

### 5.5 x402 Checkout Endpoint

This makes SwiftCheckout native to the Kite agentic ecosystem. Any x402-compatible AI agent can discover and pay your checkout endpoint without human intervention.

```javascript
// src/middleware/x402.middleware.js

const axios = require('axios');

const FACILITATOR_URL = 'https://facilitator.pieverse.io';
// Kite testnet facilitator address: 0x12343e649e6b2b2b77649DFAb88f103c02F3C78b

/**
 * x402 middleware
 * No X-PAYMENT header → return 402 with payment requirements
 * X-PAYMENT present → verify with Pieverse facilitator → settle → proceed
 */
function x402Required({ amount, description, merchantName }) {
  return async (req, res, next) => {
    const paymentHeader = req.headers['x-payment'];

    if (!paymentHeader) {
      return res.status(402).json({
        error: 'X-PAYMENT header is required',
        accepts: [{
          scheme: 'gokite-aa',
          network: process.env.KITE_NETWORK,         // 'kite-testnet' or 'kite-mainnet'
          maxAmountRequired: amount,                  // in smallest unit
          resource: `${process.env.BASE_URL}${req.path}`,
          description,
          mimeType: 'application/json',
          outputSchema: {
            input: { discoverable: true, method: req.method, type: 'http' },
            output: {
              properties: {
                orderId:  { type: 'string' },
                txHash:   { type: 'string' },
                status:   { type: 'string' },
              },
              required: ['orderId', 'txHash', 'status'],
              type: 'object',
            },
          },
          payTo: process.env.VAULT_ADDRESS,
          maxTimeoutSeconds: 300,
          asset: process.env.USDC_ADDRESS,
          extra: null,
          merchantName,
        }],
        x402Version: 1,
      });
    }

    try {
      const paymentData = JSON.parse(
        Buffer.from(paymentHeader, 'base64').toString('utf8')
      );

      // Verify
      const verifyRes = await axios.post(`${FACILITATOR_URL}/v2/verify`, {
        authorization: paymentData.authorization,
        signature: paymentData.signature,
        network: process.env.KITE_NETWORK,
      });

      if (!verifyRes.data.valid) {
        return res.status(402).json({ error: 'Payment verification failed' });
      }

      // Settle on-chain
      await axios.post(`${FACILITATOR_URL}/v2/settle`, {
        authorization: paymentData.authorization,
        signature: paymentData.signature,
        network: process.env.KITE_NETWORK,
      });

      req.paymentVerified = true;
      req.paymentData = paymentData;
      next();
    } catch (err) {
      return res.status(402).json({ error: 'Payment failed', details: err.message });
    }
  };
}

module.exports = { x402Required };
```

**Usage in checkout route:**

```javascript
// src/routes/checkout.routes.js

const router = require('express').Router();
const { x402Required } = require('../middleware/x402.middleware');
const checkoutService = require('../services/checkout.service');

// Standard checkout — NGN bank transfer path (most common for West Africa)
router.post('/checkout/initiate', async (req, res) => {
  const { merchantId, ngnAmount } = req.body;
  const order = await checkoutService.createOrder(merchantId, ngnAmount);
  res.json({ orderId: order.id, qrData: order.qrData, ngnAmount });
});

// x402 checkout — direct USDC payment from Kite wallet
// AI agents can discover and pay this automatically (no human needed)
router.post(
  '/checkout/x402',
  x402Required({
    amount: '1000000',  // 1 USDC (6 decimals on mainnet)
    description: 'SwiftCheckout Merchant Payment — West Africa POS',
    merchantName: 'SwiftCheckout Protocol',
  }),
  async (req, res) => {
    const { merchantId, usdcAmount } = req.body;
    const txHash = await checkoutService.settleDirectUSDC(merchantId, usdcAmount);
    res.json({ orderId: req.paymentData.nonce, txHash, status: 'settled' });
  }
);

module.exports = router;
```

### 5.6 Kite Agent Passport

Your backend IS the agent. You register one Kite Passport for SwiftCheckout — this gives the settlement service a verifiable on-chain identity.

**Which mode to use:** Mode 2 (Developer as End User). You hold the passport, your customers don't need one. This is the aggregator/SaaS model.

```
MCP Config (for your backend when calling other Kite x402 services):
{
  "kite-passport-mcp": {
    "url": "https://neo.dev.gokite.ai/v1/mcp"
  }
}
```

**Setup steps:**
1. Go to `https://x402-portal-eight.vercel.app/`
2. Create a SwiftCheckout agent account
3. Get test tokens from `https://faucet.gokite.ai`
4. Create an Agent in the portal — note the Agent ID
5. This passport wallet becomes your `operatorWallet` in `kite.service.js`

**Note:** Mode 2 (SDK/API programmatic flow) is still "Coming Soon" in Kite docs. For the hackathon, set up the passport manually via the portal and use the operator wallet pattern already described above. The passport gives you the narrative — "SwiftCheckout is a Kite-registered settlement agent."

### 5.7 Multisig Vault Security

The vault `owner` should be a multisig in production. Kite has Ash Wallet (Safe fork) deployed natively.

```
Ash Wallet: https://wallet.ash.center/?network=kite

Recommended config:
- Vault owner:   2-of-3 multisig (you + 2 co-signers / hardware wallets)
- Operator:      single hot wallet (for automated settlements only)
- emergencyWithdraw: owner only → protected by multisig

Testnet setup:
1. Go to wallet.ash.center/?network=kite
2. MetaMask: Kite Testnet (RPC: https://rpc-testnet.gokite.ai, ChainID: 2368)
3. Create new Smart Account
4. Add 2-3 signers, set threshold to 2-of-3
5. Deploy (~0.11 KITE gas)
6. Use this multisig address as owner param in SwiftVault constructor
```

### 5.8 Yield Cron Job

```javascript
// src/services/yield.service.js

const { deployToYield } = require('./kite.service');

/**
 * Yield management cron — runs every hour
 * Deploys idle USDC above buffer to Lucid L-USDC
 */
async function runYieldCycle() {
  try {
    console.log('[YIELD] Running yield cycle...');
    const txHash = await deployToYield();
    if (txHash) {
      console.log('[YIELD] Deployed to Lucid:', txHash);
    } else {
      console.log('[YIELD] Nothing to deploy this cycle');
    }
  } catch (err) {
    console.error('[YIELD] Error in yield cycle:', err.message);
  }
}

// Start cron
setInterval(runYieldCycle, parseInt(process.env.YIELD_CHECK_INTERVAL_MS) || 3_600_000);

module.exports = { runYieldCycle };
```

---

## 6. Core Flows End-to-End

### 6.1 Onramp: NGN → Kite USDC

```
1. User submits: { kiteWalletAddress, ngnAmount, bankDetails }
2. Backend: getRate() → calculates USDC equivalent
3. Backend: generates orderId = uuid()
4. Backend: saves pending order to DB
5. Response: { orderId, bankTransferDetails: { bank, account, amount } }
6. User: makes NGN bank transfer to SwiftCheckout's Bitnob account
7. Bitnob: fires webhook → payment confirmed
8. Backend webhook:
   a. Match payment to orderId by reference
   b. Call kiteService.settleOnramp(orderId, userKiteAddress, usdcAmount, ngnAmount)
   c. Vault releases USDC to user's Kite wallet (on-chain tx)
   d. Update order status → 'settled'
9. User: USDC received on Kite chain ✓
```

### 6.2 Offramp: Kite USDC → NGN

```
1. User submits: { usdcAmount, bankAccountNumber, bankName, accountName }
2. Backend: generates orderId, saves order to DB
3. Response: { vaultAddress, orderId, ngnEstimate }
4. User: calls vault.initiateOfframp(orderId, usdcAmount) from Kite wallet
   OR (gasless path):
   - User signs EIP-3009 payload on frontend
   - Backend submits signed payload to gasless.gokite.ai
   - Kite relayer executes transfer to vault
5. Vault: emits OfframpInitiated event
6. Backend: listenForOfframps() picks up event
7. Backend: calls bitnobService.payoutNGN({
     reference: orderId,
     recipientName: accountName,
     accountNumber: bankAccountNumber,
     bankName,
     ngnAmount: calculatedNGN
   })
8. Bitnob: processes NGN payout to user's bank
9. User: receives NGN in bank account ✓
```

### 6.3 Checkout: Merchant POS Flow

```
FLOW A — Customer pays NGN bank transfer (primary for West Africa):
1. Merchant: opens app, generates QR code
   QR encodes: { merchantId, usdcAmount, orderId }
2. Customer: scans QR
3. Customer app: POST /checkout/initiate → gets NGN bank transfer details
4. Customer: makes NGN bank transfer to SwiftCheckout's Bitnob account
5. Bitnob: fires webhook
6. Backend: kiteService.settleCheckout(orderId, merchantAddress, usdc, ngn)
7. Vault: releases USDC to merchant's Kite wallet
8. Merchant: push notification "₦12,400 settled — USDC received" ✓

FLOW B — Customer pays directly from Kite wallet:
1. Customer: POST /checkout/x402 (no X-PAYMENT header)
2. Backend: returns 402 with payment requirements
3. Customer (or AI agent): signs payment via Kite Passport MCP → resends with X-PAYMENT
4. Backend: verifies with Pieverse facilitator → settles on-chain
5. Merchant: USDC received ✓
```

### 6.4 Yield: Idle Float → L-USDC → Aave v3

```
Automated (hourly cron):
1. Check vault.liquidBalance()
2. If liquidBalance > buffer (20% of total):
   → vault.deployToYield()
   → Lucid controller receives USDC
   → Lucid bridges 90% to Aave v3 on Arbitrum via LayerZero
   → SwiftVault receives L-USDC representing the yield position
3. When large settlement needed and liquidBalance < amount:
   → vault.recallFromYield(amount)
   → Lucid pulls from Aave + returns USDC to vault (JIT liquidity)
   → Proceed with settlement

Revenue:
  SwiftVault earns Aave v3 USDC yield on 80% of its float at all times
```

---

## 7. Environment Variables & Config

```env
# Kite Chain
KITE_RPC_URL=https://rpc-testnet.gokite.ai
KITE_NETWORK=kite-testnet
VAULT_ADDRESS=0x...
USDC_ADDRESS=0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9
OPERATOR_PRIVATE_KEY=0x...
DEPLOYER_PRIVATE_KEY=0x...

# Bitnob
BITNOB_API_URL=https://api.bitnob.co/api/v1
BITNOB_SECRET_KEY=sk_...
BITNOB_WEBHOOK_SECRET=whsec_...
BITNOB_CUSTOMER_ID=e22795d9-...

# App
BASE_URL=https://api.swiftcheckout.xyz
PORT=8080

# Fee config
FEE_RECIPIENT_ADDRESS=0x...
FEE_BPS=50

# Yield
YIELD_CHECK_INTERVAL_MS=3600000
BUFFER_BPS=2000
```

---

## 8. API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/onramp/initiate` | Start NGN → USDC, get bank transfer instructions |
| GET | `/onramp/status/:orderId` | Check onramp order status |
| POST | `/offramp/initiate` | Start USDC → NGN, get vault address + orderId |
| GET | `/offramp/status/:orderId` | Check offramp order status |
| POST | `/checkout/initiate` | Create merchant checkout order, get QR data |
| POST | `/checkout/x402` | x402-gated direct USDC checkout (AI agent compatible) |
| POST | `/merchant/register` | Register merchant wallet on vault (admin) |
| GET | `/vault/stats` | TVL, liquid balance, yield balance |
| GET | `/rate` | Current NGN/USDC exchange rate |
| POST | `/webhooks/bitnob` | Bitnob webhook receiver (internal — not public) |

---

## 9. Security Considerations

**Vault:**
- Vault `owner` → Ash multisig (2-of-3), never a single EOA in production
- `operator` → hot wallet, limited to `settleOnramp`, `settleCheckout`, `deployToYield` only
- `emergencyWithdraw` → multisig only
- `pause()` → owner can trigger immediately on anomaly

**EIP-3009 gasless:**
- `validBefore` window is max **30 seconds** — prevents replay
- Nonces are on-chain and single-use — always generate fresh `randomBytes(32)`
- Enforce minimum token balance at relayer level before accepting
- Rate limit per IP and per wallet address

**Bitnob webhook:**
- Always verify `x-bitnob-signature` with HMAC-SHA256 on **raw body**
- Idempotency check: verify order isn't already settled before processing
- Webhooks can fire more than once — your handler must be idempotent

**Operator key management:**
- Dedicated hot wallet for operator only — never the deployer key
- Rotate operator via `vault.setOperator()` (multisig action) if compromised
- Keep operator KITE balance monitored for gas

**x402:**
- Always verify with Pieverse facilitator before delivering service
- Validate `payTo` in the payment header matches your vault address
- `maxTimeoutSeconds: 300` → reject stale payment headers

**Liquidity risk:**
- Buffer threshold (20%) ensures vault can always settle immediately
- Lucid's JIT liquidity pulls from Aave if buffer runs low
- Monitor vault TVL and alert if liquid balance drops below 15%

---

## 10. Hackathon Submission Notes

### Narrative for Judges

> "SwiftCheckout is an autonomous settlement agent on Kite chain. The backend holds a Kite Passport identity and operates a yield-bearing USDC vault — the first and only NGN ↔ Kite USDC corridor in West Africa. It autonomously bridges Bitnob's fiat rails with Kite chain settlement, processing onramp, offramp, and POS checkout flows without human intervention. Idle vault float earns yield via Lucid L-USDC (Aave v3). Every merchant checkout is also available as an x402 endpoint, making it discoverable and payable by any AI agent in the Kite ecosystem."

### Demo Script (90 seconds)

1. **Onramp** — "I have ₦50,000. I want USDC on Kite. I transfer to this account number. [8 seconds later] USDC lands in my Kite wallet. Here's the on-chain receipt."
2. **Checkout** — "I'm at a Lagos restaurant. Merchant shows QR. I pay ₦3,500 via my bank app. [show Kite explorer tx] Merchant received USDC. Zero crypto UX on either side."
3. **Yield** — "The vault's idle float is deployed to Lucid right now, earning Aave v3 yield. It auto-recalls when settlements are needed. The protocol pays for itself."

### Deploy Checklist

- [ ] SwiftVault.sol deployed on Kite testnet
- [ ] Vault funded with testnet PYUSD (from faucet)
- [ ] Backend deployed (Railway / Render / Fly.io)
- [ ] Bitnob sandbox credentials configured
- [ ] Bitnob webhook URL set and verified
- [ ] At least one merchant wallet registered on vault
- [ ] Kite Passport created at `https://x402-portal-eight.vercel.app/`
- [ ] x402 checkout endpoint live and returning 402 correctly
- [ ] Demo video showing all 3 flows

### Key Contract Addresses (fill in after deploy)

| Contract | Address |
|---|---|
| SwiftVault (testnet) | `0x...` |
| PYUSD testnet | `0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9` |
| Lucid Controller | `0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b` |
| Ash Multisig (testnet) | `0x...` |
| Kite Testnet Facilitator | `0x12343e649e6b2b2b77649DFAb88f103c02F3C78b` |

---

*SwiftCheckout — The invisible stablecoin POS for West Africa.*  
*Built for the Kite Hackathon: AI Agentic Economy (Encode Club)*
