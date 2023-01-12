// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import {IAddLiquidityChecker} from "../interfaces/IAddLiquidityChecker.sol";

/**@dev this contract needs to implement any allowedToAdd
// just have it return true to allow any adder,
// return false to only allow creator to add,
// else implement any logic you want
// to have more fine-grained add control
// example here is a whitelist mapping
// (could only be one address for one particular adder)
// but in principle if you put complex logic or even require
// a seperate contract to call addLiquidity which checked
// a merkle tree white (or black) list or whatever you wanted
*/

contract AddLiquidityChecker is IAddLiquidityChecker {
    error InvalidAdmin();

    mapping(address => bool) public whitelistAddrs;
    address admin;

    constructor() {
        admin = msg.sender;
    }

    function allowedToAdd(address) external pure returns (bool) {
        return true;
    }

    function toggleWhitelist(address updatedAddr) external {
        if (admin != msg.sender) revert InvalidAdmin();
        whitelistAddrs[updatedAddr] = !whitelistAddrs[updatedAddr];
    }
}
