// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.17;

import {IBalancerAsset} from "./IBalancerAsset.sol";

library DataTypes {
    enum SwapKind {
        GIVEN_IN,
        GIVEN_OUT
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }

    struct SingleSwap {
        bytes32 poolId;
        SwapKind kind;
        IBalancerAsset assetIn;
        IBalancerAsset assetOut;
        uint256 amount;
        bytes userData;
    }
}
