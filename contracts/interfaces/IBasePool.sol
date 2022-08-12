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
        uint256 protocolFee,
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

    /**
     * @notice Function which adds to an LPs current position
     * @dev This function will update loanIdxsWhereSharesChanged only if not
     * the first add
     * @param _sendAmount Amount of loan currency LP wishes to deposit
     * @param _deadline Last timestamp after which function will revert
     * @param _referralCode Will possibly be used later to reward referrals
     */
    function addLiquidity(
        uint128 _sendAmount,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    /**
     * @notice Function which removes shares from an LPs
     * @dev This function will update loanIdxsWhereSharesChanged
     * and shareOverTime arrays in lpInfo
     * @param numSharesRemove Amount of LP shares to remove
     */
    function removeLiquidity(uint256 numSharesRemove) external;

    function borrow(
        address _onBehalf,
        uint128 _sendAmount,
        uint128 _minLoan,
        uint128 _maxRepay,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    function loanTerms(uint128 _inAmountAfterFees)
        external
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint128 _protocolFee,
            uint256 _totalLiquidity
        );

    function repay(
        uint256 _loanIdx,
        address _onBehalf,
        uint128 _sendAmount
    ) external;

    function rollOver(
        uint256 _loanIdx,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    /**
     * @notice Function which handles individual claiming by LPs
     * @dev This function is more expensive, but needs to be used when Lp
     * changes position size in the middle of smallest aggregation block
     * or if LP wants to claim some of the loans before the expiry time
     * of the last loan in the aggregation block. _loanIdxs must be increasing array.
     * @param _loanIdxs Loan indices on which LP wants to claim
     * @param _isReinvested Flag for if LP wants claimed loanCcy to be re-invested
     * @param _deadline Deadline if reinvestment occurs. (If no reinvestment, this is ignored)
     */
    function claim(
        uint256[] calldata _loanIdxs,
        bool _isReinvested,
        uint256 _deadline
    ) external;

    /**
     * @notice Function which handles aggregate claiming by LPs
     * @dev This function is much more efficient, but can only be used when LPs position size did not change
     * over the entire interval LP would like to claim over. _aggIdxs must be increasing array.
     * the first index of _aggIdxs is the from loan index to start aggregation, the rest of the
     * indices are the end loan indexes of the intervals he wants to claim
     * @param _aggIdxs From index and end indices of the aggregation that LP wants to claim
     * @param _isReinvested Flag for if LP wants claimed loanCcy to be re-invested
     * @param _deadline Deadline if reinvestment occurs. (If no reinvestment, this is ignored)
     */
    function claimFromAggregated(
        uint256[] calldata _aggIdxs,
        bool _isReinvested,
        uint256 _deadline
    ) external;

    /**
     * @notice Function which returns claims for a given aggregated from and to index and amount of sharesOverTime
     * @dev This function is called internally, but also can be used by other protocols so has some checks
     * which are unnecessary if it was solely an internal function
     * @param _fromLoanIdx Loan index on which he wants to start aggregate claim (must be mod 0 wrt 100)
     * @param _toLoanIdx End loan index of the aggregation
     * @param _shares Amount of sharesOverTime which the Lp owned over this given aggregation period
     */
    function getClaimsFromAggregated(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256 _shares
    ) external view returns (uint256 repayments, uint256 collateral);

    function getNumShares(address _lpAddr)
        external
        view
        returns (uint256 numShares);

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

    function totalFees() external view returns (uint128);

    function loanIdxToBorrower(uint256) external view returns (address);
}
