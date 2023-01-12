// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

interface IAddLiquidityChecker {
    function allowedToAdd(address _liquidityAdder) external returns (bool);
}
