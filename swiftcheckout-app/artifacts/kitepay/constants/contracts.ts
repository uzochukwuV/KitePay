export const KITE_RPC_URL = "https://rpc-testnet.gokite.ai";

/** Backend API base URL — update this when the ngrok tunnel changes */
export const BACKEND_URL = "https://5883-102-90-103-217.ngrok-free.app";
export const USDC_ADDRESS = "0xf19eAa3DF45C8ee8BB9f1F098bb300c688EB172E";
export const VAULT_ADDRESS = "0x1e7ceEA90067680b65fd90aE571f7bd19AacBFC1";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const VAULT_ABI = [
  "function initiateOfframp(bytes32 orderId, uint256 usdcAmount) external",
  "function liquidBalance() public view returns (uint256)",
  "function yieldBalance() public view returns (uint256)",
  "function totalTVL() public view returns (uint256)",
  "event OfframpInitiated(bytes32 indexed orderId, address indexed user, uint256 usdcAmount)",
];
