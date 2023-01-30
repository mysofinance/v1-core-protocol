// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

interface IBasePool_v_1_2 {
    event NewSubPool(
        address loanCcyToken,
        address collCcyToken,
        uint256 loanTenor,
        uint256 maxLoanPerColl,
        uint256 r1,
        uint256 r2,
        uint256 liquidityBnd1,
        uint256 liquidityBnd2,
        uint256 minLoan,
        uint256 creatorFee
    );

    event RemoveLiquidity(uint256 amount, uint256 indexed loanIdx);
    event Borrow(
        address indexed borrower,
        uint256 loanIdx,
        uint256 collateral,
        uint256 loanAmount,
        uint256 repaymentAmount,
        uint256 indexed expiry,
        uint256 indexed referralCode
    );
    event Repay(
        address indexed borrower,
        uint256 loanIdx,
        uint256 repaymentAmountAfterFees
    );
    event Rollover(
        address indexed borrower,
        uint256 loanIdx,
        uint256 collateral,
        uint256 loanAmount,
        uint256 repaymentAmount,
        uint256 indexed expiry
    );
    event UpdatedTerms(
        uint256 maxLoanPerColl,
        uint256 creatorFee,
        uint256 r1,
        uint256 r2,
        uint256 liquidityBnd1,
        uint256 liquidityBnd2
    );
    event LpWhitelistUpdate(address indexed lpAddr, bool isApproved);

    struct LoanInfo {
        // repayment amount due (post potential fees) to reclaim collateral
        uint128 repayment;
        // reclaimable collateral amount
        uint128 collateral;
        // add in earliest exercise
        //uint32 earliestExercise;
        // timestamp until repayment is possible and after which borrower forfeits collateral
        uint32 expiry;
        // flag whether loan was repaid or not
        bool repaid;
        //whether coll has been unlocked for this
        bool collUnlocked;
    }

    /**
     * @notice Function which removes shares from an LPs
     * @dev This function will remove loan currency
     * @param amount Amount of loan Coll to remove
     */
    function removeLiquidity(uint256 amount) external;

    /**
     * @notice Function which allows borrowing from the pool
     * _sendAmount Amount of collateral currency sent by borrower
     * _minLoan Minimum loan currency amount acceptable to borrower
     * _maxRepay Maximum allowable loan currency amount borrower is willing to repay
     * @param _deadline Timestamp after which transaction will be void
     * @param _referralCode Code for later possible rewards in referral program
     */
    function borrow(
        uint128[3] calldata limitsAndAmount,
        uint256 _deadline,
        uint256 _referralCode
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

    function rollOver(
        uint256 _loanIdx,
        uint128[3] calldata limitsAndAmount,
        uint256 _deadline
    ) external;

    /**
     * @notice Function which proposes a new pool creator address
     * @param _newAddr Address that is being proposed as new pool creator
     */
    function proposeNewCreator(address _newAddr) external;

    /**
     * @notice Function to claim proposed creator role
     */
    function claimCreator() external;

    /**
     * @notice Function which returns rate parameters need for interest rate calculation
     * @dev This function can be used to get parameters needed for interest rate calculations
     * @return _liquidityBnd1 Amount of liquidity the pool needs to end the reciprocal (hyperbola)
     * range and start "target" range
     * @return _liquidityBnd2 Amount of liquidity the pool needs to end the "target" range and start flat rate
     * @return _r1 Rate that is used at start of target range
     * @return _r2 Minimum rate at end of target range. This is minimum allowable rate
     */
    function getRateParams()
        external
        view
        returns (
            uint256 _liquidityBnd1,
            uint256 _liquidityBnd2,
            uint256 _r1,
            uint256 _r2
        );

    /**
     * @notice Function which returns pool information
     * @dev This function can be used to get pool information
     * @return _loanCcyToken Loan currency
     * @return _collCcyToken Collateral currency
     * @return _maxLoanPerColl Maximum loan amount per pledged collateral unit
     * @return _minLoan Minimum loan size
     * @return _loanTenor Loan tenor
     * @return _totalLiquidity Total liquidity available for loans
     * @return _loanIdx Loan index for the next incoming loan
     */
    function getPoolInfo()
        external
        view
        returns (
            address _loanCcyToken,
            address _collCcyToken,
            uint256 _maxLoanPerColl,
            uint256 _minLoan,
            uint256 _loanTenor,
            uint256 _totalLiquidity,
            uint256 _loanIdx
        );

    /**
     * @notice Function which calculates loan terms
     * @param _inAmountAfterFees Amount of collateral currency after fees are deducted
     * @return loanAmount Amount of loan currency to be trasnferred to the borrower
     * @return repaymentAmount Amount of loan currency borrower must repay to reclaim collateral
     * @return pledgeAmount Amount of collateral currency borrower retrieves upon repayment
     * @return _creatorFee Amount of collateral currency to be transferred to treasury
     */
    function loanTerms(
        uint128 _inAmountAfterFees
    )
        external
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint256 _creatorFee
        );

    /**
     * @notice Getter which returns the borrower for a given loan idx
     * @param loanIdx The loan idx
     * @return The borrower address
     */
    function loanIdxToBorrower(uint256 loanIdx) external view returns (address);
}
