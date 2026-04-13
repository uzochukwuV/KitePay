// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ILucidController {
    function mint(uint256 amount, address recipient) external;
    function burn(uint256 amount, address recipient) external;
}

/**
 * @title SwiftVault
 * @notice Core liquidity vault for SwiftCheckout NGN <> USDC corridor on Kite chain
 * @dev Holds USDC.e, settles merchant payments, deploys idle float to Lucid yield
 */
contract SwiftVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;             // USDC.e on Kite
    address public immutable lucidController; // Lucid L-USDC controller
    IERC20 public lUsdc;                      // L-USDC token received from Lucid

    // Liquidity buffer: always keep this % liquid (rest goes to yield)
    // 2000 = 20%, 10000 = 100%
    uint256 public bufferBps = 2000;

    // Operator address — your backend agent wallet (signs settlements)
    address public operator;

    // Merchant registry
    mapping(address => bool) public merchants;

    // Global order registry to prevent replays across all flows
    mapping(bytes32 => bool) public isOrderSettled;

    // Protocol fee in bps (50 = 0.5%)
    uint256 public feeBps = 50;
    address public feeRecipient;

    // ─── Events ──────────────────────────────────────────────────────────────

    event OnrampSettled(bytes32 indexed orderId, address indexed user, uint256 usdcAmount);
    event OfframpInitiated(bytes32 indexed orderId, address indexed user, uint256 usdcAmount);
    event CheckoutSettled(bytes32 indexed orderId, address indexed merchant, uint256 usdcAmount);
    event YieldDeployed(uint256 amount);
    event YieldRecalled(uint256 amount);
    event MerchantRegistered(address indexed merchant);
    event MerchantDeregistered(address indexed merchant);
    event OperatorUpdated(address indexed newOperator);
    event FeeRecipientUpdated(address indexed newFeeRecipient);
    event LUsdcUpdated(address indexed newLUsdc);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "Not operator");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _lucidController,
        address _lUsdc,
        address _operator,
        address _feeRecipient
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "USDC address cannot be zero");
        require(_lucidController != address(0), "Lucid Controller address cannot be zero");
        require(_lUsdc != address(0), "L-USDC address cannot be zero");
        require(_operator != address(0), "Operator address cannot be zero");
        require(_feeRecipient != address(0), "Fee Recipient address cannot be zero");

        usdc = IERC20(_usdc);
        lucidController = _lucidController;
        lUsdc = IERC20(_lUsdc);
        operator = _operator;
        feeRecipient = _feeRecipient;
    }

    // ─── Onramp ──────────────────────────────────────────────────────────────

    /**
     * @notice Operator calls this after Bitnob confirms NGN received
     * @dev Releases USDC from vault to user's Kite wallet
     */
    function settleOnramp(
        bytes32 orderId,
        address user,
        uint256 usdcAmount,
        uint256 /* ngnAmount */ // kept for API compatibility but not stored to save gas
    ) external onlyOperator nonReentrant whenNotPaused {
        bytes32 namespacedOrderId = keccak256(abi.encodePacked("ONRAMP", orderId));
        require(!isOrderSettled[namespacedOrderId], "Order already settled");
        require(user != address(0), "Invalid user");
        require(usdcAmount > 0, "Amount must be > 0");
        require(liquidBalance() >= usdcAmount, "Insufficient vault liquidity");

        isOrderSettled[namespacedOrderId] = true;

        usdc.safeTransfer(user, usdcAmount);
        emit OnrampSettled(orderId, user, usdcAmount);
    }

    // ─── Offramp ─────────────────────────────────────────────────────────────

    /**
     * @notice User sends USDC to vault to initiate offramp
     * @dev Backend listens for this event and triggers Bitnob NGN payout
     */
    function initiateOfframp(
        bytes32 orderId,
        uint256 usdcAmount
    ) external nonReentrant whenNotPaused {
        bytes32 namespacedOrderId = keccak256(abi.encodePacked("OFFRAMP", orderId));
        require(!isOrderSettled[namespacedOrderId], "Order ID already used");
        require(usdcAmount > 0, "Amount must be > 0");

        isOrderSettled[namespacedOrderId] = true;

        uint256 fee = (usdcAmount * feeBps) / 10000;
        uint256 netAmount = usdcAmount - fee;

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        if (fee > 0 && feeRecipient != address(0)) {
            usdc.safeTransfer(feeRecipient, fee);
        }

        // Backend picks up this event and calls Bitnob to pay NGN to user's bank
        emit OfframpInitiated(orderId, msg.sender, netAmount);
    }

    // ─── Checkout ────────────────────────────────────────────────────────────

    /**
     * @notice Operator settles a checkout payment to a merchant
     * @dev Called by backend after Bitnob confirms customer's NGN bank transfer
     */
    function settleCheckout(
        bytes32 orderId,
        address merchant,
        uint256 usdcAmount,
        uint256 /* ngnAmount */ // kept for API compatibility but not stored to save gas
    ) external onlyOperator nonReentrant whenNotPaused {
        bytes32 namespacedOrderId = keccak256(abi.encodePacked("CHECKOUT", orderId));
        require(merchants[merchant], "Merchant not registered");
        require(!isOrderSettled[namespacedOrderId], "Order already settled");
        require(liquidBalance() >= usdcAmount, "Insufficient vault liquidity");

        isOrderSettled[namespacedOrderId] = true;

        uint256 fee = (usdcAmount * feeBps) / 10000;
        uint256 netAmount = usdcAmount - fee;

        usdc.safeTransfer(merchant, netAmount);
        if (fee > 0 && feeRecipient != address(0)) {
            usdc.safeTransfer(feeRecipient, fee);
        }

        emit CheckoutSettled(orderId, merchant, usdcAmount);
    }

    // ─── Yield Management ────────────────────────────────────────────────────

    /**
     * @notice Deploy idle USDC above buffer threshold to Lucid for yield
     * @dev Lucid controller mints L-USDC. 90% goes to Aave v3 automatically.
     */
    function deployToYield() external onlyOperator nonReentrant {
        uint256 liquidBal = usdc.balanceOf(address(this));
        uint256 tvl = totalTVL();
        uint256 targetBuffer = (tvl * bufferBps) / 10000;
        
        require(liquidBal > targetBuffer, "Nothing to deploy");
        uint256 deployable = liquidBal - targetBuffer;

        uint256 yieldBalBefore = lUsdc.balanceOf(address(this));

        usdc.forceApprove(lucidController, deployable);
        ILucidController(lucidController).mint(deployable, address(this));

        uint256 yieldBalAfter = lUsdc.balanceOf(address(this));
        require(yieldBalAfter > yieldBalBefore, "Yield deployment failed: no L-USDC received");

        emit YieldDeployed(deployable);
    }

    /**
     * @notice Recall USDC from Lucid yield back to vault
     * @param amount Amount of USDC to recall
     */
    function recallFromYield(uint256 amount) external onlyOperator nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(amount <= lUsdc.balanceOf(address(this)), "Insufficient yield balance");

        uint256 liquidBalBefore = usdc.balanceOf(address(this));

        ILucidController(lucidController).burn(amount, address(this));

        uint256 liquidBalAfter = usdc.balanceOf(address(this));
        require(liquidBalAfter > liquidBalBefore, "Yield recall failed: no USDC received");

        emit YieldRecalled(amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function liquidBalance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function yieldBalance() public view returns (uint256) {
        return lUsdc.balanceOf(address(this));
    }

    function totalTVL() public view returns (uint256) {
        return liquidBalance() + yieldBalance();
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function registerMerchant(address merchant) external onlyOwner {
        merchants[merchant] = true;
        emit MerchantRegistered(merchant);
    }

    function deregisterMerchant(address merchant) external onlyOwner {
        merchants[merchant] = false;
        emit MerchantDeregistered(merchant);
    }

    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Operator cannot be zero address");
        operator = _operator;
        emit OperatorUpdated(_operator);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Fee recipient cannot be zero address");
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function setLUsdc(address _lUsdc) external onlyOwner {
        require(_lUsdc != address(0), "L-USDC address cannot be zero");
        lUsdc = IERC20(_lUsdc);
        emit LUsdcUpdated(_lUsdc);
    }

    function setBufferBps(uint256 _bps) external onlyOwner {
        require(_bps <= 10000, "Cannot exceed 100%");
        bufferBps = _bps;
    }

    function setFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 500, "Fee cannot exceed 5%");
        feeBps = _bps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Rescue any ERC20 token accidentally sent to the vault
     * @param token Address of the ERC20 token to rescue
     * @param to Address to send the rescued tokens to
     */
    function emergencyWithdraw(address token, address to) external onlyOwner {
        require(to != address(0), "Cannot withdraw to zero address");
        require(token != address(0), "Token cannot be zero address");
        if (token == address(lUsdc)) {
            require(paused(), "Pause before withdrawing L-USDC");
        }
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        IERC20(token).safeTransfer(to, balance);
    }
}
