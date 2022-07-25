// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISubPoolV1} from "./interfaces/ISubPoolV1.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IPAXG} from "./interfaces/IPAXG.sol";

contract SubPoolV1 is ISubPoolV1 {
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
    error CannotAddWithZeroLiquidityAndOtherLps();
    error TooBigAddToLaterClaimOnRepay();
    error TooBigAddToLaterClaimColl();
    error NothingToRemove();
    error BeforeEarliestRemove();
    error MustBeActiveLp();
    error InconsistentMsgValue();
    error InsufficientLiquidity();
    error InvalidPledgeAmount();
    error InvalidPledgeAfterTransferFee();
    error TooSmallLoan();
    error LoanBelowLimit();
    error ErroneousLoanTerms();
    error RepaymentAboveLimit();
    error InvalidLoanIdx();
    error UnauthorizedRepay();
    error CannotRepayAfterExpiry();
    error AlreadyRepaid();
    error CannotRepayInSameBlock();
    error NothingToClaim();
    error UnentitledFromLoanIdx();
    error UnentitledToLoanIdx();
    error InvalidFromToAggregation();
    error CannotAggregateWithUnsettledLoan();
    error AggregatedAlready();
    error NothingAggregatedToClaim();
    error NonAscendingLoanIdxs();
    error CannotClaimWithUnsettledLoan();
    error UnauthorizedFeeUpdate();
    error NewFeeMustBeDifferent();
    error NewFeeToHigh();
    error CannotUndustWithActiveLps();

    address public constant TREASURY =
        0x0000000000000000000000000000000000000001;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant PAXG = 0x45804880De22913dAFE09f4980848ECE6EcbAf78;
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
    uint256 public totalLiquidity;
    uint256 public loanIdx;
    uint256 public r1;
    uint256 public r2;
    uint256 public tvl1;
    uint256 public tvl2;
    uint256 public minLoan;
    uint256 public totalFees;

    mapping(address => LpInfo) public addrToLpInfo;
    mapping(uint256 => LoanInfo) public loanIdxToLoanInfo;
    mapping(uint256 => address) public loanIdxToBorrower;
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
        uint256 _minLoan
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

    function addLiquidity(
        uint128 _amount,
        uint256 _deadline,
        uint16 _referralCode
    ) external override {
        // verify lp info and eligibility
        uint256 timestamp = block.timestamp;
        if (timestamp > _deadline) revert PastDeadline();
        if (_amount < MIN_LIQUIDITY || _amount + totalLiquidity < minLoan)
            revert InvalidAddAmount();
        // retrieve lpInfo of sender
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.activeLp || (lpInfo.toLoanIdx != lpInfo.fromLoanIdx))
            revert CannotAddWhileActiveOrWithOpenClaims();
        // update state of pool
        uint128 newLpShares;
        uint256 dust;
        if (totalLiquidity == 0 && totalLpShares == 0) {
            newLpShares = _amount;
        } else if (totalLiquidity > 0 && totalLpShares == 0) {
            dust = totalLiquidity;
            totalLiquidity = 0;
            newLpShares = _amount;
        } else {
            assert(totalLiquidity > 0 && totalLpShares > 0);
            newLpShares = uint128(
                (uint256(_amount) * uint256(totalLpShares)) / totalLiquidity
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
        totalLiquidity += _amount;
        // update lp info
        lpInfo.fromLoanIdx = uint32(loanIdx);
        if (lpInfo.toLoanIdx != 0) {
            lpInfo.toLoanIdx = 0;
        }
        lpInfo.earliestRemove = uint32(timestamp) + MIN_LPING_PERIOD;
        lpInfo.shares = newLpShares;
        lpInfo.activeLp = true;
        // transfer liquidity
        IERC20Metadata(loanCcyToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        // transfer dust to treasury iff any
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
        // verify sender eligability
        if (lpInfo.shares == 0) revert NothingToRemove();
        if (block.timestamp < lpInfo.earliestRemove)
            revert BeforeEarliestRemove();
        if (!lpInfo.activeLp) revert MustBeActiveLp();
        // update state of pool
        uint256 liquidityRemoved = (lpInfo.shares *
            (totalLiquidity - MIN_LIQUIDITY)) / totalLpShares;
        totalLpShares -= lpInfo.shares;
        totalLiquidity -= liquidityRemoved;
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
            uint128 pledgeAmount
        )
    {
        // compute terms (as uint256)
        uint256 pledge = _inAmount - (_inAmount * protocolFee) / BASE;
        uint256 loan = (pledge *
            maxLoanPerColl *
            (totalLiquidity - MIN_LIQUIDITY)) /
            (pledge *
                maxLoanPerColl +
                (totalLiquidity - MIN_LIQUIDITY) *
                10**COLL_TOKEN_DECIMALS);
        uint256 rate;
        uint256 x = totalLiquidity - loan;
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
        // verify eligibility of collateral
        bool wrapToWeth = isEthPool() && _inAmount == 0 && msg.value > 0;
        {
            bool isWeth = isEthPool() && _inAmount > 0 && msg.value == 0;
            bool isErc20 = !isEthPool() && _inAmount > 0 && msg.value == 0;
            if (!wrapToWeth && !isWeth && !isErc20)
                revert InconsistentMsgValue();
        }
        // get borrow terms
        uint128 inAmount = wrapToWeth ? uint128(msg.value) : _inAmount;
        (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount,
            uint32 expiry,
            uint128 fee
        ) = _borrow(inAmount, _minLoanLimit, _maxRepayLimit, _deadline);
        // update state
        totalLiquidity -= loanAmount;
        totalFees += fee;
        // set loan info and transfer collateral
        LoanInfo memory loanInfo;
        loanInfo.repayment = repaymentAmount;
        loanInfo.totalLpShares = totalLpShares;
        loanInfo.expiry = expiry;
        // set borrower
        loanIdxToBorrower[loanIdx] = msg.sender;
        {
            uint256 transferFee;
            if (wrapToWeth) {
                // wrap to Weth
                IWETH(collCcyToken).deposit{value: inAmount}();
            } else {
                if (collCcyToken == PAXG) {
                    transferFee = IPAXG(collCcyToken).getFeeFor(pledgeAmount);
                }
                if (pledgeAmount - uint128(transferFee) == 0)
                    revert InvalidPledgeAfterTransferFee();
                IERC20Metadata(collCcyToken).safeTransferFrom(
                    msg.sender,
                    address(this),
                    pledgeAmount
                );
            }
            loanInfo.collateral = pledgeAmount - uint128(transferFee);
            loanIdxToLoanInfo[loanIdx] = loanInfo;
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
            uint128 fee
        )
    {
        // get and verify loan terms
        uint256 timestamp = block.timestamp;
        if (timestamp > _deadline) revert PastDeadline();
        (loanAmount, repaymentAmount, pledgeAmount) = loanTerms(_inAmount);
        assert(totalLiquidity - loanAmount >= MIN_LIQUIDITY);
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
        // retrieve loan info and check eligability to repay
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        if (block.timestamp > loanInfo.expiry) revert CannotRepayAfterExpiry();
        if (loanInfo.repaid) revert AlreadyRepaid();
        if (block.timestamp == loanInfo.expiry - LOAN_TENOR)
            revert CannotRepayInSameBlock();
        // update loan info
        loanInfo.repaid = true;
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
        emit Repay(_loanIdx, loanInfo.repayment, loanInfo.collateral);
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
            uint128 fee
        ) = _borrow(
                loanInfo.collateral,
                _minLoanLimit,
                _maxRepayLimit,
                _deadline
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
            totalLiquidity -= loanAmount;
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
            loanInfo.repayment,
            repaymentAmount,
            loanInfo.expiry,
            expiry,
            _referralCode
        );
    }

    function claim(uint256[] calldata _loanIdxs) external override {
        // verify lp info and eligibility
        uint256 arrayLen = _loanIdxs.length;
        // retrieve and verify lp info
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (arrayLen == 0 || lpInfo.shares == 0) revert NothingToClaim();
        if (_loanIdxs[0] == 0 || _loanIdxs[arrayLen - 1] >= loanIdx)
            revert InvalidLoanIdx();
        if (_loanIdxs[0] < lpInfo.fromLoanIdx) revert UnentitledFromLoanIdx();
        if (
            lpInfo.toLoanIdx != 0 && _loanIdxs[arrayLen - 1] >= lpInfo.toLoanIdx
        ) revert UnentitledToLoanIdx();
        // get claims
        (
            uint256 repayments,
            uint256 collateral,
            uint256 numDefaults
        ) = getClaimsFromList(_loanIdxs, arrayLen, lpInfo.shares);
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
        emit Claim(_loanIdxs, repayments, collateral, numDefaults);
    }

    //including _fromLoanIdx and _toLoanIdx
    function aggregateClaims(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256[] calldata _prevAggIdxs
    ) public {
        // verify aggregated claims info and eligibility
        if (_fromLoanIdx == 0 || _toLoanIdx >= loanIdx) revert InvalidLoanIdx();
        if (_fromLoanIdx >= _toLoanIdx) revert InvalidFromToAggregation();
        // retrieve aggregated claims info
        AggClaimsInfo memory aggClaimsInfo;
        aggClaimsInfo = loanIdxRangeToAggClaimsInfo[_fromLoanIdx][_toLoanIdx];
        if (aggClaimsInfo.repayments == 0 && aggClaimsInfo.collateral == 0) {
            // aggregate claims (as uint256)
            uint256 repayments;
            uint256 collateral;
            uint256 numDefaults;
            LoanInfo memory loanInfo;
            for (uint256 i = _fromLoanIdx; i <= _toLoanIdx; ) {
                loanInfo = loanIdxToLoanInfo[i];
                if (loanInfo.repaid) {
                    repayments +=
                        (loanInfo.repayment * BASE) /
                        loanInfo.totalLpShares;
                } else if (loanInfo.expiry < block.timestamp) {
                    collateral +=
                        (loanInfo.collateral * BASE) /
                        loanInfo.totalLpShares;
                    numDefaults += 1;
                } else {
                    revert CannotAggregateWithUnsettledLoan();
                }
                unchecked {
                    i++;
                }
            }
            // set claims (as uint128)
            aggClaimsInfo.repayments = uint128(repayments);
            aggClaimsInfo.collateral = uint128(collateral);
            loanIdxRangeToAggClaimsInfo[_fromLoanIdx][
                _toLoanIdx
            ] = aggClaimsInfo;
            // spawn event
            emit AggregateClaims(
                _fromLoanIdx,
                _toLoanIdx,
                repayments,
                collateral,
                numDefaults
            );
        }
    }

    //including _fromLoanIdx and _toLoanIdx
    function claimFromAggregated(uint256 _fromLoanIdx, uint256 _toLoanIdx)
        external
        override
    {
        // verify lp info and eligibility
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.shares == 0) revert NothingToClaim();
        if (_fromLoanIdx < lpInfo.fromLoanIdx) revert UnentitledFromLoanIdx();
        if (lpInfo.toLoanIdx != 0 && _toLoanIdx >= lpInfo.toLoanIdx)
            revert UnentitledToLoanIdx();
        // get aggregated claims
        (uint256 repayments, uint256 collateral) = getClaimsFromAggregated(
            _fromLoanIdx,
            _toLoanIdx,
            lpInfo.shares
        );
        lpInfo.fromLoanIdx = uint32(_toLoanIdx) + 1;
        // transfer liquidity
        if (repayments > 0) {
            IERC20Metadata(loanCcyToken).safeTransfer(msg.sender, repayments);
        }
        // transfer collateral
        if (collateral > 0) {
            IERC20Metadata(collCcyToken).safeTransfer(msg.sender, collateral);
        }
        // spawn event
        emit ClaimFromAggregated(
            _fromLoanIdx,
            _toLoanIdx,
            repayments,
            collateral
        );
    }

    function getClaimsFromAggregated(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256 _shares
    ) public view returns (uint256 repayments, uint256 collateral) {
        // retrieve aggregated claims info iff any
        AggClaimsInfo memory aggClaimsInfo;
        aggClaimsInfo = loanIdxRangeToAggClaimsInfo[_fromLoanIdx][_toLoanIdx];
        if (aggClaimsInfo.repayments == 0 && aggClaimsInfo.collateral == 0)
            revert NothingAggregatedToClaim();
        // return claims
        repayments = (aggClaimsInfo.repayments * _shares) / BASE;
        collateral = (aggClaimsInfo.collateral * _shares) / BASE;
    }

    function getClaimsFromList(
        uint256[] calldata _loanIdxs,
        uint256 arrayLen,
        uint256 _shares
    )
        internal
        view
        returns (
            uint256 repayments,
            uint256 collateral,
            uint256 numDefaults
        )
    {
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
                numDefaults += 1;
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
        if (_newFee > MAX_PROTOCOL_FEE) revert NewFeeToHigh();
        // spawn event
        emit FeeUpdate(protocolFee, _newFee);
        // set new fee
        protocolFee = _newFee;
    }
}
