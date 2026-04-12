const axios = require('axios');
const crypto = require('crypto');

// Configuration
const WEBHOOK_SECRET = "whsec_test_secret_for_hackathon";
const PORT = 8080;
const URL = `http://localhost:${PORT}/api/webhooks/bitnob`;

function generateSignature(payload) {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');
}

async function sendWebhook(eventPayload) {
  const payloadString = JSON.stringify(eventPayload);
  const signature = generateSignature(payloadString);

  try {
    const res = await axios.post(URL, payloadString, {
      headers: {
        'Content-Type': 'application/json',
        'x-bitnob-signature': signature,
      }
    });
    console.log(`[TEST] Status: ${res.status}, Response:`, res.data);
    return res;
  } catch (error) {
    console.error(`[TEST ERROR] Status: ${error.response?.status}, Response:`, error.response?.data || error.message);
  }
}

async function runTests() {
  console.log("--- Starting Webhook Tests ---\n");

  const mockEvent = {
    event: "payment.received",
    data: {
      reference: "test_order_123",
      amount: "50000",
      currency: "NGN",
      timestamp: new Date().toISOString()
    }
  };

  console.log("1. Testing valid webhook...");
  await sendWebhook(mockEvent);

  console.log("\n2. Testing Idempotency (sending same webhook again)...");
  const res2 = await sendWebhook(mockEvent);
  if (res2?.data === "already handled") {
     console.log("-> Idempotency check PASSED");
  }

  console.log("\n3. Testing invalid signature...");
  try {
    await axios.post(URL, JSON.stringify(mockEvent), {
      headers: {
        'Content-Type': 'application/json',
        'x-bitnob-signature': "invalid_signature_hash",
      }
    });
  } catch (error) {
    console.log(`[TEST] Invalid signature handled correctly. Status: ${error.response?.status}, Data:`, error.response?.data);
  }

  console.log("\n--- Tests Completed ---");
}

runTests();
