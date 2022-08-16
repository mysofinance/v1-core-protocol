// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBasePool} from "./interfaces/IBasePool.sol";

abstract contract BasePool is IBasePool {
    using SafeERC20 for IERC20Metadata;

    error LoanCcyCannotBeZeroAddress();
    error CollCcyCannotBeZeroAddress();
    error CollAndLoanCcyCannotBeEqual();
    error InvalidLoanTenor();
    error InvalidMaxLoanPerColl();
    error InvalidRateParams();
    error InvalidTvlParams();
    error InvalidMinLoan();
    error PastDeadline();
    error InvalidAddAmount();
    error TooBigAddToLaterClaimOnRepay();
    error TooBigAddToLaterClaimColl();
    error NothingToRemove();
    error BeforeEarliestRemove();
    error InsufficientLiquidity();
    error InvalidRemovalAmount();
    error TooSmallLoan();
    error LoanBelowLimit();
    error ErroneousLoanTerms();
    error RepaymentAboveLimit();
    error InvalidLoanIdx();
    error InvalidSender();
    error InvalidSubAggregation();
    error UnauthorizedRepay();
    error CannotRepayAfterExpiry();
    error AlreadyRepaid();
    error CannotRepayInSameBlock();
    error InvalidSendAmount();
    error NothingToClaim();
    error MustBeLp();
    error InvalidNewSharePointer();
    error UnentitledFromLoanIdx();
    error LoanIdxsWithChangingShares();
    error InvalidFirstLengthPerClaimInterval();
    error NothingAggregatedToClaim();
    error NonAscendingLoanIdxs();
    error CannotClaimWithUnsettledLoan();
    error ProtocolFeeTooHigh();
    error InvalidApprovalAddress();

    address constant TREASURY = 0x1234567890000000000000000000000000000001;
    uint24 immutable LOAN_TENOR;
    uint32 constant MIN_LPING_PERIOD = 30;
    uint8 immutable COLL_TOKEN_DECIMALS;

    uint256 constant BASE = 10**18;
    uint256 constant MIN_LIQUIDITY = 100 * 10**6;
    uint256 public immutable maxLoanPerColl;
    address public immutable collCcyToken;
    address public immutable loanCcyToken;
    uint128 constant MAX_PROTOCOL_FEE = 5 * 10**15;

    uint128 public immutable protocolFee;
    uint128 public totalLpShares;
    uint256 totalLiquidity;
    uint256 public loanIdx;
    uint256 public r1;
    uint256 public r2;
    uint256 public tvl1;
    uint256 public tvl2;
    uint256 public minLoan;

    //must be a multiple of 100
    uint256 public firstLengthPerClaimInterval;

    mapping(address => LpInfo) public addrToLpInfo;
    mapping(uint256 => LoanInfo) public loanIdxToLoanInfo;
    mapping(uint256 => address) public loanIdxToBorrower;

    mapping(address => mapping(address => mapping(IBasePool.ApprovalTypes => bool)))
        public isApproved;

    mapping(uint256 => AggClaimsInfo) collAndRepayTotalBaseAgg1;
    mapping(uint256 => AggClaimsInfo) collAndRepayTotalBaseAgg2;
    mapping(uint256 => AggClaimsInfo) collAndRepayTotalBaseAgg3;

    mapping(uint256 => mapping(uint256 => AggClaimsInfo)) loanIdxRangeToAggClaimsInfo;

    struct LpInfo {
        // lower bound loan idx (incl.) from which lp is entitled to claim
        uint32 fromLoanIdx;
        // timestamp from which on lp is allowed to remove liquidty
        uint32 earliestRemove;
        // current pointer...
        uint32 currSharePtr;
        // array of len n, with elements representing number of sharesOverTime and new elements being added for consecutive adding/removing of liquidity
        uint256[] sharesOverTime;
        // array of len n-1, with elements representing upper bound loan idx bounds (excl.), where lp can claim until loanIdxsWhereSharesChanged[i] with sharesOverTime[i]; and if index i is outside of bounds of loanIdxsWhereSharesChanged[] then lp can claim up until latest loan idx with sharesOverTime[i]
        uint256[] loanIdxsWhereSharesChanged;
    }

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

    constructor(
        address _loanCcyToken,
        address _collCcyToken,
        uint24 _loanTenor,
        uint128 _maxLoanPerColl,
        uint256 _r1,
        uint256 _r2,
        uint256 _tvl1,
        uint256 _tvl2,
        uint256 _minLoan,
        uint256 _firstLengthPerClaimInterval,
        uint128 _protocolFee
    ) {
        if (_loanCcyToken == address(0)) revert LoanCcyCannotBeZeroAddress();
        if (_collCcyToken == address(0)) revert CollCcyCannotBeZeroAddress();
        if (_collCcyToken == _loanCcyToken)
            revert CollAndLoanCcyCannotBeEqual();
        if (_loanTenor < 86400) revert InvalidLoanTenor();
        if (_maxLoanPerColl == 0) revert InvalidMaxLoanPerColl();
        if (_r1 <= _r2 || _r2 == 0) revert InvalidRateParams();
        if (_tvl2 <= _tvl1 || _tvl1 == 0) revert InvalidTvlParams();
        if (_minLoan == 0) revert InvalidMinLoan();
        assert(MIN_LIQUIDITY != 0 && MIN_LIQUIDITY <= _minLoan);
        if (
            _firstLengthPerClaimInterval < 100 ||
            _firstLengthPerClaimInterval % 100 != 0
        ) revert InvalidFirstLengthPerClaimInterval();
        if (_protocolFee > MAX_PROTOCOL_FEE) revert ProtocolFeeTooHigh();
        loanCcyToken = _loanCcyToken;
        collCcyToken = _collCcyToken;
        LOAN_TENOR = _loanTenor;
        maxLoanPerColl = _maxLoanPerColl;
        r1 = _r1;
        r2 = _r2;
        tvl1 = _tvl1;
        tvl2 = _tvl2;
        minLoan = _minLoan;
        loanIdx = 1;
        COLL_TOKEN_DECIMALS = IERC20Metadata(_collCcyToken).decimals();
        firstLengthPerClaimInterval = _firstLengthPerClaimInterval;
        protocolFee = _protocolFee;
        emit NewSubPool(
            _loanCcyToken,
            _collCcyToken,
            _loanTenor,
            _maxLoanPerColl,
            _r1,
            _r2,
            _tvl1,
            _tvl2,
            _minLoan
        );
    }

    function getTotalLiquidity() public view virtual returns (uint256);

    function getCollCcyTransferFee(uint128 _transferAmount)
        internal
        view
        virtual
        returns (uint128);

    function getLoanCcyTransferFee(uint128 _transferAmount)
        internal
        view
        virtual
        returns (uint128);

    function addLiquidity(
        address _onBehalfOf,
        uint128 _sendAmount,
        uint256 _deadline,
        uint16 _referralCode
    ) public override {
        // verify lp info and eligibility
        checkTimestamp(_deadline);
        checkApproval(_onBehalfOf, IBasePool.ApprovalTypes.ADD_LIQUIDITY);

        uint128 _inAmountAfterFees = _sendAmount -
            getLoanCcyTransferFee(_sendAmount);

        (
            uint256 dust,
            uint256 newLpShares,
            uint32 earliestRemove
        ) = _addLiquidity(_onBehalfOf, _inAmountAfterFees);

        // transfer liquidity
        IERC20Metadata(loanCcyToken).safeTransferFrom(
            msg.sender,
            address(this),
            _sendAmount
        );

        // transfer dust to treasury if any
        if (dust > 0) {
            IERC20Metadata(loanCcyToken).safeTransfer(TREASURY, dust);
        }
        // spawn event
        emit AddLiquidity(
            _sendAmount,
            newLpShares,
            totalLiquidity,
            totalLpShares,
            earliestRemove,
            _referralCode
        );
    }

    // put in number of shares to remove, up to all of them
    function removeLiquidity(address _onBehalfOf, uint256 numShares)
        external
        override
    {
        // verify lp info and eligibility
        checkApproval(_onBehalfOf, IBasePool.ApprovalTypes.REMOVE_LIQUIDITY);

        LpInfo storage lpInfo = addrToLpInfo[_onBehalfOf];
        uint256 shareLength = lpInfo.sharesOverTime.length;
        if (shareLength * numShares == 0) revert NothingToRemove();
        if (lpInfo.sharesOverTime[shareLength - 1] < numShares)
            revert InvalidRemovalAmount();
        if (block.timestamp < lpInfo.earliestRemove)
            revert BeforeEarliestRemove();
        uint256 _totalLiquidity = getTotalLiquidity();
        // update state of pool
        uint256 liquidityRemoved = (numShares *
            (_totalLiquidity - MIN_LIQUIDITY)) / totalLpShares;
        totalLpShares -= uint128(numShares);
        totalLiquidity = _totalLiquidity - liquidityRemoved;
        lpInfo.sharesOverTime.push(
            lpInfo.sharesOverTime[shareLength - 1] - numShares
        );
        lpInfo.loanIdxsWhereSharesChanged.push(loanIdx);

        // transfer liquidity
        IERC20Metadata(loanCcyToken).safeTransfer(msg.sender, liquidityRemoved);
        // spawn event
        emit RemoveLiquidity(
            liquidityRemoved,
            numShares,
            totalLiquidity,
            totalLpShares
        );
    }

    function loanTerms(uint128 _inAmountAfterFees)
        public
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint128 _protocolFee,
            uint256 _totalLiquidity
        )
    {
        // compute terms (as uint256)
        _protocolFee = uint128((_inAmountAfterFees * protocolFee) / BASE);
        uint256 pledge = _inAmountAfterFees - _protocolFee;
        _totalLiquidity = getTotalLiquidity();
        if (_totalLiquidity <= MIN_LIQUIDITY) revert InsufficientLiquidity();
        uint256 loan = (pledge *
            maxLoanPerColl *
            (_totalLiquidity - MIN_LIQUIDITY)) /
            (pledge *
                maxLoanPerColl +
                (_totalLiquidity - MIN_LIQUIDITY) *
                10**COLL_TOKEN_DECIMALS);
        if (loan < minLoan) revert TooSmallLoan();
        uint256 postLiquidity = _totalLiquidity - loan;
        assert(postLiquidity >= MIN_LIQUIDITY);
        uint256 rate;
        if (postLiquidity < tvl1) {
            rate = (r1 * tvl1) / postLiquidity;
        } else if (postLiquidity < tvl2) {
            rate = ((r1 - r2) * (tvl2 - postLiquidity)) / (tvl2 - tvl1) + r2;
        } else {
            rate = r2;
        }
        uint256 repayment = (loan * (BASE + rate)) / BASE;
        // return terms (as uint128)
        loanAmount = uint128(loan);
        repaymentAmount = uint128(repayment);
        pledgeAmount = uint128(pledge);
        if (repaymentAmount <= loanAmount) revert ErroneousLoanTerms();
    }

    function borrow(
        address _onBehalf,
        uint128 _sendAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint16 _referralCode
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
            uint128 _protocolFee,
            uint256 _totalLiquidity
        ) = _borrow(
                _inAmountAfterFees,
                _minLoanLimit,
                _maxRepayLimit,
                _timestamp
            );
        {
            // update pool state
            totalLiquidity = _totalLiquidity - loanAmount;

            // update loan info
            loanIdxToBorrower[loanIdx] = _onBehalf;
            LoanInfo memory loanInfo;
            loanInfo.repayment = repaymentAmount;
            loanInfo.totalLpShares = totalLpShares;
            loanInfo.expiry = expiry;
            loanInfo.collateral = pledgeAmount;
            loanIdxToLoanInfo[loanIdx] = loanInfo;
        }
        {
            // update aggregations
            uint128 collateral = uint128((pledgeAmount * BASE) / totalLpShares);
            collAndRepayTotalBaseAgg1[loanIdx / firstLengthPerClaimInterval + 1]
                .collateral += collateral;
            collAndRepayTotalBaseAgg2[
                (loanIdx / (firstLengthPerClaimInterval * 10)) + 1
            ].collateral += collateral;
            collAndRepayTotalBaseAgg3[
                (loanIdx / (firstLengthPerClaimInterval * 100)) + 1
            ].collateral += collateral;

            // update loan idx counter
            loanIdx += 1;
        }
        {
            // transfer _sendAmount (not pledgeAmount) in collateral ccy
            IERC20Metadata(collCcyToken).safeTransferFrom(
                msg.sender,
                address(this),
                _sendAmount
            );

            // transfer protocol fee to treasury in collateral ccy
            IERC20Metadata(collCcyToken).safeTransfer(TREASURY, _protocolFee);

            // transfer loanAmount in loan ccy
            IERC20Metadata(loanCcyToken).safeTransfer(_onBehalf, loanAmount);
        }
        // spawn event
        emit Borrow(
            loanIdx - 1,
            pledgeAmount,
            loanAmount,
            repaymentAmount,
            expiry,
            _protocolFee,
            _referralCode
        );
    }

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
            uint128 _protocolFee,
            uint256 _totalLiquidity
        )
    {
        // get and verify loan terms
        (
            loanAmount,
            repaymentAmount,
            pledgeAmount,
            _protocolFee,
            _totalLiquidity
        ) = loanTerms(_inAmountAfterFees);
        assert(_inAmountAfterFees != 0); // if 0 must have failed in loanTerms(...)
        if (loanAmount < _minLoanLimit) revert LoanBelowLimit();
        if (repaymentAmount > _maxRepayLimit) revert RepaymentAboveLimit();
        expiry = uint32(_timestamp) + LOAN_TENOR;
    }

    function repay(
        uint256 _loanIdx,
        address _recipient,
        uint128 _sendAmount
    ) external override {
        // verify loan info and eligibility
        if (_loanIdx == 0 || _loanIdx >= loanIdx) revert InvalidLoanIdx();
        checkApproval(
            loanIdxToBorrower[_loanIdx],
            IBasePool.ApprovalTypes.REPAY
        );
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        uint256 timestamp = block.timestamp;
        if (timestamp > loanInfo.expiry) revert CannotRepayAfterExpiry();
        if (loanInfo.repaid) revert AlreadyRepaid();
        if (timestamp == loanInfo.expiry - LOAN_TENOR)
            revert CannotRepayInSameBlock();
        // update loan info
        loanInfo.repaid = true;

        //update the aggregation mappings
        updateAggregations(
            _loanIdx,
            loanInfo.collateral,
            loanInfo.repayment,
            loanInfo.totalLpShares
        );

        // transfer repayment amount
        uint128 repaymentAmountAfterFees = _sendAmount -
            getLoanCcyTransferFee(_sendAmount);
        // set range in case of rounding exact repayment amount
        // cannot be hit; set upper bound to prevent fat finger
        if (
            repaymentAmountAfterFees < loanInfo.repayment ||
            repaymentAmountAfterFees > (101 * loanInfo.repayment) / 100
        ) revert InvalidSendAmount();
        IERC20Metadata(loanCcyToken).safeTransferFrom(
            msg.sender,
            address(this),
            _sendAmount
        );
        // transfer collateral
        IERC20Metadata(collCcyToken).safeTransfer(
            _recipient,
            loanInfo.collateral
        );
        // spawn event
        emit Repay(_loanIdx);
    }

    function rollOver(
        uint256 _loanIdx,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint16 _referralCode
    ) external override {
        uint256 timestamp = checkTimestamp(_deadline);
        // verify loan info and eligibility
        if (_loanIdx == 0 || _loanIdx >= loanIdx) revert InvalidLoanIdx();
        if (loanIdxToBorrower[_loanIdx] != msg.sender)
            revert UnauthorizedRepay();
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        {
            if (timestamp > loanInfo.expiry) revert CannotRepayAfterExpiry();
            if (loanInfo.repaid) revert AlreadyRepaid();
            if (timestamp == loanInfo.expiry - LOAN_TENOR)
                revert CannotRepayInSameBlock();
        }
        // get terms for new borrow
        (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint32 expiry,
            uint128 _protocolFee,
            uint256 _totalLiquidity
        ) = _borrow(
                loanInfo.collateral,
                _minLoanLimit,
                _maxRepayLimit,
                _deadline
            );

        // update the aggregation mappings
        updateAggregations(
            _loanIdx,
            loanInfo.collateral,
            loanInfo.repayment,
            loanInfo.totalLpShares
        );

        {
            // set new loan info
            loanInfo.repaid = true;
            loanIdxToBorrower[loanIdx] = msg.sender;
            LoanInfo memory loanInfoNew;
            loanInfoNew.expiry = expiry;
            loanInfoNew.totalLpShares = totalLpShares;
            loanInfoNew.repayment = repaymentAmount;
            loanInfoNew.collateral = pledgeAmount;
            loanIdxToLoanInfo[loanIdx] = loanInfoNew;
            loanIdx += 1;
            totalLiquidity = _totalLiquidity - loanAmount;
            // transfer liquidity
            IERC20Metadata(loanCcyToken).safeTransferFrom(
                msg.sender,
                address(this),
                loanInfo.repayment - loanAmount
            );
        }
        // spawn event
        emit Roll(
            _loanIdx,
            loanIdx - 1,
            pledgeAmount,
            loanInfo.repayment - loanAmount,
            _referralCode
        );
    }

    function claim(
        address _onBehalfOf,
        uint256[] calldata _loanIdxs,
        bool _isReinvested,
        uint256 _deadline
    ) external override {
        // if lp wants to reinvest check deadline
        if (_isReinvested) checkTimestamp(_deadline);
        checkApproval(_onBehalfOf, IBasePool.ApprovalTypes.CLAIM);
        LpInfo storage lpInfo = addrToLpInfo[_onBehalfOf];

        // verify lp info and eligibility
        uint256 loanIdxsLen = _loanIdxs.length;
        //length of sharesOverTime array for LP
        uint256 sharesOverTimeLen = lpInfo.sharesOverTime.length;
        if (loanIdxsLen * sharesOverTimeLen == 0) revert NothingToClaim();
        if (_loanIdxs[0] == 0) revert InvalidLoanIdx();

        (
            uint256 sharesUnchangedUntilLoanIdx,
            uint256 applicableShares
        ) = claimsChecksAndSetters(
                _loanIdxs[0],
                _loanIdxs[loanIdxsLen - 1],
                lpInfo
            );

        // iterate over loans to get claimable amounts
        (uint256 repayments, uint256 collateral) = getClaimsFromList(
            _loanIdxs,
            loanIdxsLen,
            applicableShares
        );

        // update lp's from loan index to prevent double claiming and check share pointer
        checkSharePtrIncrement(
            lpInfo,
            _loanIdxs[loanIdxsLen - 1],
            lpInfo.currSharePtr,
            sharesUnchangedUntilLoanIdx
        );

        claimTransferAndReinvestment(
            _onBehalfOf,
            repayments,
            collateral,
            _isReinvested
        );

        // spawn event
        emit Claim(_loanIdxs, repayments, collateral);
    }

    function overrideSharePointer(uint256 _newSharePointer) external {
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.fromLoanIdx == 0) revert MustBeLp();
        if (
            _newSharePointer == 0 ||
            _newSharePointer <= lpInfo.currSharePtr ||
            _newSharePointer > lpInfo.sharesOverTime.length - 1 ||
            _newSharePointer > lpInfo.loanIdxsWhereSharesChanged.length - 1
        ) revert InvalidNewSharePointer();
        lpInfo.currSharePtr = uint32(_newSharePointer);
        lpInfo.fromLoanIdx = uint32(
            lpInfo.loanIdxsWhereSharesChanged[_newSharePointer]
        );
    }

    function claimFromAggregated(
        address _onBehalfOf,
        uint256[] calldata _aggIdxs,
        bool _isReinvested,
        uint256 _deadline
    ) external override {
        //check if reinvested is chosen that deadline is valid
        if (_isReinvested) checkTimestamp(_deadline);
        checkApproval(_onBehalfOf, IBasePool.ApprovalTypes.CLAIM);
        LpInfo storage lpInfo = addrToLpInfo[_onBehalfOf];

        // verify lp info and eligibility
        //length of loanIdxs array lp wants to claim
        uint256 lengthArr = _aggIdxs.length;
        //checks if loanIds passed in are empty or if the sharesOverTime array is empty
        //in which case, the Lp has no positions.
        if (lpInfo.sharesOverTime.length == 0 || lengthArr < 2)
            revert NothingToClaim();

        (
            uint256 sharesUnchangedUntilLoanIdx,
            uint256 applicableShares
        ) = claimsChecksAndSetters(
                _aggIdxs[0],
                _aggIdxs[lengthArr - 1] - 1,
                lpInfo
            );

        //local variables to track repayments and collateral claimed
        uint256 totalRepayments;
        uint256 totalCollateral;

        //local variables for each iteration's repayments and collateral
        uint256 repayments;
        uint256 collateral;

        //iterate over the length of the passed in array
        for (uint256 counter = 0; counter < lengthArr - 1; ) {
            //make sure input loan indices are strictly increasing
            if (_aggIdxs[counter] >= _aggIdxs[counter + 1])
                revert NonAscendingLoanIdxs();

            //get aggregated claims
            (repayments, collateral) = getClaimsFromAggregated(
                _aggIdxs[counter],
                _aggIdxs[counter + 1],
                applicableShares
            );
            //update total repayment amount and total collateral amount
            totalRepayments += repayments;
            totalCollateral += collateral;

            unchecked {
                //increment local counter
                counter++;
            }
        }

        // update lp's from loan index to prevent double claiming and check share pointer
        checkSharePtrIncrement(
            lpInfo,
            _aggIdxs[lengthArr - 1],
            lpInfo.currSharePtr,
            sharesUnchangedUntilLoanIdx
        );

        claimTransferAndReinvestment(
            _onBehalfOf,
            totalRepayments,
            totalCollateral,
            _isReinvested
        );
        //spawn event
        emit ClaimFromAggregated(
            _aggIdxs[0],
            _aggIdxs[lengthArr - 1],
            totalRepayments,
            totalCollateral
        );
    }

    function getClaimsFromList(
        uint256[] calldata _loanIdxs,
        uint256 arrayLen,
        uint256 _shares
    ) internal view returns (uint256 repayments, uint256 collateral) {
        // aggregate claims from list
        for (uint256 i = 0; i < arrayLen; ) {
            LoanInfo memory loanInfo = loanIdxToLoanInfo[_loanIdxs[i]];
            if (i > 0) {
                if (_loanIdxs[i] <= _loanIdxs[i - 1])
                    revert NonAscendingLoanIdxs();
            }
            if (loanInfo.repaid) {
                repayments +=
                    (loanInfo.repayment * BASE) /
                    loanInfo.totalLpShares;
            } else if (loanInfo.expiry < block.timestamp) {
                collateral +=
                    (loanInfo.collateral * BASE) /
                    loanInfo.totalLpShares;
            } else {
                revert CannotClaimWithUnsettledLoan();
            }
            unchecked {
                i++;
            }
        }
        // return claims
        repayments = (repayments * _shares) / BASE;
        collateral = (collateral * _shares) / BASE;
    }

    function getClaimsFromAggregated(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256 _shares
    ) public view returns (uint256 repayments, uint256 collateral) {
        uint256 fromToDiff = _toLoanIdx - _fromLoanIdx;
        // check that the difference in the from and to indices
        // span one of allowable intervals and that _toLoanIdx is
        // also the correct modulus for that difference
        if (
            !((_toLoanIdx % firstLengthPerClaimInterval == 0 &&
                fromToDiff == firstLengthPerClaimInterval) ||
                (_toLoanIdx % (10 * firstLengthPerClaimInterval) == 0 &&
                    fromToDiff == firstLengthPerClaimInterval * 10) ||
                (_toLoanIdx % (100 * firstLengthPerClaimInterval) == 0 &&
                    fromToDiff == firstLengthPerClaimInterval * 100))
        ) revert InvalidSubAggregation();
        //expiry check to make sure last loan in aggregation (one prior to _toLoanIdx for bucket) was taken out and expired
        uint32 expiryCheck = loanIdxToLoanInfo[_toLoanIdx - 1].expiry;
        if (expiryCheck == 0 || expiryCheck + 1 > block.timestamp) {
            revert InvalidSubAggregation();
        }
        AggClaimsInfo memory aggClaimsInfo;
        //find which bucket to which the current aggregation belongs and get aggClaimsInfo
        if (fromToDiff == firstLengthPerClaimInterval) {
            aggClaimsInfo = collAndRepayTotalBaseAgg1[
                _fromLoanIdx / firstLengthPerClaimInterval + 1
            ];
        } else if (fromToDiff == firstLengthPerClaimInterval * 10) {
            aggClaimsInfo = collAndRepayTotalBaseAgg2[
                (_fromLoanIdx / (firstLengthPerClaimInterval * 10)) + 1
            ];
        } else {
            aggClaimsInfo = collAndRepayTotalBaseAgg3[
                (_fromLoanIdx / (firstLengthPerClaimInterval * 100)) + 1
            ];
        }
        //make sure not an empty bucket
        if (aggClaimsInfo.repayments == 0 && aggClaimsInfo.collateral == 0)
            revert NothingAggregatedToClaim();
        //return repayment and collateral amounts
        repayments = (aggClaimsInfo.repayments * _shares) / BASE;
        collateral = (aggClaimsInfo.collateral * _shares) / BASE;
    }

    function updateAggregations(
        uint256 _loanIdx,
        uint128 _collateral,
        uint128 _repayment,
        uint128 _totalLpShares
    ) internal {
        uint128 collateralUpdate = uint128(
            (_collateral * BASE) / _totalLpShares
        );
        uint128 repaymentUpdate = uint128((_repayment * BASE) / _totalLpShares);
        //first aggregation updates
        collAndRepayTotalBaseAgg1[_loanIdx / firstLengthPerClaimInterval + 1]
            .collateral -= collateralUpdate;
        collAndRepayTotalBaseAgg1[_loanIdx / firstLengthPerClaimInterval + 1]
            .repayments += repaymentUpdate;

        //second aggregation updates
        collAndRepayTotalBaseAgg2[
            (_loanIdx / (firstLengthPerClaimInterval * 10)) + 1
        ].collateral -= collateralUpdate;
        collAndRepayTotalBaseAgg2[
            (_loanIdx / (firstLengthPerClaimInterval * 10)) + 1
        ].repayments += repaymentUpdate;

        //third aggregation updates
        collAndRepayTotalBaseAgg3[
            (_loanIdx / (firstLengthPerClaimInterval * 100)) + 1
        ].collateral -= collateralUpdate;
        collAndRepayTotalBaseAgg3[
            (_loanIdx / (firstLengthPerClaimInterval * 100)) + 1
        ].repayments += repaymentUpdate;
    }

    function getNumShares(address _lpAddr)
        external
        view
        returns (uint256 numShares)
    {
        LpInfo memory lpInfo = addrToLpInfo[_lpAddr];
        uint256 sharesLen = lpInfo.sharesOverTime.length;
        if (sharesLen > 0) {
            numShares = lpInfo.sharesOverTime[sharesLen - 1];
        }
    }

    function toggleRepayAndLiquidityApproval(
        address _recipient,
        IBasePool.ApprovalTypes _approvalType
    ) external {
        if (msg.sender == _recipient || _recipient == address(0))
            revert InvalidApprovalAddress();
        isApproved[msg.sender][_recipient][_approvalType] = !isApproved[
            msg.sender
        ][_recipient][_approvalType];
    }

    function checkSharePtrIncrement(
        LpInfo storage _lpInfo,
        uint256 _lastIdxFromUserInput,
        uint256 _currSharePtr,
        uint256 _sharesUnchangedUntilLoanIdx
    ) internal {
        //update LPs from loan index
        _lpInfo.fromLoanIdx = uint32(_lastIdxFromUserInput) + 1;
        //if current share pointer is not already at end and
        //the last loan claimed was exactly one below the currentToLoanIdx
        //then increment the current share pointer
        if (
            _currSharePtr < _lpInfo.sharesOverTime.length - 1 &&
            _lastIdxFromUserInput + 1 == _sharesUnchangedUntilLoanIdx
        ) {
            unchecked {
                _lpInfo.currSharePtr++;
            }
        }
    }

    function checkTimestamp(uint256 _deadline)
        internal
        view
        returns (uint256 timestamp)
    {
        timestamp = block.timestamp;
        if (timestamp > _deadline) revert PastDeadline();
    }

    function checkApproval(
        address _onBehalfOf,
        IBasePool.ApprovalTypes _approvalType
    ) internal view {
        if (
            (_onBehalfOf != msg.sender &&
                (!isApproved[_onBehalfOf][msg.sender][_approvalType]))
        ) revert InvalidSender();
    }

    function claimsChecksAndSetters(
        uint256 _startIndex,
        uint256 _endIndex,
        LpInfo storage _lpInfo
    )
        internal
        returns (
            uint256 _sharesUnchangedUntilLoanIdx,
            uint256 _applicableShares
        )
    {
        // check if reasonable to automatically increment sharepointer for intermediate period with zero shares
        // and push fromLoanIdx forward
        uint256 currSharePtr = _lpInfo.currSharePtr;
        if (
            _lpInfo.sharesOverTime[currSharePtr] == 0 &&
            currSharePtr < _lpInfo.sharesOverTime.length - 1
        ) {
            _lpInfo.currSharePtr++;
            currSharePtr++;
            _lpInfo.fromLoanIdx = uint32(
                _lpInfo.loanIdxsWhereSharesChanged[currSharePtr]
            );
        }

        /*
        first loan index (which is what _fromLoanIdx will become)
        cannot be less than lpInfo.fromLoanIdx (double-claiming or not entitled since
        wasn't invested during that time), unless special case of first loan globally
        and LpInfo.fromLoanIdx is 1
        Note: This still works for claim, since in that function startIndex !=0 is already
        checked, so second part is always true in claim function
        */
        if (
            _startIndex < _lpInfo.fromLoanIdx &&
            !(_startIndex == 0 && _lpInfo.fromLoanIdx == 1)
        ) revert UnentitledFromLoanIdx();

        // infer applicable upper loan idx for which number of shares didn't change
        _sharesUnchangedUntilLoanIdx = currSharePtr ==
            _lpInfo.sharesOverTime.length - 1
            ? loanIdx
            : _lpInfo.loanIdxsWhereSharesChanged[currSharePtr];

        // check passed last loan idx is consistent with constant share interval
        if (_endIndex >= _sharesUnchangedUntilLoanIdx)
            revert LoanIdxsWithChangingShares();

        // get applicable number of shares for pro-rata calculations (given current share pointer position)
        _applicableShares = _lpInfo.sharesOverTime[currSharePtr];
    }

    function claimTransferAndReinvestment(
        address _onBehalfOf,
        uint256 _repayments,
        uint256 _collateral,
        bool _isReinvested
    ) internal {
        if (_repayments > 0) {
            if (_isReinvested) {
                //allows reinvestment and transfer of any dust from claim functions
                (
                    uint256 dust,
                    uint256 newLpShares,
                    uint32 earliestRemove
                ) = _addLiquidity(_onBehalfOf, _repayments);
                if (dust > 0) {
                    IERC20Metadata(loanCcyToken).safeTransfer(TREASURY, dust);
                }
                // spawn event
                emit Reinvest(_repayments, newLpShares, earliestRemove);
            } else {
                IERC20Metadata(loanCcyToken).safeTransfer(
                    msg.sender,
                    _repayments
                );
            }
        }
        //transfer collateral
        if (_collateral > 0) {
            IERC20Metadata(collCcyToken).safeTransfer(_onBehalfOf, _collateral);
        }
    }

    function _addLiquidity(address _onBehalfOf, uint256 _inAmountAfterFees)
        internal
        returns (
            uint256 dust,
            uint256 newLpShares,
            uint32 earliestRemove
        )
    {
        uint256 _totalLiquidity = getTotalLiquidity();
        if (
            _inAmountAfterFees < MIN_LIQUIDITY ||
            _inAmountAfterFees + _totalLiquidity < minLoan
        ) revert InvalidAddAmount();
        // retrieve lpInfo of sender
        LpInfo storage lpInfo = addrToLpInfo[_onBehalfOf];

        // update state of pool
        if (_totalLiquidity == 0 && totalLpShares == 0) {
            newLpShares = _inAmountAfterFees;
        } else if (totalLpShares == 0) {
            dust = _totalLiquidity;
            _totalLiquidity = 0;
            newLpShares = _inAmountAfterFees;
        } else {
            assert(_totalLiquidity > 0 && totalLpShares > 0);
            newLpShares = uint128(
                (_inAmountAfterFees * uint256(totalLpShares)) / _totalLiquidity
            );
        }
        totalLpShares += uint128(newLpShares);
        // purposefully first divide and then multiply to emulate order of operations in claiming
        if (((minLoan * BASE) / totalLpShares) * newLpShares == 0)
            revert TooBigAddToLaterClaimOnRepay();
        if (
            ((((10**COLL_TOKEN_DECIMALS * minLoan) / maxLoanPerColl) * BASE) /
                totalLpShares) *
                newLpShares ==
            0
        ) revert TooBigAddToLaterClaimColl();
        totalLiquidity = _totalLiquidity + _inAmountAfterFees;
        // update lp info
        bool isFirstAddLiquidity = lpInfo.fromLoanIdx == 0;
        if (isFirstAddLiquidity) {
            lpInfo.fromLoanIdx = uint32(loanIdx);
            lpInfo.sharesOverTime.push(newLpShares);
        } else {
            lpInfo.sharesOverTime.push(
                newLpShares +
                    lpInfo.sharesOverTime[lpInfo.sharesOverTime.length - 1]
            );
            lpInfo.loanIdxsWhereSharesChanged.push(loanIdx);
        }
        earliestRemove = uint32(block.timestamp) + MIN_LPING_PERIOD;
        lpInfo.earliestRemove = earliestRemove;
    }
}
