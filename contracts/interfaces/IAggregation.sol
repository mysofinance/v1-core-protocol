// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import {ISubPoolV1} from "./ISubPoolV1.sol";

interface IAggregation {
    event ClaimFromAggregated(
        uint256 fromLoanIdx,
        uint256 toLoanIdx,
        uint256 repayments,
        uint256 collateral
    );

    function aggregrateClaimsHelper(uint256 startLoanIndex, uint256[] memory endAggIdxs)
        external
        view
        returns (ISubPoolV1.AggClaimsInfo[] memory);

    function getClaimsFromAggregated(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256 _shares
    ) external view returns (uint256, uint256);
}