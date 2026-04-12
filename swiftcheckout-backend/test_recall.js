const kiteService = require('./src/services/kite.service');

// We can't actually test this without a deployed Vault and a funded operator key,
// but we can ensure the function signature and exports are correctly set up.
async function testRecall() {
  console.log("Testing recallFromYield function structure...");
  try {
    if (typeof kiteService.recallFromYield === 'function') {
      console.log("-> recallFromYield is exported correctly.");
      
      // If we don't have env variables, it will fail when trying to connect to ethers provider
      if (!process.env.VAULT_ADDRESS || !process.env.OPERATOR_PRIVATE_KEY) {
        console.log("-> Skipping actual execution (no VAULT_ADDRESS or OPERATOR_PRIVATE_KEY provided).");
      } else {
        await kiteService.recallFromYield("10.5");
      }
    } else {
      console.error("-> Error: recallFromYield is NOT exported correctly.");
    }
  } catch (error) {
    console.error("Test error (expected without full env config):", error.message);
  }
}

testRecall();