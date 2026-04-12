import hre from "hardhat";

async function main() {
  const lucidControllerAddress = "0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b";
  // The ABI for lucid controller from the docs is:
  // function mint(uint256 amount, address recipient) external;
  // function burn(uint256 amount, address recipient) external;
  // We can try to see if it has lUsdc() or similar.
  const data = hre.ethers.id("lUsdc()").substring(0, 10);
  try {
    const result = await hre.ethers.provider.call({
      to: lucidControllerAddress,
      data: data
    });
    if (result !== "0x") {
        console.log("L-USDC address from controller:", hre.ethers.AbiCoder.defaultAbiCoder().decode(["address"], result)[0]);
    } else {
        console.log("No lUsdc() method");
    }
  } catch(e) {
    console.log("Error calling lUsdc()", e.message);
  }
}

main().catch(console.error);
