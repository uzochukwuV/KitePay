require('dotenv').config();
const kiteService = require('./src/services/kite.service');

/**
 * Comprehensive test for kiteService query and mutation functions
 * Tests all exported functions to ensure they're correctly structured
 */

const tests = {
  passed: 0,
  failed: 0,
  results: []
};

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${name}: ${status}`);
  if (details) console.log(`   → ${details}`);
  
  tests.results.push({ name, status, details });
  if (status === 'PASS') {
    tests.passed++;
  } else {
    tests.failed++;
  }
}

async function testRecall() {
  console.log("==========================================");
  console.log("KITE SERVICE FUNCTION TESTS");
  console.log("==========================================\n");

  // Test 1: Check all mutation functions are exported
  console.log("--- Mutation Functions ---");
  
  const mutationFunctions = [
    'settleOnramp',
    'settleCheckout',
    'registerMerchant',
    'deployToYield',
    'recallFromYield'
  ];

  for (const funcName of mutationFunctions) {
    const isExported = typeof kiteService[funcName] === 'function';
    logTest(
      funcName,
      isExported ? 'PASS' : 'FAIL',
      isExported ? 'Function exported correctly' : 'Function not found'
    );
  }

  // Test 2: Check all query functions are exported
  console.log("\n--- Query Functions ---");
  
  const queryFunctions = [
    'isMerchantRegistered',
    'getVaultStats',
    'isOrderSettledOnChain',
    'getMerchantInfo',
    'getTokenBalance',
    'listenForOfframps'
  ];

  for (const funcName of queryFunctions) {
    const isExported = typeof kiteService[funcName] === 'function';
    logTest(
      funcName,
      isExported ? 'PASS' : 'FAIL',
      isExported ? 'Function exported correctly' : 'Function not found'
    );
  }

  // Test 3: Test function signatures
  console.log("\n--- Function Signatures ---");

  // settleOnramp should accept 4 parameters
  const settleOnrampParams = kiteService.settleOnramp.length;
  logTest(
    'settleOnramp parameters',
    settleOnrampParams === 4 ? 'PASS' : 'FAIL',
    `Expected 4 params, got ${settleOnrampParams}`
  );

  // settleCheckout should accept 4 parameters
  const checkoutParams = kiteService.settleCheckout.length;
  logTest(
    'settleCheckout parameters',
    checkoutParams === 4 ? 'PASS' : 'FAIL',
    `Expected 4 params, got ${checkoutParams}`
  );

  // registerMerchant should accept 1 parameter
  const registerParams = kiteService.registerMerchant.length;
  logTest(
    'registerMerchant parameters',
    registerParams === 1 ? 'PASS' : 'FAIL',
    `Expected 1 param, got ${registerParams}`
  );

  // getVaultStats should accept 0 parameters
  const statsParams = kiteService.getVaultStats.length;
  logTest(
    'getVaultStats parameters',
    statsParams === 0 ? 'PASS' : 'FAIL',
    `Expected 0 params, got ${statsParams}`
  );

  // Test 4: Check if we can actually call query functions (requires env setup)
  console.log("\n--- Live Function Tests (requires ENV) ---");

  const hasEnv = process.env.VAULT_ADDRESS && process.env.OPERATOR_PRIVATE_KEY;

  if (!hasEnv) {
    console.log("⚠️  Skipping live tests (no VAULT_ADDRESS or OPERATOR_PRIVATE_KEY)");
    console.log("   Set these in .env to run full tests\n");
  } else {
    try {
      console.log("Testing getVaultStats()...");
      const stats = await kiteService.getVaultStats();
      logTest('getVaultStats execution', 'PASS', `TVL: ${stats.totalTVL}, Liquid: ${stats.liquidBalance}`);
    } catch (error) {
      logTest('getVaultStats execution', 'FAIL', error.message);
    }

    try {
      console.log("\nTesting getMerchantInfo() with zero address...");
      const merchantInfo = await kiteService.getMerchantInfo('0x0000000000000000000000000000000000000000');
      logTest('getMerchantInfo execution', 'PASS', `Registered: ${merchantInfo.isRegistered}`);
    } catch (error) {
      logTest('getMerchantInfo execution', 'FAIL', error.message);
    }

    try {
      console.log("\nTesting isOrderSettledOnChain()...");
      const isSettled = await kiteService.isOrderSettledOnChain('test-order-123', 'ONRAMP');
      logTest('isOrderSettledOnChain execution', 'PASS', `Settled: ${isSettled}`);
    } catch (error) {
      logTest('isOrderSettledOnChain execution', 'FAIL', error.message);
    }
  }

  // Summary
  console.log("\n==========================================");
  console.log("TEST SUMMARY");
  console.log("==========================================");
  console.log(`✅ Passed: ${tests.passed}`);
  console.log(`❌ Failed: ${tests.failed}`);
  console.log(`📊 Total:  ${tests.passed + tests.failed}`);
  console.log("==========================================\n");

  if (tests.failed > 0) {
    console.log("⚠️  Some tests failed. Check the output above.");
    process.exit(1);
  } else {
    console.log("✅ All tests passed!");
    process.exit(0);
  }
}

testRecall().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
