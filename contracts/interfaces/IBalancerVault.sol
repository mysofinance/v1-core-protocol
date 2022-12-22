// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.17;
import {DataTypes} from "../interfaces/BalancerDataTypes.sol";

interface IBalancerVault {
    function swap(
        DataTypes.SingleSwap memory singleSwap,
        DataTypes.FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external payable returns (uint256);
}
