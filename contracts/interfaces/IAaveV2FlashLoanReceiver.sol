// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.17;

import {IAaveV2LendingPoolAddressesProvider} from "./IAaveV2LendingPoolAddressesProvider.sol";
import {IAaveV2LendingPool} from "./IAaveV2LendingPool.sol";

interface IAaveV2FlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);

    function ADDRESSES_PROVIDER()
        external
        view
        returns (IAaveV2LendingPoolAddressesProvider);

    function LENDING_POOL() external view returns (IAaveV2LendingPool);
}
