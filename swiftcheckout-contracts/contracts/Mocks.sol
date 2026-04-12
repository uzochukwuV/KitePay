// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

contract MockLucidController {
    IERC20 public usdc;
    MockERC20 public lUsdc;

    constructor(address _usdc, address _lUsdc) {
        usdc = IERC20(_usdc);
        lUsdc = MockERC20(_lUsdc);
    }

    function mint(uint256 amount, address recipient) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        lUsdc.mint(recipient, amount);
    }

    function burn(uint256 amount, address recipient) external {
        lUsdc.burn(msg.sender, amount);
        usdc.transfer(recipient, amount);
    }
}
