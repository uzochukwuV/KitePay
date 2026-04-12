import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "KITE");

  if (balance === 0n) {
      console.error("ERROR: Deployer account has 0 KITE. Please fund it from the faucet first!");
      process.exit(1);
  }

  // 1. Deploy Mock USDC (6 decimals)
  console.log("\n1. Deploying Mock USDC...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mUSDC = await MockERC20.deploy("Mock USDC", "USDC");
  await mUSDC.waitForDeployment();
  const mUSDCAddress = await mUSDC.getAddress();
  console.log("-> Mock USDC deployed at:", mUSDCAddress);

  // Mint some Mock USDC to the deployer for testing
  console.log("   Minting 10,000 mUSDC to deployer...");
  const mintTx = await mUSDC.mint(deployer.address, hre.ethers.parseUnits("10000", 6));
  await mintTx.wait();

  // 2. Deploy Mock L-USDC
  console.log("\n2. Deploying Mock L-USDC...");
  const mLUSDC = await MockERC20.deploy("Mock Lucid USDC", "L-USDC");
  await mLUSDC.waitForDeployment();
  const mLUSDCAddress = await mLUSDC.getAddress();
  console.log("-> Mock L-USDC deployed at:", mLUSDCAddress);

  // 3. Deploy Mock Lucid Controller
  console.log("\n3. Deploying Mock Lucid Controller...");
  const MockLucidController = await hre.ethers.getContractFactory("MockLucidController");
  const mLucidController = await MockLucidController.deploy(mUSDCAddress, mLUSDCAddress);
  await mLucidController.waitForDeployment();
  const mLucidControllerAddress = await mLucidController.getAddress();
  console.log("-> Mock Lucid Controller deployed at:", mLucidControllerAddress);

  // 4. Deploy SwiftVault
  console.log("\n4. Deploying SwiftVault...");
  const SwiftVault = await hre.ethers.getContractFactory("SwiftVault");
  const vault = await SwiftVault.deploy(
    mUSDCAddress,
    mLucidControllerAddress,
    mLUSDCAddress,
    deployer.address, // operator
    deployer.address  // fee recipient
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("-> SwiftVault deployed at:", vaultAddress);

  console.log("\n========================================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================================");
  console.log("Mock USDC:", mUSDCAddress);
  console.log("SwiftVault:", vaultAddress);
  console.log("Operator / Fee Recipient:", deployer.address);
  console.log("========================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
