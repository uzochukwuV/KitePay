const { ethers } = require('ethers');

// Minimal ABI required for operator interactions
const SwiftVaultABI = [
  "function settleOnramp(bytes32 orderId, address user, uint256 usdcAmount, uint256 ngnAmount) external",
  "function settleCheckout(bytes32 orderId, address merchant, uint256 usdcAmount, uint256 ngnAmount) external",
  "function deployToYield() external",
  "function recallFromYield(uint256 amount) external",
  "function liquidBalance() public view returns (uint256)",
  "function bufferBps() public view returns (uint256)",
  "event OfframpInitiated(bytes32 indexed orderId, address indexed user, uint256 usdcAmount)"
];

let vault;
let operatorWallet;

function getVault() {
  if (!vault) {
    const provider = new ethers.JsonRpcProvider(process.env.KITE_RPC_URL || "https://rpc-testnet.gokite.ai");
    operatorWallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
    vault = new ethers.Contract(process.env.VAULT_ADDRESS, SwiftVaultABI, operatorWallet);
  }
  return vault;
}

/**
 * Check liquid balance and recall from yield if necessary
 */
async function ensureLiquidity(requiredUsdcAmount) {
  try {
    const required = ethers.parseUnits(requiredUsdcAmount.toString(), 6);
    const liquidBal = await getVault().liquidBalance();
    
    if (liquidBal < required) {
      // Add a 5% buffer to prevent exact-amount withdrawal slippage causing revert
      const shortfall = required - liquidBal;
      const amountToRecall = (shortfall * 105n) / 100n;

      console.log(`[KITE] JIT Liquidity: Vault short by ${ethers.formatUnits(shortfall, 6)} USDC. Recalling ${ethers.formatUnits(amountToRecall, 6)} from yield...`);
      
      const tx = await getVault().recallFromYield(amountToRecall);
      await tx.wait();
      console.log(`[KITE] JIT Liquidity: Successfully recalled USDC.`);
    }
  } catch (error) {
    console.error("[KITE] ensureLiquidity failed:", error.reason || error.message);
    throw error;
  }
}

/**
 * Release USDC from vault to user (onramp settlement)
 */
async function settleOnramp(orderId, userAddress, usdcAmount, ngnAmount) {
  try {
    await ensureLiquidity(usdcAmount);

    const orderIdBytes32 = ethers.id(orderId);
    
    // usdcAmount is expected to be a number (e.g. 10.50). We parse it to 6 decimals for USDC
    const parsedUsdc = ethers.parseUnits(usdcAmount.toString(), 6);
    
    console.log(`[KITE] Settling onramp for ${orderId}...`);
    const tx = await getVault().settleOnramp(
      orderIdBytes32,
      userAddress,
      parsedUsdc,
      ngnAmount
    );
    
    const receipt = await tx.wait();
    console.log('[KITE] Onramp settled:', receipt.hash);
    return receipt.hash;
  } catch (error) {
    console.error("[KITE] settleOnramp failed:", error.reason || error.message);
    throw error;
  }
}

/**
 * Release USDC from vault to merchant (checkout settlement)
 */
async function settleCheckout(orderId, merchantAddress, usdcAmount, ngnAmount) {
  try {
    await ensureLiquidity(usdcAmount);

    const orderIdBytes32 = ethers.id(orderId);
    const parsedUsdc = ethers.parseUnits(usdcAmount.toString(), 6);

    console.log(`[KITE] Settling checkout for ${orderId}...`);
    const tx = await getVault().settleCheckout(
      orderIdBytes32,
      merchantAddress,
      parsedUsdc,
      ngnAmount
    );
    
    const receipt = await tx.wait();
    console.log('[KITE] Checkout settled:', receipt.hash);
    return receipt.hash;
  } catch (error) {
    console.error("[KITE] settleCheckout failed:", error.reason || error.message);
    throw error;
  }
}

/**
 * Deploy idle float to Lucid yield
 */
async function deployToYield() {
  try {
    const tx = await getVault().deployToYield();
    const receipt = await tx.wait();
    console.log('[KITE] Deployed to yield:', receipt.hash);
    return receipt.hash;
  } catch (error) {
    // If we hit the "Nothing to deploy" require, it's fine, just skip
    if (error.reason && error.reason.includes("Nothing to deploy")) {
        console.log('[KITE] Yield buffer full, nothing to deploy.');
        return null;
    }
    console.error("[KITE] deployToYield failed:", error.reason || error.message);
    throw error;
  }
}

/**
 * Recall USDC from Lucid yield back to vault
 */
async function recallFromYield(usdcAmount) {
  try {
    const parsedUsdc = ethers.parseUnits(usdcAmount.toString(), 6);
    console.log(`[KITE] Recalling ${usdcAmount} USDC from yield...`);
    const tx = await getVault().recallFromYield(parsedUsdc);
    const receipt = await tx.wait();
    console.log('[KITE] Recalled from yield:', receipt.hash);
    return receipt.hash;
  } catch (error) {
    console.error("[KITE] recallFromYield failed:", error.reason || error.message);
    throw error;
  }
}

/**
 * Listen for OfframpInitiated events on Kite chain to trigger Bitnob payouts
 */
function listenForOfframps(callback) {
  // Use a polling interval instead of .on() to avoid WebSockets/Filter disconnects on testnets
  const vault = getVault();
  const filter = vault.filters.OfframpInitiated();
  
  let lastBlock = 'latest';

  const pollEvents = async () => {
    try {
      if (lastBlock === 'latest') {
        lastBlock = await vault.runner.provider.getBlockNumber();
      }

      const currentBlock = await vault.runner.provider.getBlockNumber();
      if (currentBlock > lastBlock) {
        const events = await vault.queryFilter(filter, lastBlock + 1, currentBlock);
        
        for (const event of events) {
          const { args } = event;
          callback({
            orderId: args[0], // orderIdBytes32
            user: args[1],
            usdcAmount: ethers.formatUnits(args[2], 6),
            txHash: event.transactionHash,
          });
        }
        lastBlock = currentBlock;
      }
    } catch (error) {
      console.error('[KITE] Polling error:', error.message);
    }
  };

  setInterval(pollEvents, 5000); // Poll every 5 seconds
  console.log('[KITE] Polling for offramp events on vault...');
}

module.exports = { settleOnramp, settleCheckout, deployToYield, recallFromYield, listenForOfframps };
