// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBasePool} from "./interfaces/IBasePool.sol";
import {IWETH} from "./interfaces/IWETH.sol";

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
    error CannotAddWhileActiveOrWithOpenClaims();
    error TooBigAddToLaterClaimOnRepay();
    error TooBigAddToLaterClaimColl();
    error NothingToRemove();
    error BeforeEarliestRemove();
    error MustBeActiveLp();
    error InconsistentMsgValue();
    error InvalidPledgeAmount();
    error InvalidPledgeAfterTransferFee();
    error TooSmallLoan();
    error LoanBelowLimit();
    error ErroneousLoanTerms();
    error RepaymentAboveLimit();
    error InvalidLoanIdx();
    error InvalidSubAggregation();
    error EmptyAggregationArray();
    error UnauthorizedRepay();
    error CannotRepayAfterExpiry();
    error AlreadyRepaid();
    error CannotRepayInSameBlock();
    error NothingToClaim();
    error UnentitledFromLoanIdx();
    error UnentitledToLoanIdx();
    error InvalidFromToAggregation();
    error InvalidFirstLengthPerClaimInterval();
    error NothingAggregatedToClaim();
    error NonAscendingLoanIdxs();
    error CannotClaimWithUnsettledLoan();
    error UnauthorizedFeeUpdate();
    error NewFeeMustBeDifferent();
    error NewFeeTooHigh();

    address public constant TREASURY =
        0x1234567890000000000000000000000000000001;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    uint24 immutable LOAN_TENOR;
    uint32 constant MIN_LPING_PERIOD = 30;
    uint8 immutable COLL_TOKEN_DECIMALS;

    uint256 constant BASE = 10**18;
    uint256 constant MIN_LIQUIDITY = 100 * 10**6;
    uint256 public immutable maxLoanPerColl;
    address public immutable collCcyToken;
    address public immutable loanCcyToken;
    uint128 constant MAX_PROTOCOL_FEE = 5 * 10**15;

    uint128 public protocolFee;
    uint128 public totalLpShares;
    uint256 totalLiquidity;
    uint256 public loanIdx;
    uint256 public r1;
    uint256 public r2;
    uint256 public tvl1;
    uint256 public tvl2;
    uint256 public minLoan;
    uint256 public totalFees;

    //must be a multiple of 100
    uint256 firstLengthPerClaimInterval;

    mapping(address => LpInfo) public addrToLpInfo;
    mapping(uint256 => LoanInfo) public loanIdxToLoanInfo;
    mapping(uint256 => address) public loanIdxToBorrower;

    mapping(uint256 => AggClaimsInfo) collAndRepayTotalBaseAgg1;
    mapping(uint256 => AggClaimsInfo) collAndRepayTotalBaseAgg2;
    mapping(uint256 => AggClaimsInfo) collAndRepayTotalBaseAgg3;

    mapping(uint256 => mapping(uint256 => AggClaimsInfo)) loanIdxRangeToAggClaimsInfo;

    struct LpInfo {
        uint32 fromLoanIdx;
        uint32 toLoanIdx;
        uint32 earliestRemove;
        uint128 shares;
        bool activeLp;
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
        uint256 _firstLengthPerClaimInterval
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
        COLL_TOKEN_DECIMALS = _collCcyToken == WETH
            ? 18
            : IERC20Metadata(_collCcyToken).decimals();
        firstLengthPerClaimInterval = _firstLengthPerClaimInterval;
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

    function isEthPool() internal view returns (bool) {
        return collCcyToken == WETH;
    }

    function isEthLoan() internal view returns (bool) {
        return loanCcyToken == WETH;
    }

    function getTotalLiquidity() public view virtual returns (uint256);

    function getTransferFee(uint128 pledgeAmount)
        internal
        view
        virtual
        returns (uint128);

    function addLiquidity(
        uint128 _inAmount,
        uint256 _deadline,
        uint16 _referralCode
    ) external payable override {
        // verify lp info and eligibility
        uint256 timestamp = block.timestamp;
        if (timestamp > _deadline) revert PastDeadline();
        // verify eligibility of loan
        bool wrapToWeth = isEthLoan() && _inAmount == 0 && msg.value > 0;
        {
            bool isWeth = isEthLoan() && _inAmount > 0 && msg.value == 0;
            bool isErc20 = !isEthLoan() && _inAmount > 0 && msg.value == 0;
            if (!wrapToWeth && !isWeth && !isErc20)
                revert InconsistentMsgValue();
        }
        // get loanAmount
        uint128 _amount = wrapToWeth ? uint128(msg.value) : _inAmount;
        uint256 _totalLiquidity = getTotalLiquidity();
        if (_amount < MIN_LIQUIDITY || _amount + _totalLiquidity < minLoan)
            revert InvalidAddAmount();
        // retrieve lpInfo of sender
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.activeLp || (lpInfo.toLoanIdx != lpInfo.fromLoanIdx))
            revert CannotAddWhileActiveOrWithOpenClaims();
        // update state of pool
        uint128 newLpShares;
        uint256 dust;
        if (_totalLiquidity == 0 && totalLpShares == 0) {
            newLpShares = _amount;
        } else if (_totalLiquidity > 0 && totalLpShares == 0) {
            dust = _totalLiquidity;
            _totalLiquidity = 0;
            newLpShares = _amount;
        } else {
            assert(_totalLiquidity > 0 && totalLpShares > 0);
            newLpShares = uint128(
                (uint256(_amount) * uint256(totalLpShares)) / _totalLiquidity
            );
        }
        totalLpShares += newLpShares;
        if (((minLoan * BASE) / totalLpShares) * newLpShares == 0)
            revert TooBigAddToLaterClaimOnRepay();
        if (
            ((((10**COLL_TOKEN_DECIMALS * minLoan) / maxLoanPerColl) * BASE) /
                totalLpShares) *
                newLpShares ==
            0
        ) revert TooBigAddToLaterClaimColl();
        totalLiquidity = _totalLiquidity + _amount;
        // update lp info
        lpInfo.fromLoanIdx = uint32(loanIdx);
        if (lpInfo.toLoanIdx != 0) {
            lpInfo.toLoanIdx = 0;
        }
        lpInfo.earliestRemove = uint32(timestamp) + MIN_LPING_PERIOD;
        lpInfo.shares = newLpShares;
        lpInfo.activeLp = true;

        if (wrapToWeth) {
            // wrap to Weth
            IWETH(loanCcyToken).deposit{value: _amount}();
        } else {
            // transfer liquidity
            IERC20Metadata(loanCcyToken).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
        }
        // transfer dust to treasury if any
        if (dust > 0) {
            IERC20Metadata(loanCcyToken).safeTransfer(TREASURY, dust);
        }
        // spawn event
        emit AddLiquidity(
            _amount,
            newLpShares,
            totalLiquidity,
            totalLpShares,
            lpInfo.earliestRemove,
            _referralCode
        );
    }

    function removeLiquidity() external override {
        // verify lp info and eligibility
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.shares == 0) revert NothingToRemove();
        if (block.timestamp < lpInfo.earliestRemove)
            revert BeforeEarliestRemove();
        if (!lpInfo.activeLp) revert MustBeActiveLp();
        uint256 _totalLiquidity = getTotalLiquidity();
        // update state of pool
        uint256 liquidityRemoved = (lpInfo.shares *
            (_totalLiquidity - MIN_LIQUIDITY)) / totalLpShares;
        totalLpShares -= lpInfo.shares;
        totalLiquidity = _totalLiquidity - liquidityRemoved;
        lpInfo.toLoanIdx = uint32(loanIdx);
        lpInfo.activeLp = false;
        // transfer liquidity
        IERC20Metadata(loanCcyToken).safeTransfer(msg.sender, liquidityRemoved);
        // spawn event
        emit RemoveLiquidity(
            liquidityRemoved,
            lpInfo.shares,
            totalLiquidity,
            totalLpShares
        );
    }

    function loanTerms(uint128 _inAmount)
        public
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint256 _totalLiquidity
        )
    {
        // compute terms (as uint256)
        uint256 pledge = _inAmount - (_inAmount * protocolFee) / BASE;
        _totalLiquidity = getTotalLiquidity();
        uint256 loan = (pledge *
            maxLoanPerColl *
            (_totalLiquidity - MIN_LIQUIDITY)) /
            (pledge *
                maxLoanPerColl +
                (_totalLiquidity - MIN_LIQUIDITY) *
                10**COLL_TOKEN_DECIMALS);
        uint256 rate;
        uint256 x = _totalLiquidity - loan;
        if (x < tvl1) {
            rate = (r1 * tvl1) / x;
        } else if (x < tvl2) {
            rate = ((r1 - r2) * (tvl2 - x)) / (tvl2 - tvl1) + r2;
        } else {
            rate = r2;
        }
        uint256 repayment = (loan * (BASE + rate)) / BASE;
        // return terms (as uint128)
        loanAmount = uint128(loan);
        repaymentAmount = uint128(repayment);
        pledgeAmount = uint128(pledge);
    }

    function borrow(
        uint128 _inAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint16 _referralCode
    ) external payable override {
        // get borrow terms
        (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint32 expiry,
            uint128 fee,
            uint256 _totalLiquidity
        ) = _borrow(_inAmount, _minLoanLimit, _maxRepayLimit, _deadline);
        // update state
        totalLiquidity = _totalLiquidity - loanAmount;
        totalFees += fee;
        // set borrower address
        loanIdxToBorrower[loanIdx] = msg.sender;
        // set loan info and transfer collateral
        LoanInfo memory loanInfo;
        loanInfo.repayment = repaymentAmount;
        loanInfo.totalLpShares = totalLpShares;
        loanInfo.expiry = expiry;
        {
            uint128 transferFee = getTransferFee(pledgeAmount);
            if (pledgeAmount - transferFee == 0)
                revert InvalidPledgeAfterTransferFee();
            IERC20Metadata(collCcyToken).safeTransferFrom(
                msg.sender,
                address(this),
                pledgeAmount
            );
            loanInfo.collateral = pledgeAmount - transferFee;
            loanIdxToLoanInfo[loanIdx] = loanInfo;
            uint128 collateral = uint128(
                ((pledgeAmount - transferFee) * BASE) / totalLpShares
            );
            collAndRepayTotalBaseAgg1[loanIdx / firstLengthPerClaimInterval + 1]
                .collateral += collateral;
            collAndRepayTotalBaseAgg2[
                (loanIdx / firstLengthPerClaimInterval) * 10 + 1
            ].collateral += collateral;
            collAndRepayTotalBaseAgg3[
                (loanIdx / firstLengthPerClaimInterval) * 100 + 1
            ].collateral += collateral;

            loanIdx += 1;
            if (fee > 0) {
                IERC20Metadata(collCcyToken).safeTransferFrom(
                    msg.sender,
                    TREASURY,
                    fee
                );
            }
        }
        // transfer liquidity
        IERC20Metadata(loanCcyToken).safeTransfer(msg.sender, loanAmount);
        // spawn event
        emit Borrow(
            loanIdx - 1,
            pledgeAmount,
            loanAmount,
            repaymentAmount,
            expiry,
            fee,
            _referralCode
        );
    }

    function _borrow(
        uint128 _inAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline
    )
        internal
        view
        returns (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint32 expiry,
            uint128 fee,
            uint256 _totalLiquidity
        )
    {
        // get and verify loan terms
        uint256 timestamp = block.timestamp;
        if (timestamp > _deadline) revert PastDeadline();
        (
            loanAmount,
            repaymentAmount,
            pledgeAmount,
            _totalLiquidity
        ) = loanTerms(_inAmount);
        assert(_totalLiquidity - loanAmount >= MIN_LIQUIDITY);
        if (pledgeAmount == 0) revert InvalidPledgeAmount();
        if (loanAmount < minLoan) revert TooSmallLoan();
        if (loanAmount < _minLoanLimit) revert LoanBelowLimit();
        if (repaymentAmount <= loanAmount) revert ErroneousLoanTerms();
        if (repaymentAmount > _maxRepayLimit) revert RepaymentAboveLimit();
        expiry = uint32(timestamp) + LOAN_TENOR;
        fee = _inAmount - pledgeAmount;
    }

    function repay(uint256 _loanIdx) external override {
        // verify loan info and eligibility
        if (_loanIdx == 0 || _loanIdx >= loanIdx) revert InvalidLoanIdx();
        if (loanIdxToBorrower[_loanIdx] != msg.sender)
            revert UnauthorizedRepay();
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        if (block.timestamp > loanInfo.expiry) revert CannotRepayAfterExpiry();
        if (loanInfo.repaid) revert AlreadyRepaid();
        if (block.timestamp == loanInfo.expiry - LOAN_TENOR)
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

        // transfer collateral
        IERC20Metadata(loanCcyToken).safeTransferFrom(
            msg.sender,
            address(this),
            loanInfo.repayment
        );
        // transfer liquidity
        IERC20Metadata(collCcyToken).safeTransfer(
            msg.sender,
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
        // verify loan info and eligibility
        if (_loanIdx == 0 || _loanIdx >= loanIdx) revert InvalidLoanIdx();
        if (loanIdxToBorrower[_loanIdx] != msg.sender)
            revert UnauthorizedRepay();
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        {
            uint256 timestamp = block.timestamp;
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
            uint128 fee,
            uint256 _totalLiquidity
        ) = _borrow(
                loanInfo.collateral,
                _minLoanLimit,
                _maxRepayLimit,
                _deadline
            );

        //update the aggregation mappings
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
            totalFees += fee;
            // transfer liquidity
            IERC20Metadata(loanCcyToken).safeTransferFrom(
                msg.sender,
                address(this),
                loanInfo.repayment - loanAmount
            );
            // transfer collateral
            if (fee > 0) {
                IERC20Metadata(collCcyToken).safeTransferFrom(
                    msg.sender,
                    TREASURY,
                    fee
                );
            }
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

    function claim(uint256[] calldata _loanIdxs) external override {
        // verify lp info and eligibility
        uint256 arrayLen = _loanIdxs.length;
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (arrayLen == 0 || lpInfo.shares == 0) revert NothingToClaim();
        if (_loanIdxs[0] == 0 || _loanIdxs[arrayLen - 1] >= loanIdx)
            revert InvalidLoanIdx();
        if (_loanIdxs[0] < lpInfo.fromLoanIdx) revert UnentitledFromLoanIdx();
        if (
            lpInfo.toLoanIdx != 0 && _loanIdxs[arrayLen - 1] >= lpInfo.toLoanIdx
        ) revert UnentitledToLoanIdx();
        // get claims
        (uint256 repayments, uint256 collateral) = getClaimsFromList(
            _loanIdxs,
            arrayLen,
            lpInfo.shares
        );
        lpInfo.fromLoanIdx = uint32(_loanIdxs[arrayLen - 1]) + 1;
        // transfer liquidity
        if (repayments > 0) {
            IERC20Metadata(loanCcyToken).safeTransfer(msg.sender, repayments);
        }
        // transfer collateral
        if (collateral > 0) {
            IERC20Metadata(collCcyToken).safeTransfer(msg.sender, collateral);
        }
        // spawn event
        emit Claim(_loanIdxs, repayments, collateral);
    }

    function claimFromAggregated(
        uint256 _fromLoanIdx,
        uint256[] calldata _endAggIdxs
    ) external override {
        uint256 lengthArr = _endAggIdxs.length;
        if (lengthArr == 0) revert EmptyAggregationArray();
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.shares == 0) revert NothingToClaim();
        if (
            _fromLoanIdx < lpInfo.fromLoanIdx &&
            !(_fromLoanIdx == 0 && lpInfo.fromLoanIdx == 1)
        ) revert UnentitledFromLoanIdx();
        if (
            lpInfo.toLoanIdx != 0 &&
            _endAggIdxs[lengthArr - 1] >= lpInfo.toLoanIdx
        ) revert UnentitledToLoanIdx();
        uint256 totalRepayments;
        uint256 totalCollateral;
        uint256 startIndex = _fromLoanIdx;
        uint256 endIndex = _endAggIdxs[0];
        uint256 repayments;
        uint256 collateral;

        for (uint256 index = 0; index < lengthArr; ) {
            if (startIndex % 100 != 0 || endIndex % 100 != 99) {
                revert InvalidFromToAggregation();
            }
            if (index != lengthArr - 1) {
                if (_endAggIdxs[index] >= _endAggIdxs[index + 1])
                    revert NonAscendingLoanIdxs();
            }
            (repayments, collateral) = getClaimsFromAggregated(
                startIndex,
                endIndex,
                lpInfo.shares
            );
            totalRepayments += repayments;
            totalCollateral += collateral;
            unchecked {
                startIndex = endIndex + 1;
                index++;
                if (index < lengthArr) {
                    endIndex = _endAggIdxs[index];
                }
            }
        }
        lpInfo.fromLoanIdx = uint32(_endAggIdxs[lengthArr - 1]) + 1;

        if (totalRepayments > 0) {
            IERC20Metadata(loanCcyToken).safeTransfer(
                msg.sender,
                totalRepayments
            );
        }
        if (totalCollateral > 0) {
            IERC20Metadata(collCcyToken).safeTransfer(
                msg.sender,
                totalCollateral
            );
        }
        //spawn event
        emit ClaimFromAggregated(
            _fromLoanIdx,
            _endAggIdxs[lengthArr - 1],
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

    function setProtocolFee(uint128 _newFee) external {
        // verify new fee
        if (msg.sender != TREASURY) revert UnauthorizedFeeUpdate();
        if (_newFee == protocolFee) revert NewFeeMustBeDifferent();
        if (_newFee > MAX_PROTOCOL_FEE) revert NewFeeTooHigh();
        // spawn event
        emit FeeUpdate(protocolFee, _newFee);
        // set new fee
        protocolFee = _newFee;
    }

    function getClaimsFromAggregated(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256 _shares
    ) public view returns (uint256 repayments, uint256 collateral) {
        if (
            !(_toLoanIdx - _fromLoanIdx == firstLengthPerClaimInterval - 1 ||
                _toLoanIdx - _fromLoanIdx ==
                firstLengthPerClaimInterval * 10 - 1 ||
                _toLoanIdx - _fromLoanIdx ==
                firstLengthPerClaimInterval * 100 - 1)
        ) revert InvalidSubAggregation();
        uint32 expiryCheck = loanIdxToLoanInfo[_toLoanIdx].expiry;
        if (expiryCheck == 0 || expiryCheck > block.timestamp + 1) {
            revert InvalidSubAggregation();
        }
        AggClaimsInfo memory aggClaimsInfo;
        if (_toLoanIdx - _fromLoanIdx == firstLengthPerClaimInterval - 1) {
            aggClaimsInfo = collAndRepayTotalBaseAgg1[
                _fromLoanIdx / firstLengthPerClaimInterval + 1
            ];
        } else if (
            _toLoanIdx - _fromLoanIdx == firstLengthPerClaimInterval * 10 - 1
        ) {
            aggClaimsInfo = collAndRepayTotalBaseAgg2[
                (_fromLoanIdx / firstLengthPerClaimInterval) * 10 + 1
            ];
        } else {
            aggClaimsInfo = collAndRepayTotalBaseAgg3[
                (_fromLoanIdx / firstLengthPerClaimInterval) * 100 + 1
            ];
        }

        if (aggClaimsInfo.repayments == 0 && aggClaimsInfo.collateral == 0)
            revert NothingAggregatedToClaim();

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

        collAndRepayTotalBaseAgg1[_loanIdx / firstLengthPerClaimInterval + 1]
            .collateral -= collateralUpdate;
        collAndRepayTotalBaseAgg1[_loanIdx / firstLengthPerClaimInterval + 1]
            .repayments += repaymentUpdate;
        collAndRepayTotalBaseAgg2[
            (_loanIdx / firstLengthPerClaimInterval) * 10 + 1
        ].collateral -= collateralUpdate;
        collAndRepayTotalBaseAgg2[
            (_loanIdx / firstLengthPerClaimInterval) * 10 + 1
        ].repayments += repaymentUpdate;
        collAndRepayTotalBaseAgg3[
            (_loanIdx / firstLengthPerClaimInterval) * 100 + 1
        ].collateral -= collateralUpdate;
        collAndRepayTotalBaseAgg3[
            (_loanIdx / firstLengthPerClaimInterval) * 100 + 1
        ].repayments += repaymentUpdate;
    }
}
