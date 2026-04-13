require('dotenv').config();
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const kiteService = require('./src/services/kite.service');

// Constants
const KITE_RPC_URL = process.env.KITE_RPC_URL || 'https://rpc-testnet.gokite.ai';
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
const USDC_ADDRESS = process.env.USDC_ADDRESS;
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

if (!OPERATOR_PRIVATE_KEY || !VAULT_ADDRESS || !USDC_ADDRESS) {
  console.error("❌ Missing required environment variables!");
  console.error("Please set in .env:");
  console.error("  - OPERATOR_PRIVATE_KEY");
  console.error("  - VAULT_ADDRESS");
  console.error("  - USDC_ADDRESS");
  console.error("  - KITE_RPC_URL (optional, defaults to testnet)");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(KITE_RPC_URL, undefined, {
  staticNetwork: ethers.Network.from(2368),
  batchMaxCount: 1
});
const operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);

// USDC ABI
const usdcAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function mint(address to, uint256 amount) external",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// SwiftVault ABI
const vaultAbi = [
  "function registerMerchant(address merchant) external",
  "function merchants(address) public view returns (bool)",
  "function settleOnramp(bytes32 orderId, address user, uint256 usdcAmount, uint256 ngnAmount) external",
  "function settleCheckout(bytes32 orderId, address merchant, uint256 usdcAmount, uint256 ngnAmount) external",
  "function liquidBalance() public view returns (uint256)",
  "function totalTVL() public view returns (uint256)",
  "function initiateOfframp(bytes32 orderId, uint256 usdcAmount) external",
  "function isOrderSettled(bytes32) public view returns (bool)"
];

const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, operatorWallet);
const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, operatorWallet);

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${name}: ${status}`);
  if (details) console.log(`   → ${details}`);
  
  testResults.tests.push({ name, status, details });
  if (status === 'PASS') {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function waitForTransaction(tx) {
  console.log(`   ⏳ Waiting for transaction: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`   ✓ Confirmed in block ${receipt.blockNumber}`);
  return receipt;
}

async function queryBackend(endpoint) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

