import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      forking: {
        url: "https://rpc.gokite.ai",
      },
      chainId: 2366,
      hardfork: "london",
      chains: {
        2366: {
          hardforkHistory: {
            berlin: 0,
            london: 0,
          }
        }
      }
    },
    kiteTestnet: {
      url: "https://rpc-testnet.gokite.ai",
      chainId: 2368,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    },
    kiteMainnet: {
      url: "https://rpc.gokite.ai",
      chainId: 2366,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
};
