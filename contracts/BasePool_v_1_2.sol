// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBasePool_v_1_2} from "./interfaces/IBasePool_v_1_2.sol";

abstract contract BasePool_v_1_2 is IBasePool_v_1_2 {
    using SafeERC20 for IERC20Metadata;

    error IdenticalLoanAndCollCcy();
    error InvalidZeroAddress();
    error InvalidLoanTenor();
    error InvalidMaxLoanPerColl();
    error InvalidRateParams();
    error InvalidLiquidityBnds();
    error InvalidFee();
    error PastDeadline();
    error InsufficientLiquidity();
    error LoanTooSmall();
    error LoanBelowLimit();
    error ErroneousLoanTerms();
    error RepaymentAboveLimit();
    error InvalidLoanIdx();
    error UnapprovedSender();
    error CannotRepayAfterExpiry();
    error AlreadyRepaid();
    error InvalidSendAmount();
    error Invalid();

    uint256 constant BASE = 10 ** 18;
    uint256 constant MAX_FEE = 500 * 10 ** 14; // 5%, denominated in BASE

    address public poolCreator;
    address poolCreatorProposal;
    address immutable collCcyToken;
    address immutable loanCcyToken;

    uint256 immutable loanTenor; // in seconds
    uint256 immutable collTokenDecimals;
    uint256 maxLoanPerColl; // denominated in loanCcy decimals
    uint256 public creatorFee; // denominated in BASE
    uint256 public lockedCollateral; // collateral which is reserved for outstanding loans 
    uint256 loanIdx;
    uint256 r1; // denominated in BASE and w.r.t. tenor (i.e., not annualized)
    uint256 r2; // denominated in BASE and w.r.t. tenor (i.e., not annualized)
    uint256 liquidityBnd1; // denominated in loanCcy decimals
    uint256 liquidityBnd2; // denominated in loanCcy decimals
    uint256 minLoan; // denominated in loanCcy decimals
    mapping(uint256 => LoanInfo) public loanIdxToLoanInfo;
    mapping(uint256 => address) public loanIdxToBorrower;
    mapping(address => bool) public lpWhitelist;

    constructor(
        address _loanCcyToken,
        address _collCcyToken,
        uint256 _loanTenor,
        uint256 _maxLoanPerColl,
        uint256 _r1,
        uint256 _r2,
        uint256 _liquidityBnd1,
        uint256 _liquidityBnd2,
        uint256 _minLoan,
        uint256 _creatorFee
    ) {
        if (_collCcyToken == _loanCcyToken) revert IdenticalLoanAndCollCcy();
        if (_loanCcyToken == address(0) || _collCcyToken == address(0))
            revert InvalidZeroAddress();
        if (_loanTenor < 60 * 60) revert InvalidLoanTenor();
        if (_maxLoanPerColl == 0) revert InvalidMaxLoanPerColl();
        if (_r1 < _r2 ) revert InvalidRateParams();
        if (_liquidityBnd2 <= _liquidityBnd1 || _liquidityBnd1 == 0)
            revert InvalidLiquidityBnds();
        if (_creatorFee > MAX_FEE) revert InvalidFee();
        poolCreator = msg.sender;
        loanCcyToken = _loanCcyToken;
        collCcyToken = _collCcyToken;
        loanTenor = _loanTenor;
        maxLoanPerColl = _maxLoanPerColl;
        r1 = _r1;
        r2 = _r2;
        liquidityBnd1 = _liquidityBnd1;
        liquidityBnd2 = _liquidityBnd2;
        minLoan = _minLoan;
        loanIdx = 1;
        collTokenDecimals = IERC20Metadata(_collCcyToken).decimals();
        creatorFee = _creatorFee;
        emit NewSubPool(
            _loanCcyToken,
            _collCcyToken,
            _loanTenor,
            _maxLoanPerColl,
            _r1,
            _r2,
            _liquidityBnd1,
            _liquidityBnd2,
            _minLoan,
            _creatorFee
        );
    }


    // put in number of shares to remove, up to all of them
    function removeLiquidity(
        uint256 amount
    ) external override {
        if (msg.sender != poolCreator) revert UnapprovedSender();
        // transfer liquidity
        IERC20Metadata(loanCcyToken).safeTransfer(msg.sender, amount);
        // spawn event
        emit RemoveLiquidity(
            amount,
            loanIdx
        );
    }

    function borrow(
        uint128 _sendAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint256 _referralCode
    ) external override {
        uint256 _timestamp = checkTimestamp(_deadline);
        uint128 _inAmountAfterFees = _sendAmount -
            getCollCcyTransferFee(_sendAmount);
        // get borrow terms and do checks
        (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint32 expiry,
            uint256 _creatorFee
        ) = _borrow(
                _inAmountAfterFees,
                _minLoanLimit,
                _maxRepayLimit,
                _timestamp
            );
        
            uint256 _loanIdx = loanIdx;

            // update loan info
            loanIdxToBorrower[_loanIdx] = msg.sender;
            LoanInfo memory loanInfo;
            loanInfo.repayment = repaymentAmount;
            loanInfo.expiry = expiry;
            loanInfo.collateral = pledgeAmount;
            loanIdxToLoanInfo[_loanIdx] = loanInfo;

            // update loan idx counter
            loanIdx = _loanIdx + 1;
            lockedCollateral += pledgeAmount;

            // transfer _sendAmount (not pledgeAmount) in collateral ccy
            IERC20Metadata(collCcyToken).safeTransferFrom(
                msg.sender,
                address(this),
                _sendAmount
            );

            // transfer creator fee to creator in collateral ccy
            IERC20Metadata(collCcyToken).safeTransfer(poolCreator, _creatorFee);

            // transfer loanAmount in loan ccy
            IERC20Metadata(loanCcyToken).safeTransfer(msg.sender, loanAmount);

        // spawn event
        emit Borrow(
            msg.sender,
            loanIdx - 1,
            pledgeAmount,
            loanAmount,
            repaymentAmount,
            expiry,
            _referralCode
        );
    }

    function repay(
        uint256 _loanIdx,
        address _recipient,
        uint128 _sendAmount
    ) external override {
        // verify loan info and eligibility
        if (_loanIdx == 0 || _loanIdx >= loanIdx) revert InvalidLoanIdx();
        address _loanOwner = loanIdxToBorrower[_loanIdx];

        if (_loanOwner != msg.sender)
            revert UnapprovedSender();
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        uint256 timestamp = block.timestamp;
        if (timestamp > loanInfo.expiry) revert CannotRepayAfterExpiry();
        if (loanInfo.repaid) revert AlreadyRepaid();
        // update loan info
        loanInfo.repaid = true;
        uint128 _repayment = loanInfo.repayment;

        // transfer repayment amount
        uint128 repaymentAmountAfterFees = checkAndGetSendAmountAfterFees(
            _sendAmount,
            _repayment
        );
        // if repaymentAmountAfterFees was larger then update loan info
        // this ensures the extra repayment goes to the LPs
        if (repaymentAmountAfterFees != _repayment) {
            loanInfo.repayment = repaymentAmountAfterFees;
        }
        uint128 _collateral = loanInfo.collateral;
        lockedCollateral -= _collateral;       

        IERC20Metadata(loanCcyToken).safeTransferFrom(
            msg.sender,
            address(this),
            _sendAmount
        );
        // transfer collateral to _recipient (allows for possible
        // transfer directly to someone other than payer/sender)
        IERC20Metadata(collCcyToken).safeTransfer(_recipient, _collateral);
        // spawn event
        emit Repay(_loanOwner, _loanIdx, repaymentAmountAfterFees);
    }

    function proposeNewCreator(address newAddr) external {
        if (msg.sender != poolCreator) {
            revert UnapprovedSender();
        }
        poolCreatorProposal = newAddr;
    }

    function claimCreator() external {
        if (msg.sender != poolCreatorProposal) {
            revert UnapprovedSender();
        }
        address prevPoolCreator = poolCreator;
        lpWhitelist[prevPoolCreator] = false;
        lpWhitelist[msg.sender] = true;
        poolCreator = msg.sender;
        emit LpWhitelistUpdate(prevPoolCreator, false);
        emit LpWhitelistUpdate(msg.sender, true);
    }

    function toggleLpWhitelist(address newAddr) external {
        if (msg.sender != poolCreator) {
            revert UnapprovedSender();
        }
        bool newIsApproved = !lpWhitelist[newAddr];
        lpWhitelist[newAddr] = newIsApproved;
        emit LpWhitelistUpdate(newAddr, newIsApproved);
    }

    function getRateParams()
        external
        view
        returns (
            uint256 _liquidityBnd1,
            uint256 _liquidityBnd2,
            uint256 _r1,
            uint256 _r2
        )
    {
        _liquidityBnd1 = liquidityBnd1;
        _liquidityBnd2 = liquidityBnd2;
        _r1 = r1;
        _r2 = r2;
    }

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
        )
    {
        _loanCcyToken = loanCcyToken;
        _collCcyToken = collCcyToken;
        _maxLoanPerColl = maxLoanPerColl;
        _minLoan = minLoan;
        _loanTenor = loanTenor;
        _totalLiquidity = IERC20Metadata(_loanCcyToken).balanceOf(address(this));
        _loanIdx = loanIdx;
    }

    function loanTerms(
        uint128 _inAmountAfterFees
    )
        public
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint256 _creatorFee
        )
    {
        // compute terms (as uint256)
        _creatorFee = (_inAmountAfterFees * creatorFee) / BASE;
        uint256 pledge = _inAmountAfterFees - _creatorFee;
        uint256 _totalLiquidity = IERC20Metadata(loanCcyToken).balanceOf(address(this));
        uint256 loan = (pledge * maxLoanPerColl) / 10 ** collTokenDecimals;
        uint256 L_k = ((_totalLiquidity) * BASE * 9) /
            (BASE * 10);
        if (loan > L_k) {
            uint256 x_k = (L_k * 10 ** collTokenDecimals) / maxLoanPerColl;
            loan =
                ((pledge - x_k) *
                    maxLoanPerColl *
                    (_totalLiquidity - L_k)) /
                ((pledge - x_k) *
                    maxLoanPerColl +
                    (_totalLiquidity - L_k) *
                    10 ** collTokenDecimals) +
                L_k;
        }

        if (loan < minLoan) revert LoanTooSmall();
        uint256 postLiquidity = _totalLiquidity - loan;
        // we use the average rate to calculate the repayment amount
        uint256 avgRate = (getRate(_totalLiquidity) + getRate(postLiquidity)) /
            2;
        // if pre- and post-borrow liquidity are within target liquidity range
        // then the repayment amount exactly matches the amount of integrating the
        // loan size over the infinitesimal rate; else the repayment amount is
        // larger than the amount of integrating loan size over rate;
        uint256 repayment = (loan * (BASE + avgRate)) / BASE;
        // return terms (as uint128)
        assert(uint128(loan) == loan);
        loanAmount = uint128(loan);
        assert(uint128(repayment) == repayment);
        repaymentAmount = uint128(repayment);
        assert(uint128(pledge) == pledge);
        pledgeAmount = uint128(pledge);
        if (repaymentAmount < loanAmount) revert ErroneousLoanTerms();
    }

    /**
     * @notice Helper function when user is borrowing
     * @dev This function is called by borrow and rollover
     * @param _inAmountAfterFees Net amount of what was sent by borrower minus fees
     * @param _minLoanLimit Minimum loan currency amount acceptable to borrower
     * @param _maxRepayLimit Maximum allowable loan currency amount borrower is willing to repay
     * @param _timestamp Time that is used to set loan expiry
     * @return loanAmount Amount of loan Ccy given to the borrower
     * @return repaymentAmount Amount of loan Ccy borrower needs to repay to claim collateral
     * @return pledgeAmount Amount of collCcy reclaimable upon repayment
     * @return expiry Timestamp after which loan expires
     * @return _creatorFee Per transaction fee which levied for using the protocol
     */
    function _borrow(
        uint128 _inAmountAfterFees,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _timestamp
    )
        internal
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint32 expiry,
            uint256 _creatorFee
        )
    {
        // get and verify loan terms
        (
            loanAmount,
            repaymentAmount,
            pledgeAmount,
            _creatorFee
        ) = loanTerms(_inAmountAfterFees);
        assert(_inAmountAfterFees != 0); // if 0 must have failed in loanTerms(...)
        if (loanAmount < _minLoanLimit) revert LoanBelowLimit();
        if (repaymentAmount > _maxRepayLimit) revert RepaymentAboveLimit();
        expiry = uint32(_timestamp + loanTenor);
    }

    /**
     * @notice Helper function called whenever a function needs to check a deadline
     * @dev This function is called by addLiquidity, borrow, rollover, and if reinvestment on claiming,
     * it will be called by claimReinvestmentCheck
     * @param _deadline Last timestamp after which function will revert
     * @return timestamp Current timestamp passed back to function
     */
    function checkTimestamp(
        uint256 _deadline
    ) internal view returns (uint256 timestamp) {
        timestamp = block.timestamp;
        if (timestamp > _deadline) revert PastDeadline();
    }

    /**
     * @notice Function that returns the pool's rate given _liquidity to calculate
     * a loan's repayment amount.
     * @dev The rate is defined as a piecewise function with 3 ranges:
     * (1) low liquidity range: here the rate is defined as a reciprocal function
     * (2) target liquidity range: here the rate is linear
     * (3) high liquidity range: here the rate is constant
     * @param _liquidity The liquidity level for which the rate shall be calculated
     * @return rate The applicable rate
     */
    function getRate(uint256 _liquidity) internal view returns (uint256 rate) {
        if (_liquidity < liquidityBnd1) {
            rate = (r1 * liquidityBnd1) / _liquidity;
        } else if (_liquidity <= liquidityBnd2) {
            rate =
                r2 +
                ((r1 - r2) * (liquidityBnd2 - _liquidity)) /
                (liquidityBnd2 - liquidityBnd1);
        } else {
            rate = r2;
        }
    }

    /**
     * @notice Function which checks and returns loan ccy send amount after fees
     * @param _sendAmount Amount of loanCcy to be transferred
     * @param lowerBnd Minimum amount which is expected to be received at least
     */
    function checkAndGetSendAmountAfterFees(
        uint128 _sendAmount,
        uint128 lowerBnd
    ) internal view returns (uint128 sendAmountAfterFees) {
        sendAmountAfterFees = _sendAmount - getLoanCcyTransferFee(_sendAmount);
        // check range in case of rounding exact lowerBnd amount
        // cannot be hit; set upper bound to prevent fat finger
        if (
            sendAmountAfterFees < lowerBnd ||
            sendAmountAfterFees > (101 * lowerBnd) / 100
        ) revert InvalidSendAmount();
        return sendAmountAfterFees;
    }

    /**
     * @notice Function which gets fees (if any) on the collCcy
     * @param _transferAmount Amount of collCcy to be transferred
     */
    function getCollCcyTransferFee(
        uint128 _transferAmount
    ) internal view virtual returns (uint128);

    /**
     * @notice Function which gets fees (if any) on the loanCcy
     * @param _transferAmount Amount of loanCcy to be transferred
     */
    function getLoanCcyTransferFee(
        uint128 _transferAmount
    ) internal view virtual returns (uint128);

    function unlockCollateral(
        uint256[] calldata _loanIds
    ) external {
        uint256 totalUnlockableColl;
        for (uint256 i = 0; i < _loanIds.length; ) {
            LoanInfo storage loan = loanIdxToLoanInfo[_loanIds[i]];
            if (!loan.collUnlocked && block.timestamp > loan.expiry) {
                totalUnlockableColl += loan.collateral;
                loan.collUnlocked = true;
            }
            unchecked {
                i++;
            }
        }
        lockedCollateral -= totalUnlockableColl;
        uint256 currentCollTokenBalance = IERC20Metadata(collCcyToken).balanceOf(
            address(this)
        );
        IERC20Metadata(collCcyToken).safeTransfer(
            poolCreator,
            currentCollTokenBalance - lockedCollateral
        );
    }
}
