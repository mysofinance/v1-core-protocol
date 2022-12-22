pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAaveV2FlashLoanReceiver} from "../interfaces/IAaveV2FlashLoanReceiver.sol";
import {IAaveV2LendingPoolAddressesProvider} from "../interfaces/IAaveV2LendingPoolAddressesProvider.sol";
import {IAaveV2LendingPool} from "../interfaces/IAaveV2LendingPool.sol";

abstract contract AaveV2FlashLoanReceiverBase is IAaveV2FlashLoanReceiver {
    using SafeERC20 for IERC20;

    IAaveV2LendingPoolAddressesProvider
        public immutable
        override ADDRESSES_PROVIDER;
    IAaveV2LendingPool public immutable override LENDING_POOL;

    constructor(IAaveV2LendingPoolAddressesProvider provider) {
        ADDRESSES_PROVIDER = provider;
        LENDING_POOL = IAaveV2LendingPool(provider.getLendingPool());
    }
}
