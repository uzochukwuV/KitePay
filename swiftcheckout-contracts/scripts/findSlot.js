import hre from "hardhat";

async function findBalancesSlot(tokenAddress) {
  const account = hre.ethers.Wallet.createRandom().address;
  const probeA = hre.ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1]);
  const probeB = hre.ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [2]);
  
  for (let i = 0; i < 100; i++) {
    const key = hre.ethers.keccak256(
      hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [account, i])
    );
    
    // Backup original value
    const originalValue = await hre.ethers.provider.send("eth_getStorageAt", [tokenAddress, key, "latest"]);
    
    // Set to probeA
    await hre.ethers.provider.send("hardhat_setStorageAt", [tokenAddress, key, probeA]);
    const balA = await hre.ethers.provider.send("eth_call", [{
      to: tokenAddress,
      data: "0x70a08231000000000000000000000000" + account.replace("0x", "")
    }, "latest"]);
    
    if (balA !== probeA) {
      await hre.ethers.provider.send("hardhat_setStorageAt", [tokenAddress, key, originalValue]);
      continue;
    }
    
    // Set to probeB
    await hre.ethers.provider.send("hardhat_setStorageAt", [tokenAddress, key, probeB]);
    const balB = await hre.ethers.provider.send("eth_call", [{
      to: tokenAddress,
      data: "0x70a08231000000000000000000000000" + account.replace("0x", "")
    }, "latest"]);
    
    if (balB === probeB) {
      await hre.ethers.provider.send("hardhat_setStorageAt", [tokenAddress, key, originalValue]);
      return i;
    }
    
    await hre.ethers.provider.send("hardhat_setStorageAt", [tokenAddress, key, originalValue]);
  }
  throw new Error("Balances slot not found!");
}

async function main() {
  const USDC_ADDRESS = "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e";
  try {
    const slot = await findBalancesSlot(USDC_ADDRESS);
    console.log("USDC balances slot is:", slot);
  } catch(e) {
    console.error(e);
  }
}

main().catch(console.error);
