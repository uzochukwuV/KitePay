import { ethers } from "ethers";
import fs from "fs";

const wallet = ethers.Wallet.createRandom();

console.log("\n========================================");
console.log("NEW KITE TESTNET WALLET GENERATED");
console.log("========================================");
console.log("Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);
console.log("========================================\n");

// Append to .env for Hardhat
fs.appendFileSync(".env", `\nDEPLOYER_PRIVATE_KEY=${wallet.privateKey}\n`);
console.log("-> Saved to .env as DEPLOYER_PRIVATE_KEY");
