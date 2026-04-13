require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuration
const WEBHOOK_SECRET = process.env.BITNOB_WEBHOOK_SECRET || "whsec_test_secret_for_hackathon";
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/bitnob`;

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${name}: ${status}`);
  if (details) console.log(`   → ${details}`);
  
  results.tests.push({ name, status, details });
  if (status === 'PASS') {
    results.passed++;
  } else {
    results.failed++;
  }
}

function generateSignature(payload) {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');
}

async function sendWebhook(eventPayload, customSignature = null) {
  const payloadString = JSON.stringify(eventPayload);
  const signature = customSignature || generateSignature(payloadString);

  try {
    const res = await axios.post(WEBHOOK_URL, payloadString, {
      headers: {
        'Content-Type': 'application/json',
        'x-bitnob-signature': signature,
      }
    });
    return { success: true, status: res.status, data: res.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status, 
      data: error.response?.data || error.message 
    };
  }
}

async function createTestOrder(type = 'onramp') {
  try {
    const orderId = uuidv4();
    const orderData = {
      type,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    if (type === 'onramp') {
      orderData.kiteWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      orderData.ngnAmount = 50000;
      orderData.usdcAmount = 33.33;
    } else if (type === 'checkout') {
      orderData.merchantKiteWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      orderData.ngnAmount = 75000;
      orderData.usdcAmount = 50.00;
    } else if (type === 'offramp') {
      orderData.usdcAmount = 100;
      orderData.ngnAmount = 150000;
      orderData.bankDetails = {
        accountNumber: '1234567890',
        bankName: 'Test Bank',
        accountName: 'Test User'
      };
    }

    // Store order via API
    let endpoint;
    let payload;
    
    if (type === 'onramp') {
      endpoint = `${BASE_URL}/api/onramp/initiate`;
      payload = { kiteWallet: orderData.kiteWallet, ngnAmount: orderData.ngnAmount };
    } else if (type === 'checkout') {
      endpoint = `${BASE_URL}/api/checkout/initiate`;
      payload = { merchantKiteWallet: orderData.merchantKiteWallet, ngnAmount: orderData.ngnAmount };
    } else {
      endpoint = `${BASE_URL}/api/offramp/initiate`;
      payload = {
        usdcAmount: orderData.usdcAmount,
        bankAccountNumber: orderData.bankDetails.accountNumber,
        bankName: orderData.bankDetails.bankName,
        accountName: orderData.bankDetails.accountName
      };
    }

    const response = await axios.post(endpoint, payload);
    return { success: true, orderId: response.data.orderId, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

async function runTests() {
  console.log("==========================================");
  console.log("WEBHOOK & API TESTS");
  console.log("==========================================\n");

  // Test 1: Valid webhook signature
  console.log("--- Webhook Signature Tests ---");
  
  const mockEvent = {
    event: "payment.received",
    data: {
      reference: "test_order_123",
      amount: "50000",
      currency: "NGN",
      timestamp: new Date().toISOString()
    }
  };

  console.log("\n1. Testing valid webhook signature...");
  const res1 = await sendWebhook(mockEvent);
  logTest(
    'Valid webhook signature',
    res1.success ? 'PASS' : 'FAIL',
    res1.success ? `Status: ${res1.status}` : res1.data
  );

  // Test 2: Idempotency check
  console.log("\n2. Testing idempotency (same webhook twice)...");
  const res2 = await sendWebhook(mockEvent);
  const isIdempotent = res2.success && res2.data === 'already handled';
  logTest(
    'Idempotency check',
    isIdempotent ? 'PASS' : 'FAIL',
    isIdempotent ? 'Duplicate webhook correctly rejected' : `Response: ${JSON.stringify(res2.data)}`
  );

  // Test 3: Invalid signature
  console.log("\n3. Testing invalid signature...");
  const res3 = await sendWebhook(mockEvent, "invalid_signature_hash");
  const isRejected = !res3.success && res3.status === 401;
  logTest(
    'Invalid signature rejected',
    isRejected ? 'PASS' : 'FAIL',
    isRejected ? 'Invalid signature correctly blocked' : `Status: ${res3.status}`
  );

  // Test 4: Missing signature
  console.log("\n4. Testing missing signature...");
  const res4 = await sendWebhook(mockEvent, null);
  const isMissingRejected = !res4.success && res4.status === 401;
  logTest(
    'Missing signature rejected',
    isMissingRejected ? 'PASS' : 'FAIL',
    isMissingRejected ? 'Missing signature correctly blocked' : `Status: ${res4.status}`
  );

  // Test 5: Create orders via API
  console.log("\n--- Order Creation Tests ---");

  console.log("\n5. Testing onramp order creation...");
  const onrampResult = await createTestOrder('onramp');
  logTest(
    'Onramp order creation',
    onrampResult.success ? 'PASS' : 'FAIL',
    onrampResult.success ? `Order ID: ${onrampResult.orderId}` : JSON.stringify(onrampResult.error)
  );

  console.log("\n6. Testing checkout order creation...");
  const checkoutResult = await createTestOrder('checkout');
  logTest(
    'Checkout order creation',
    checkoutResult.success ? 'PASS' : 'FAIL',
    checkoutResult.success ? `Order ID: ${checkoutResult.orderId}` : JSON.stringify(checkoutResult.error)
  );

  console.log("\n7. Testing offramp order creation...");
  const offrampResult = await createTestOrder('offramp');
  logTest(
    'Offramp order creation',
    offrampResult.success ? 'PASS' : 'FAIL',
    offrampResult.success ? `Order ID: ${offrampResult.orderId}` : JSON.stringify(offrampResult.error)
  );

  // Test 6: Invalid order creation (should fail validation)
  console.log("\n--- Input Validation Tests ---");

  console.log("\n8. Testing invalid wallet address...");
  try {
    await axios.post(`${BASE_URL}/api/onramp/initiate`, {
      kiteWallet: 'invalid_address',
      ngnAmount: 50000
    });
    logTest('Invalid wallet rejected', 'FAIL', 'Request should have been rejected');
  } catch (error) {
    const isRejected = error.response?.status === 400;
    logTest(
      'Invalid wallet rejected',
      isRejected ? 'PASS' : 'FAIL',
      isRejected ? 'Invalid address correctly blocked' : `Status: ${error.response?.status}`
    );
  }

  console.log("\n9. Testing invalid amount (negative)...");
  try {
    await axios.post(`${BASE_URL}/api/onramp/initiate`, {
      kiteWallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      ngnAmount: -100
    });
    logTest('Invalid amount rejected', 'FAIL', 'Request should have been rejected');
  } catch (error) {
    const isRejected = error.response?.status === 500;
    logTest(
      'Invalid amount rejected',
      isRejected ? 'PASS' : 'FAIL',
      isRejected ? 'Negative amount correctly blocked' : `Status: ${error.response?.status}`
    );
  }

  console.log("\n10. Testing missing required fields...");
  try {
    await axios.post(`${BASE_URL}/api/onramp/initiate`, {});
    logTest('Missing fields rejected', 'FAIL', 'Request should have been rejected');
  } catch (error) {
    const isRejected = error.response?.status === 400 || error.response?.status === 500;
    logTest(
      'Missing fields rejected',
      isRejected ? 'PASS' : 'FAIL',
      isRejected ? 'Missing fields correctly blocked' : `Status: ${error.response?.status}`
    );
  }

  // Test 7: Query endpoints
  console.log("\n--- Query Endpoint Tests ---");

  if (onrampResult.success) {
    console.log("\n11. Testing order status query...");
    try {
      const orderStatus = await axios.get(`${BASE_URL}/api/order/${onrampResult.orderId}`);
      logTest(
        'Order status query',
        orderStatus.status === 200 ? 'PASS' : 'FAIL',
        `Status: ${orderStatus.data.status}`
      );
    } catch (error) {
      logTest('Order status query', 'FAIL', error.response?.data || error.message);
    }
  }

  console.log("\n12. Testing non-existent order...");
  try {
    await axios.get(`${BASE_URL}/api/order/non-existent-order`);
    logTest('Non-existent order returns 404', 'FAIL', 'Should return 404');
  } catch (error) {
    const isNotFound = error.response?.status === 404;
    logTest(
      'Non-existent order returns 404',
      isNotFound ? 'PASS' : 'FAIL',
      isNotFound ? 'Correctly returns 404' : `Status: ${error.response?.status}`
    );
  }

  console.log("\n13. Testing all orders query...");
  try {
    const allOrders = await axios.get(`${BASE_URL}/api/admin/orders`);
    logTest(
      'All orders query',
      allOrders.status === 200 ? 'PASS' : 'FAIL',
      `Total orders: ${allOrders.data.total}`
    );
  } catch (error) {
    logTest('All orders query', 'FAIL', error.response?.data || error.message);
  }

  // Summary
  console.log("\n==========================================");
  console.log("TEST SUMMARY");
  console.log("==========================================");
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.passed + results.failed}`);
  console.log("==========================================\n");

  if (results.failed > 0) {
    console.log("⚠️  Some tests failed. Check the output above.");
    process.exit(1);
  } else {
    console.log("✅ All tests passed!");
    process.exit(0);
  }
}

// Wait for server to be ready
console.log("Waiting for server to be ready...");
setTimeout(runTests, 1000);
