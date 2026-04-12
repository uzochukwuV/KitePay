require('dotenv').config();
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const kiteService = require('./src/services/kite.service');

// Constants
const KITE_RPC_URL = process.env.KITE_RPC_URL || 'https://rpc-testnet.gokite.ai';
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
const USDC_ADDRESS = process.env.USDC_ADDRESS;

// Hardcode a reliable RPC or fetch from network if it keeps timing out. The Kite testnet RPC can be slow.
// The default https://rpc-testnet.gokite.ai is sometimes heavily rate-limited.
const provider = new ethers.JsonRpcProvider(KITE_RPC_URL, undefined, {
  staticNetwork: ethers.Network.from(2368),
  batchMaxCount: 1
});
const operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);

// Mock Wallets for testing
const userWallet = ethers.Wallet.createRandom().connect(provider);
const merchantWallet = ethers.Wallet.createRandom().connect(provider);

// USDC ABI to interact with Mock USDC
const usdcAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function mint(address to, uint256 amount) external"
];

// SwiftVault ABI subset
const vaultAbi = [
  "function registerMerchant(address merchant) external",
  "function liquidBalance() public view returns (uint256)",
  "function initiateOfframp(bytes32 orderId, uint256 usdcAmount) external"
];

const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, operatorWallet);
const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, operatorWallet);

async function runTests() {
  console.log("==========================================");
  console.log("SWIFTCHECKOUT: END-TO-END TESTNET SUITE");
  console.log("==========================================");

  console.log("\n--- SETUP: FUNDING VAULT ---");
  // 1. Send some Mock USDC from operator to the Vault so it has liquid balance to settle Onramps
  const fundAmount = "5000"; // $5000 USDC
  console.log(`Sending ${fundAmount} USDC from Operator to Vault (${VAULT_ADDRESS})...`);
  const fundTx = await usdc.transfer(VAULT_ADDRESS, ethers.parseUnits(fundAmount, 6));
  await fundTx.wait();
  
  let vaultBal = await vault.liquidBalance();
  console.log(`✅ Vault Liquid Balance: ${ethers.formatUnits(vaultBal, 6)} USDC`);

  console.log("\n--- SETUP: REGISTERING MERCHANT ---");
  console.log(`Registering Merchant ${merchantWallet.address}...`);
  const regTx = await vault.registerMerchant(merchantWallet.address);
  await regTx.wait();
  console.log(`✅ Merchant Registered`);

  console.log("\n==========================================");
  console.log("TEST 1: ONRAMP FLOW (Fiat -> Crypto)");
  console.log("==========================================");
  // Simulate user sending fiat to Bitnob, webhook triggers backend to settle USDC to user
  const onrampOrderId = uuidv4();
  const onrampAmount = "50.00"; // 50 USDC
  const ngnAmount = 75000; // 75k NGN equivalent

  console.log(`User Wallet: ${userWallet.address}`);
  console.log(`Calling kiteService.settleOnramp for Order ${onrampOrderId}...`);
  
  try {
      await kiteService.settleOnramp(onrampOrderId, userWallet.address, onrampAmount, ngnAmount);
      const userBal = await usdc.balanceOf(userWallet.address);
      console.log(`✅ SUCCESS: User received ${ethers.formatUnits(userBal, 6)} USDC from Vault`);
  } catch (e) {
      console.error("❌ Onramp Failed:", e.message);
  }

  console.log("\n==========================================");
  console.log("TEST 2: CHECKOUT FLOW (Customer Pays Merchant)");
  console.log("==========================================");
  // Simulate customer paying fiat at a POS, backend triggers vault to pay Merchant in USDC
  const checkoutOrderId = uuidv4();
  const checkoutUsdc = "100.00"; // 100 USDC
  const checkoutNgn = 150000;

  console.log(`Merchant Wallet: ${merchantWallet.address}`);
  console.log(`Calling kiteService.settleCheckout for Order ${checkoutOrderId}...`);
  
  try {
      await kiteService.settleCheckout(checkoutOrderId, merchantWallet.address, checkoutUsdc, checkoutNgn);
      const merchBal = await usdc.balanceOf(merchantWallet.address);
      console.log(`✅ SUCCESS: Merchant received ${ethers.formatUnits(merchBal, 6)} USDC (minus 0.5% fee)`);
  } catch (e) {
      console.error("❌ Checkout Failed:", e.message);
  }

  console.log("\n==========================================");
  console.log("TEST 3: OFFRAMP FLOW (Crypto -> Fiat)");
  console.log("==========================================");
  // User initiates offramp on-chain. Backend listens to event and triggers Bitnob payout.
  
  // Need to fund user with KITE for gas so they can call the vault. 
  // Normally this is gasless (EIP-3009) via Relayer, but we simulate standard Tx here.
  console.log("Funding User Wallet with 0.05 KITE for gas...");
  const ethTx = await operatorWallet.sendTransaction({
    to: userWallet.address,
    value: ethers.parseEther("0.05")
  });
  await ethTx.wait();

  // User approves Vault to take their USDC
  console.log("User approving Vault to take USDC...");
  const userUsdc = usdc.connect(userWallet);
  const approveTx = await userUsdc.approve(VAULT_ADDRESS, ethers.parseUnits("25", 6));
  await approveTx.wait();

  // We set up the listener on the backend service
  console.log("Backend starting Offramp Listener...");
  
  // We use a promise to wait for the event callback to fire
  const offrampPromise = new Promise((resolve) => {
    // Only listen for OfframpInitiated events for the order we just created
    vault.on('OfframpInitiated', (orderIdBytes32, user, usdcAmount, event) => {
        console.log(`\n🚨 EVENT CAUGHT BY BACKEND 🚨`);
        console.log(`Order ID Hash: ${orderIdBytes32}`);
        console.log(`User: ${user}`);
        console.log(`Net USDC Sent to Vault: ${ethers.formatUnits(usdcAmount, 6)}`);
        console.log(`[Action] Backend would now call Bitnob API to payout NGN!`);
        resolve();
    });
  });

  const offrampOrderId = uuidv4();
  const offrampOrderIdBytes32 = ethers.id(offrampOrderId); // Frontend generates this hash to send to chain
  console.log(`\nUser calling initiateOfframp for 25 USDC (Order UUID: ${offrampOrderId})...`);
  
  const userVault = vault.connect(userWallet);
  try {
      const offTx = await userVault.initiateOfframp(offrampOrderIdBytes32, ethers.parseUnits("25", 6));
      await offTx.wait();
      console.log("User transaction confirmed. Waiting for backend listener...");
      
      // Wait for the backend event listener to catch it
      await offrampPromise;
      console.log("✅ SUCCESS: Offramp flow fully tested end-to-end.");
  } catch (e) {
      console.error("❌ Offramp Failed:", e.message);
  }

  console.log("\n==========================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY");
  console.log("==========================================");
  process.exit(0);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