async function runTests() {
  console.log("==========================================");
  console.log("SWIFTCHECKOUT: END-TO-END TESTNET SUITE");
  console.log("==========================================");
  console.log(`\nNetwork: Kite Testnet (Chain ID: 2368)`);
  console.log(`Vault: ${VAULT_ADDRESS}`);
  console.log(`USDC: ${USDC_ADDRESS}`);
  console.log(`Operator: ${operatorWallet.address}`);
  console.log(`Backend: ${BASE_URL}\n`);

  // Pre-flight checks
  console.log("--- PRE-FLIGHT CHECKS ---");
  
  try {
    const operatorBalance = await provider.getBalance(operatorWallet.address);
    console.log(`✅ Operator ETH Balance: ${ethers.formatEther(operatorBalance)} KITE`);
    
    if (operatorBalance < ethers.parseEther("0.01")) {
      console.error("❌ Operator balance too low! Need at least 0.01 KITE for gas.");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Failed to get operator balance:", error.message);
    process.exit(1);
  }

  try {
    const vaultStats = await kiteService.getVaultStats();
    console.log(`✅ Vault connected - TVL: ${vaultStats.totalTVL} USDC`);
    console.log(`   Liquid: ${vaultStats.liquidBalance}, Yield: ${vaultStats.yieldBalance}`);
  } catch (error) {
    console.error("❌ Cannot connect to vault:", error.message);
    process.exit(1);
  }

  console.log("\n==========================================");
  console.log("TEST 1: MERCHANT REGISTRATION");
  console.log("==========================================");
  
  const merchantWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`\nNew merchant wallet: ${merchantWallet.address}`);

  // Test via backend API
  console.log("\n1.1 Registering merchant via backend API...");
  try {
    const response = await axios.post(`${BASE_URL}/api/merchant/register`, {
      merchantWallet: merchantWallet.address
    });
    
    if (response.data.success) {
      logTest('Merchant registration via API', 'PASS', `TX: ${response.data.txHash}`);
    } else {
      logTest('Merchant registration via API', 'FAIL', response.data.error);
    }
  } catch (error) {
    logTest('Merchant registration via API', 'FAIL', error.response?.data?.error || error.message);
  }

  // Verify merchant is registered
  console.log("\n1.2 Verifying merchant registration...");
  try {
    const merchantInfo = await queryBackend(`/api/merchant/${merchantWallet.address}`);
    if (merchantInfo.success && merchantInfo.data.isRegistered) {
      logTest('Merchant verification', 'PASS', 'Merchant is registered on-chain');
    } else {
      logTest('Merchant verification', 'FAIL', 'Merchant not found');
    }
  } catch (error) {
    logTest('Merchant verification', 'FAIL', error.message);
  }

  console.log("\n==========================================");
  console.log("TEST 2: FUNDING VAULT");
  console.log("==========================================");
  
  const fundAmount = "5000";
  console.log(`\nSending ${fundAmount} USDC to vault...`);
  
  try {
    const vaultBalBefore = await vault.liquidBalance();
    const fundTx = await usdc.transfer(VAULT_ADDRESS, ethers.parseUnits(fundAmount, 6));
    await waitForTransaction(fundTx);
    
    const vaultBalAfter = await vault.liquidBalance();
    const actualFunded = ethers.formatUnits(vaultBalAfter - vaultBalBefore, 6);
    
    logTest('Vault funding', 'PASS', `Funded ${actualFunded} USDC`);
    console.log(`✅ Vault Liquid Balance: ${ethers.formatUnits(vaultBalAfter, 6)} USDC`);
  } catch (error) {
    logTest('Vault funding', 'FAIL', error.message);
    console.error("❌ Cannot proceed without funded vault");
    process.exit(1);
  }

  console.log("\n==========================================");
  console.log("TEST 3: ONRAMP FLOW (Fiat -> Crypto)");
  console.log("==========================================");
  
  const userWallet = ethers.Wallet.createRandom().connect(provider);
  const onrampOrderId = uuidv4();
  const onrampAmount = "50.00";
  const ngnAmount = 75000;

  console.log(`\nUser Wallet: ${userWallet.address}`);
  console.log(`Order ID: ${onrampOrderId}`);
  console.log(`Amount: ${onrampAmount} USDC (${ngnAmount} NGN)`);

  try {
    console.log("\nCalling kiteService.settleOnramp...");
    const txHash = await kiteService.settleOnramp(onrampOrderId, userWallet.address, onrampAmount, ngnAmount);
    
    const userBal = await usdc.balanceOf(userWallet.address);
    const formattedBal = ethers.formatUnits(userBal, 6);
    
    if (userBal > 0) {
      logTest('Onramp settlement', 'PASS', `User received ${formattedBal} USDC | TX: ${txHash}`);
    } else {
      logTest('Onramp settlement', 'FAIL', 'User balance is still 0');
    }
  } catch (error) {
    logTest('Onramp settlement', 'FAIL', error.reason || error.message);
  }

  // Query backend to verify order was created
  console.log("\n3.1 Checking order in backend...");
  // Note: Order won't be in backend unless created via API first
  // This is just to test the query endpoint
  const orderCheck = await queryBackend(`/api/order/${onrampOrderId}`);
  if (!orderCheck.success) {
    console.log(`   ℹ️  Order not in backend (expected - created directly on-chain)`);
  }

  console.log("\n==========================================");
  console.log("TEST 4: CHECKOUT FLOW (Customer Pays Merchant)");
  console.log("==========================================");
  
  const checkoutOrderId = uuidv4();
  const checkoutUsdc = "100.00";
  const checkoutNgn = 150000;

  console.log(`\nMerchant Wallet: ${merchantWallet.address}`);
  console.log(`Order ID: ${checkoutOrderId}`);
  console.log(`Amount: ${checkoutUsdc} USDC (${checkoutNgn} NGN)`);

  try {
    const merchBalBefore = await usdc.balanceOf(merchantWallet.address);
    console.log(`\nMerchant balance before: ${ethers.formatUnits(merchBalBefore, 6)} USDC`);

    console.log("\nCalling kiteService.settleCheckout...");
    const txHash = await kiteService.settleCheckout(checkoutOrderId, merchantWallet.address, checkoutUsdc, checkoutNgn);
    
    const merchBalAfter = await usdc.balanceOf(merchantWallet.address);
    const received = ethers.formatUnits(merchBalAfter - merchBalBefore, 6);
    
    // Calculate expected amount (minus 0.5% fee)
    const expectedNet = parseFloat(checkoutUsdc) * 0.995;
    
    logTest('Checkout settlement', 'PASS', `Merchant received ${received} USDC (expected ~${expectedNet}) | TX: ${txHash}`);
  } catch (error) {
    logTest('Checkout settlement', 'FAIL', error.reason || error.message);
  }

  console.log("\n==========================================");
  console.log("TEST 5: OFFRAMP FLOW (Crypto -> Fiat)");
  console.log("==========================================");
  
  // Fund user with KITE for gas
  console.log("\n5.1 Funding user wallet with KITE for gas...");
  try {
    const ethTx = await operatorWallet.sendTransaction({
      to: userWallet.address,
      value: ethers.parseEther("0.05")
    });
    await waitForTransaction(ethTx);
    console.log(`✅ User funded with 0.05 KITE`);
  } catch (error) {
    logTest('User funding', 'FAIL', error.message);
  }

  // User approves vault
  console.log("\n5.2 User approving vault to spend USDC...");
  const userUsdc = usdc.connect(userWallet);
  const userVault = vault.connect(userWallet);
  
  try {
    const approveAmount = "25";
    const approveTx = await userUsdc.approve(VAULT_ADDRESS, ethers.parseUnits(approveAmount, 6));
    await waitForTransaction(approveTx);
    
    const allowance = await userUsdc.allowance(userWallet.address, VAULT_ADDRESS);
    logTest('USDC approval', 'PASS', `Approved ${ethers.formatUnits(allowance, 6)} USDC`);
  } catch (error) {
    logTest('USDC approval', 'FAIL', error.message);
  }

  // Set up backend listener
  console.log("\n5.3 Starting backend offramp listener...");
  let offrampDetected = false;
  let backendListenerError = null;

  try {
    kiteService.listenForOfframps((offrampData) => {
      console.log(`\n🚨 OFFRAMP EVENT DETECTED BY BACKEND 🚨`);
      console.log(`   Order ID: ${offrampData.orderId}`);
      console.log(`   User: ${offrampData.user}`);
      console.log(`   USDC Amount: ${offrampData.usdcAmount}`);
      console.log(`   [Action] Backend would call Bitnob API for NGN payout`);
      offrampDetected = true;
    });
    console.log("✅ Backend listener started");
  } catch (error) {
    backendListenerError = error;
    console.error("❌ Failed to start backend listener:", error.message);
  }

  // User initiates offramp
  console.log("\n5.4 User initiating offramp on-chain...");
  const offrampOrderId = uuidv4();
  const offrampOrderIdBytes32 = ethers.id(offrampOrderId);
  const offrampAmount = "25";

  console.log(`   Order UUID: ${offrampOrderId}`);
  console.log(`   Amount: ${offrampAmount} USDC`);

  try {
    const offTx = await userVault.initiateOfframp(offrampOrderIdBytes32, ethers.parseUnits(offrampAmount, 6));
    await waitForTransaction(offTx);
    
    logTest('Offramp initiation', 'PASS', `TX: ${offTx.hash}`);
    
    // Wait a bit for backend to detect event
    console.log("\n   ⏳ Waiting 10 seconds for backend to detect event...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    if (offrampDetected) {
      logTest('Backend event detection', 'PASS', 'Backend successfully detected offramp event');
    } else if (backendListenerError) {
      logTest('Backend event detection', 'FAIL', backendListenerError.message);
    } else {
      logTest('Backend event detection', 'FAIL', 'Event not detected (may need more time)');
    }
  } catch (error) {
    logTest('Offramp initiation', 'FAIL', error.reason || error.message);
  }

  console.log("\n==========================================");
  console.log("TEST 6: QUERY ENDPOINTS");
  console.log("==========================================");

  // Test vault stats
  console.log("\n6.1 Querying vault stats...");
  const vaultStatsResult = await queryBackend('/api/vault/stats');
  if (vaultStatsResult.success) {
    const stats = vaultStatsResult.data;
    logTest('Vault stats query', 'PASS', `TVL: ${stats.totalTVL}, Fee: ${stats.feePercentage}`);
  } else {
    logTest('Vault stats query', 'FAIL', vaultStatsResult.error);
  }

  // Test merchant info
  console.log("\n6.2 Querying merchant info...");
  const merchantResult = await queryBackend(`/api/merchant/${merchantWallet.address}`);
  if (merchantResult.success) {
    logTest('Merchant info query', 'PASS', `Registered: ${merchantResult.data.isRegistered}`);
  } else {
    logTest('Merchant info query', 'FAIL', merchantResult.error);
  }

  // Test token balance
  console.log("\n6.3 Querying token balance...");
  const balanceResult = await queryBackend(`/api/balance/${USDC_ADDRESS}/${userWallet.address}`);
  if (balanceResult.success) {
    const bal = balanceResult.data;
    logTest('Token balance query', 'PASS', `${bal.symbol}: ${bal.balance}`);
  } else {
    logTest('Token balance query', 'FAIL', balanceResult.error);
  }

  // Test all orders
  console.log("\n6.4 Querying all orders...");
  const ordersResult = await queryBackend('/api/admin/orders');
  if (ordersResult.success) {
    logTest('All orders query', 'PASS', `Total: ${ordersResult.data.total}`);
  } else {
    logTest('All orders query', 'FAIL', ordersResult.error);
  }

  console.log("\n==========================================");
  console.log("TEST 7: ON-CHAIN ORDER STATUS");
  console.log("==========================================");

  // Check if checkout order is settled on-chain
  console.log("\n7.1 Checking if checkout order is settled on-chain...");
  try {
    const namespacedOrderId = ethers.keccak256(
      ethers.solidityPacked(["string", "string"], ["CHECKOUT", checkoutOrderId])
    );
    const isSettled = await vault.isOrderSettled(namespacedOrderId);
    
    logTest('On-chain order status', isSettled ? 'PASS' : 'FAIL', `Settled: ${isSettled}`);
  } catch (error) {
    logTest('On-chain order status', 'FAIL', error.message);
  }

  // Summary
  console.log("\n==========================================");
  console.log("FINAL TEST SUMMARY");
  console.log("==========================================");
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total:  ${testResults.passed + testResults.failed}`);
  console.log("==========================================\n");

  if (testResults.failed > 0) {
    console.log("⚠️  Some tests failed. Review the output above.");
    console.log("\nCommon issues:");
    console.log("  - Insufficient vault liquidity");
    console.log("  - RPC rate limiting (try again or use different RPC)");
    console.log("  - Backend not running (start with: npm start)");
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED! SwiftCheckout is working correctly.");
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
