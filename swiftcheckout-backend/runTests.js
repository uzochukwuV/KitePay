#!/usr/bin/env node

/**
 * Test Runner for SwiftCheckout Backend
 * Usage: node runTests.js [test-name]
 * 
 * Available tests:
 *   - functions     : Test all kiteService functions (test_recall.js)
 *   - webhook       : Test webhooks and API validation (test_webhook.js)
 *   - integration   : Full end-to-end testnet suite (testIntegration.js)
 *   - all           : Run all tests sequentially
 * 
 * Examples:
 *   node runTests.js functions
 *   node runTests.js webhook
 *   node runTests.js all
 */

const { execSync } = require('child_process');
const path = require('path');

const tests = {
  functions: {
    file: 'test_recall.js',
    description: 'Test all kiteService functions and exports',
    requiresServer: false,
    requiresEnv: false
  },
  webhook: {
    file: 'test_webhook.js',
    description: 'Test webhooks and API validation',
    requiresServer: true,
    requiresEnv: false
  },
  integration: {
    file: 'testIntegration.js',
    description: 'Full end-to-end testnet suite',
    requiresServer: false,
    requiresEnv: true
  }
};

function printUsage() {
  console.log('\n========================================');
  console.log('SwiftCheckout Test Runner');
  console.log('========================================\n');
  console.log('Usage: node runTests.js [test-name]\n');
  console.log('Available tests:\n');
  
  Object.entries(tests).forEach(([name, config]) => {
    console.log(`  ${name.padEnd(15)} - ${config.description}`);
    if (config.requiresServer) {
      console.log(`                   ${'   ⚠️  Requires backend running on port 8080'.padStart(0)}`);
    }
    if (config.requiresEnv) {
      console.log(`                   ${'   ⚠️  Requires .env with VAULT_ADDRESS and OPERATOR_PRIVATE_KEY'.padStart(0)}`);
    }
    console.log('');
  });
  
  console.log('  all             - Run all tests sequentially\n');
  console.log('Examples:');
  console.log('  node runTests.js functions');
  console.log('  node runTests.js webhook');
  console.log('  node runTests.js all\n');
}

function checkEnv(testName) {
  const config = tests[testName];
  if (!config) return false;

  if (config.requiresEnv) {
    const requiredVars = ['VAULT_ADDRESS', 'OPERATOR_PRIVATE_KEY', 'USDC_ADDRESS'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error(`\n❌ Missing required environment variables for ${testName} test:`);
      missing.forEach(varName => console.error(`   - ${varName}`));
      console.error('\nPlease create a .env file with these variables.');
      console.error('See .env.example for reference.\n');
      return false;
    }
  }

  return true;
}

function runTest(testName) {
  const config = tests[testName];
  if (!config) {
    console.error(`\n❌ Unknown test: ${testName}\n`);
    printUsage();
    return false;
  }

  console.log('\n========================================');
  console.log(`Running: ${config.description}`);
  console.log(`File: ${config.file}`);
  console.log('========================================\n');

  if (config.requiresServer) {
    console.log('⚠️  This test requires the backend server to be running on port 8080');
    console.log('   Start it with: npm start\n');
  }

  if (!checkEnv(testName)) {
    return false;
  }

  try {
    const testFile = path.join(__dirname, config.file);
    execSync(`node "${testFile}"`, {
      stdio: 'inherit',
      env: process.env,
      cwd: __dirname
    });
    return true;
  } catch (error) {
    console.error(`\n❌ Test ${testName} failed with exit code ${error.status}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🚀 Running ALL tests sequentially...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  for (const [testName, config] of Object.entries(tests)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST SUITE: ${testName.toUpperCase()}`);
    console.log('='.repeat(60));
    
    const success = runTest(testName);
    results.tests.push({ name: testName, success });
    
    if (success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('OVERALL TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}/${results.tests.length}`);
  console.log(`❌ Failed: ${results.failed}/${results.tests.length}`);
  console.log('='.repeat(60) + '\n');

  if (results.failed > 0) {
    console.log('⚠️  Some test suites failed. Review the output above.\n');
    process.exit(1);
  } else {
    console.log('🎉 All test suites passed!\n');
    process.exit(0);
  }
}

// Main execution
const testName = process.argv[2];

if (!testName || testName === '--help' || testName === '-h') {
  printUsage();
  process.exit(testName ? 0 : 1);
}

if (testName === 'all') {
  runAllTests();
} else {
  const success = runTest(testName);
  process.exit(success ? 0 : 1);
}
