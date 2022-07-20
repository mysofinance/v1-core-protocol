// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

interface ISubPoolV1 {

    struct LoanInfo {
        uint128 repayment;
        uint128 collateral;
        uint128 totalLpShares;
        uint32 expiry;
        bool repaid;
    }

    struct AggClaimsInfo {
        uint128 repayments;
        uint128 collateral;
    }

    event NewSubPool(
        address collCcyToken,
        address loanCcyToken,
        uint24 loanTenor,
        uint128 maxLoanPerColl,
        uint256 r1,
        uint256 r2,
        uint256 tvl1,
        uint256 tvl2,
        uint256 minLoan
    );
    event AddLiquidity(
        uint256 amount,
        uint256 newLpShares,
        uint256 totalLiquidity,
        uint256 totalLpShares,
        uint256 earliestRemove,
        uint16 referralCode
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
        uint256 expiry,
        uint256 fee,
        uint16 referralCode
    );
    event Roll(
        uint256 oldLoanIdx,
        uint256 newLoanIdx,
        uint256 collateral,
        uint256 refinancingCost,
        uint256 oldRepaymentAmount,
        uint256 newRepaymentAmount,
        uint256 oldExpiry,
        uint256 newExpiry,
        uint16 referralCode
    );
    event AggregateClaims(
        uint256 fromLoanIdx,
        uint256 toLoanIdx,
        uint256 repayments,
        uint256 collateral
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
    event FeeUpdate(uint128 oldFee, uint128 newFee);
    event Repay(uint256 loanIdx, uint256 repayment, uint256 collateral);

    function addLiquidity(
        uint128 _amount,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    function removeLiquidity() external;

    function borrow(
        uint128 _pledgeAmount,
        uint128 _minLoan,
        uint128 _maxRepay,
        uint256 _deadline,
        uint16 _referralCode
    ) external payable;

    function repay(uint256 _loanIdx) external;

    function rollOver(
        uint256 _loanIdx,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    function claim(uint256[] calldata _loanIdxs) external;

    //including _fromLoanIdx and _toLoanIdx
    function claimFromAggregated(uint256 _fromLoanIdx, uint256[] calldata _endAggIdxs)
        external;

    // function loanIdxToLoanInfo(uint256 loanIdx)
    //     external
    //     view
    //     returns(LoanInfo memory _loanInfo);

    function getLoanExpiry(uint256 _loanIdx) external view returns(uint32 expiry);

    function getAggClaimInfo(uint256 startIndex, uint256 endIndex, bool isBase)
        external
        view
        returns(AggClaimsInfo memory _claimInfo);
}
