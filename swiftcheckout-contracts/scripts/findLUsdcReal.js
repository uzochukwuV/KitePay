import hre from "hardhat";

async function main() {
  const USDC = "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e";
  const LUCID_CTRL = "0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b";

  const [signer] = await hre.ethers.getSigners();
  const address = signer.address;

  // Fund signer with USDC
  const slot = 9;
  const probeA = hre.ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1000000000]); // 1000 USDC
  const key = hre.ethers.keccak256(
    hre.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [address, slot])
  );
  await hre.ethers.provider.send("hardhat_setStorageAt", [USDC, key, probeA]);

  const usdc = new hre.ethers.Contract(USDC, [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
  ], signer);

  console.log("USDC balance before:", await usdc.balanceOf(address));

  await usdc.approve(LUCID_CTRL, 1000000000);
  console.log("Approved Lucid Controller");

  const lucid = new hre.ethers.Contract(LUCID_CTRL, [
    "function mint(uint256 amount, address recipient) external"
  ], signer);

  const tx = await lucid.mint(100000000, address);
  const receipt = await tx.wait();
  
  // Find Transfer event from the receipt to see what token was minted
  const transferTopic = hre.ethers.id("Transfer(address,address,uint256)");
  for (const log of receipt.logs) {
    if (log.topics[0] === transferTopic && log.address.toLowerCase() !== USDC.toLowerCase()) {
      console.log("Found another token transfer! Address:", log.address);
      break;
    }
  }
}

main().catch(console.error);
