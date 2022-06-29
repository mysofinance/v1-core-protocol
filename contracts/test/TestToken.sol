// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    uint8 public _decimals;
    address public admin;

    constructor(
        string memory name,
        string memory symbol,
        uint8 inputDecimals
    ) ERC20(name, symbol) {
        _decimals = inputDecimals;
        admin = msg.sender;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == admin, "TEST_TOKEN_UNALLOWED_MINTER");
        _mint(to, amount);
    }
}
