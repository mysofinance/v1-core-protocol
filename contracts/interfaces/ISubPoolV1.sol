// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

interface ISubPoolV1 {
    event NewSubPool(
        address collCcyToken,
        address loanCcyToken,
        uint24 loanTenor,
        uint128 maxLoanPerColl,
        uint256 r1,
        uint256 r2,
        uint256 tvl1,
        uint256 tvl2
    );
    event AddLiquidity(
        uint256 amount,
        uint256 newLpShares,
        uint256 totalLiquidity,
        uint256 totalLpShares,
        uint256 earliestRemove
    );
    event RemoveLiquidity(
        uint256 amount,
        uint256 removedLpShares,
        uint256 totalLiquidity,
        uint256 totalLpShares
    );
    event Borrow(
        uint256 loanIdx,
        uint256 collateral,
        uint256 loanAmount,
        uint256 repaymentAmount,
        uint256 expiry
    );
    event AggregateClaims(
        uint256 fromLoanIdx,
        uint256 toLoanIdx,
        uint256 repayments,
        uint256 collateral,
        uint256 numDefaults
    );
    event ClaimFromAggregated(
        uint256 fromLoanIdx,
        uint256 toLoanIdx,
        uint256 repayments,
        uint256 collateral
    );
    event Claim(
        uint256[] loanIdxs,
        uint256 repayments,
        uint256 collateral,
        uint256 numDefaults
    );
    event Repay(uint256 loanIdx, uint256 repayment, uint256 collateral);

    function addLiquidity(uint128 _amount, uint256 _deadline) external;

    function removeLiquidity() external;

    function borrow(
        uint128 _pledgeAmount,
        uint128 _minLoan,
        uint128 _maxRepay,
        uint256 _deadline
    ) external payable;

    function repay(uint256 _loanIdx) external;

    function claim(uint256[] calldata _loanIdxs) external;

    //including _fromLoanIdx and _toLoanIdx
    function aggregateClaims(uint256 _fromLoanIdx, uint256 _toLoanIdx) external;

    //including _fromLoanIdx and _toLoanIdx
    function claimFromAggregated(uint256 _fromLoanIdx, uint256 _toLoanIdx)
        external;
}
