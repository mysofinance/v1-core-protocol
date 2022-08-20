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
        uint256 liquidityBnd1,
        uint256 liquidityBnd2,
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
    event Reinvest(
        uint256 repayments,
        uint256 newLpShares,
        uint256 earliestRemove
    );

    enum ApprovalTypes {
        REPAY,
        ROLLOVER,
        ADD_LIQUIDITY,
        REMOVE_LIQUIDITY,
        CLAIM
    }

    /**
     * @notice Function which adds to an LPs current position
     * @dev This function will update loanIdxsWhereSharesChanged only if not
     * the first add. If address on behalf of is not sender, then sender must have permission.
     * @param _onBehalfOf Recipient of the LP shares
     * @param _sendAmount Amount of loan currency LP wishes to deposit
     * @param _deadline Last timestamp after which function will revert
     * @param _referralCode Will possibly be used later to reward referrals
     */
    function addLiquidity(
        address _onBehalfOf,
        uint128 _sendAmount,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    /**
     * @notice Function which removes shares from an LPs
     * @dev This function will update loanIdxsWhereSharesChanged and
     * shareOverTime arrays in lpInfo. If address on behalf of is not
     * sender, then sender must have permission to remove on behalf of owner.
     * @param _onBehalfOf Owner of the Lp shares
     * @param numSharesRemove Amount of LP shares to remove
     */
    function removeLiquidity(address _onBehalfOf, uint256 numSharesRemove)
        external;

    /**
     * @notice Function which allows borrowing from the pool
     * @param _onBehalf Will become owner of the loan
     * @param _sendAmount Amount of collateral currency sent by borrower
     * @param _minLoan Minimum loan currency amount acceptable to borrower
     * @param _maxRepay Maximum allowable loan currency amount borrower is willing to repay
     * @param _deadline Timestamp after which transaction will be void
     * @param _referralCode Code for later possible rewards in referral program
     */
    function borrow(
        address _onBehalf,
        uint128 _sendAmount,
        uint128 _minLoan,
        uint128 _maxRepay,
        uint256 _deadline,
        uint16 _referralCode
    ) external;

    /**
     * @notice Function which allows repayment of a loan
     * @dev The sent amount of loan currency must be sufficient to account
     * for any fees on transfer (if any)
     * @param _loanIdx Index of the loan to be repaid
     * @param _recipient Address that will receive the collateral transfer
     * @param _sendAmount Amount of loan currency sent for repayment.
     */
    function repay(
        uint256 _loanIdx,
        address _recipient,
        uint128 _sendAmount
    ) external;

    /**
     * @notice Function which allows repayment of a loan and roll over into new loan
     * @dev The old loan gets repaid and then a new loan with a new loan Id is taken out.
     * No actual transfers are made other than the interest
     * @param _loanIdx Index of the loan to be repaid
     * @param _minLoanLimit Minimum amount of loan currency acceptable from new loan.
     * @param _maxRepayLimit Maximum allowable loan currency amount borrower for new loan.
     * @param _deadline Timestamp after which transaction will be void
     * @param _referralCode Code for later possible rewards in referral program
     */
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
     * If address on behalf of is not sender, then sender must have permission to claim.
     * As well if reinvestment ootion is chosen, sender must have permission to add liquidity
     * @param _onBehalfOf Lp address which is owner or has approved sender to claim on their behalf (and possibly reinvest)
     * @param _loanIdxs Loan indices on which LP wants to claim
     * @param _isReinvested Flag for if LP wants claimed loanCcy to be re-invested
     * @param _deadline Deadline if reinvestment occurs. (If no reinvestment, this is ignored)
     */
    function claim(
        address _onBehalfOf,
        uint256[] calldata _loanIdxs,
        bool _isReinvested,
        uint256 _deadline
    ) external;

    /**
     * @notice Function will update the share pointer for the lp
     * @dev This function will allow an lp to skip his pointer ahead but
     * caution should be used since once an Lp has updated their from index
     * they lose all rights to any outstanding claims before that from index
     * @param _newSharePointer New location of the Lp's current share pointer
     */
    function overrideSharePointer(uint256 _newSharePointer) external;

    /**
     * @notice Function which handles aggregate claiming by LPs
     * @dev This function is much more efficient, but can only be used when LPs position size did not change
     * over the entire interval LP would like to claim over. _aggIdxs must be increasing array.
     * the first index of _aggIdxs is the from loan index to start aggregation, the rest of the
     * indices are the end loan indexes of the intervals he wants to claim.
     * If address on behalf of is not sender, then sender must have permission to claim.
     * As well if reinvestment option is chosen, sender must have permission to add liquidity
     * @param _onBehalfOf Lp address which is owner or has approved sender to claim on their behalf (and possibly reinvest)
     * @param _aggIdxs From index and end indices of the aggregation that LP wants to claim
     * @param _isReinvested Flag for if LP wants claimed loanCcy to be re-invested
     * @param _deadline Deadline if reinvestment occurs. (If no reinvestment, this is ignored)
     */
    function claimFromAggregated(
        address _onBehalfOf,
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

    /**
     * @notice Function which sets approval for another to perform a certain function on sender's behalf
     * @param _approvee This address is being given approval for the action(s) by the current sender
     * @param _approvals Array of flags to set which actions are approved or not approved
     */
    function setApprovals(address _approvee, bool[5] calldata _approvals)
        external;

    /**
     * @notice Function which gets the shares over time and loan indices where shares changed
     * @param _lpAddr Address of LP for which the info is being gathered
     * @return sharesOverTime array of number of shares Lp owned over time
     * @return loanIdxsWhereSharesChanged array of loan indices where the Lp changed number of shares
     */
    function getLpArrayInfo(address _lpAddr)
        external
        view
        returns (
            uint256[] memory sharesOverTime,
            uint256[] memory loanIdxsWhereSharesChanged
        );

    /**
     * @notice Function which calculates loan terms
     * @param _inAmountAfterFees Amount of collateral currency after fees are deducted
     * @return loanAmount Amount of loan currency to be trasnferred to the borrower
     * @return repaymentAmount Amount of loan currency borrower must repay to reclaim collateral
     * @return pledgeAmount Amount of collateral currency borrower retrieves upon repayment
     * @return _protocolFee Amount of collateral currency to be transferred to treasury
     * @return _totalLiquidity Total liquidity of the pool
     */
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

    function collCcyToken() external view returns (address);

    function loanCcyToken() external view returns (address);

    function maxLoanPerColl() external view returns (uint256);

    function protocolFee() external view returns (uint128);

    function totalLpShares() external view returns (uint128);

    function loanIdx() external view returns (uint256);

    function r1() external view returns (uint256);

    function r2() external view returns (uint256);

    function liquidityBnd1() external view returns (uint256);

    function liquidityBnd2() external view returns (uint256);

    function minLoan() external view returns (uint256);

    function loanIdxToBorrower(uint256) external view returns (address);

    function baseAggrBucketSize() external view returns (uint256);

    function isApproved(
        address _ownerOrBenficiary,
        address _sender,
        ApprovalTypes _approvalType
    ) external view returns (bool _approved);
}
