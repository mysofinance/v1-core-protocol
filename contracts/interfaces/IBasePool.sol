// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

interface IBasePool {
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
        uint16 referralCode
    );

    event ClaimFromAggregated(
        uint256 fromLoanIdx,
        uint256 toLoanIdx,
        uint256 repayments,
        uint256 collateral
    );
    event Claim(uint256[] loanIdxs, uint256 repayments, uint256 collateral);
    event FeeUpdate(uint128 oldFee, uint128 newFee);
    event Repay(uint256 loanIdx);

    function addLiquidity(
        uint128 _amount,
        uint256 _deadline,
        uint16 _referralCode
    ) external payable;

    function removeLiquidity(uint256 numSharesRemove) external;

    function borrow(
        uint128 _pledgeAmount,
        uint128 _minLoan,
        uint128 _maxRepay,
        uint256 _deadline,
        uint16 _referralCode
    ) external payable;

    function loanTerms(uint128 _inAmount)
        external
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint256 _totalLiquidity
        );

    function repay(uint256 _loanIdx) external;

    function rollOver(
        uint256 _loanIdx,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    function claim(uint256[] calldata _loanIdxs, bool _isReinvested) external;

    //including _fromLoanIdx and _toLoanIdx
    function claimFromAggregated(
        uint256 _fromLoanIdx,
        uint256[] calldata _endAggIdxs,
        bool _isReinvested
    ) external;

    function getlpArrInfo(
        address _lpAddr,
        uint256 index1,
        uint256 index2
    ) external view returns (uint256, uint256);

    function collCcyToken() external view returns (address);

    function loanCcyToken() external view returns (address);

    function maxLoanPerColl() external view returns (uint256);

    function protocolFee() external view returns (uint128);

    function totalLpShares() external view returns (uint128);

    function loanIdx() external view returns (uint256);

    function r1() external view returns (uint256);

    function r2() external view returns (uint256);

    function tvl1() external view returns (uint256);

    function tvl2() external view returns (uint256);

    function minLoan() external view returns (uint256);

    function totalFees() external view returns (uint256);

    function loanIdxToBorrower(uint256) external view returns (address);
}
