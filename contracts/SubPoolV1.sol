// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ISubPoolV1} from "./interfaces/ISubPoolV1.sol";

contract SubPoolV1 is ISubPoolV1 {
    error LoanCcyCannotBeZeroAddress();
    error CollAndLoanCcyCannoteBeEqual();
    error InvalidLoanTenor();
    error InvalidMaxLoanPerColl();
    error InvalidRateParams();
    error InvalidTvlParams();
    error InvalidMinLoan();
    error PastDeadline();
    error InvalidAddAmount();
    error TooSmallAddForRepayClaim();
    error TooSmallAddForCollClaim();
    error NothingToRemove();
    error BeforeEarliestRemove();
    error InconsistentMsgValue();
    error InvalidPledgeAmount();
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

    address public constant TREASURY =
        0x0000000000000000000000000000000000000001;
    uint256 constant BASE = 10**18;
    uint128 constant MAX_PROTOCOL_FEE = 50 * 10**15;
    uint32 constant MIN_LPING_PERIOD = 30;
    uint24 immutable LOAN_TENOR;
    uint8 immutable COLL_TOKEN_DECIMALS;
    uint256 public immutable maxLoanPerColl;
    address public immutable collCcyToken;
    address public immutable loanCcyToken;

    uint128 public totalLpShares;
    uint256 public totalLiquidity;
    uint256 public loanIdx;
    uint256 public r1;
    uint256 public r2;
    uint256 public tvl1;
    uint256 public tvl2;
    uint256 public minLoan;
    uint256 public totalFees;
    uint128 public protocolFee;

    mapping(address => LpInfo) public addrToLpInfo;
    mapping(uint256 => LoanInfo) public loanIdxToLoanInfo;
    mapping(uint256 => address) public loanIdxToBorrower;
    mapping(bytes32 => AggClaimsInfo) loanIdxRangeToAggClaimsInfo;

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
        if (_collCcyToken == _loanCcyToken)
            revert CollAndLoanCcyCannoteBeEqual();
        if (_loanTenor < 86400) revert InvalidLoanTenor();
        if (_maxLoanPerColl == 0) revert InvalidMaxLoanPerColl();
        if (_r1 <= _r2 || _r2 == 0) revert InvalidRateParams();
        if (_tvl2 <= _tvl1 || _tvl1 == 0) revert InvalidTvlParams();
        if (_minLoan == 0) revert InvalidMinLoan();

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
        COLL_TOKEN_DECIMALS = _collCcyToken == address(0)
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

    function isEthColl() internal view returns (bool) {
        return collCcyToken == address(0);
    }

    function addLiquidity(uint128 _amount, uint256 _deadline)
        external
        override
    {
        uint256 timeStamp = block.timestamp;
        if (timeStamp > _deadline) revert PastDeadline();
        if (_amount == 0) revert InvalidAddAmount();
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        bool canAdd = lpInfo.activeLp
            ? false
            : lpInfo.toLoanIdx - lpInfo.fromLoanIdx == 0;
        require(canAdd, "must be inactive without open claims");
        uint128 newLpShares;
        if (totalLiquidity == 0 && totalLpShares == 0) {
            newLpShares = _amount;
        } else {
            newLpShares = uint128(
                (uint256(_amount) * uint256(totalLpShares)) / totalLiquidity
            );
        }
        totalLpShares += newLpShares;
        if (((minLoan * BASE) / totalLpShares) * newLpShares == 0)
            revert TooSmallAddForRepayClaim();
        if (
            ((((10**COLL_TOKEN_DECIMALS * minLoan) / maxLoanPerColl) * BASE) /
                totalLpShares) *
                newLpShares ==
            0
        ) revert TooSmallAddForCollClaim();
        totalLiquidity += _amount;
        lpInfo.shares = newLpShares;
        lpInfo.fromLoanIdx = uint32(loanIdx);
        if (lpInfo.toLoanIdx != 0) {
            lpInfo.toLoanIdx = 0;
        }
        lpInfo.earliestRemove = uint32(timeStamp) + MIN_LPING_PERIOD;
        lpInfo.activeLp = true;

        IERC20Metadata(loanCcyToken).transferFrom(
            msg.sender,
            address(this),
            _amount
        );
        emit AddLiquidity(
            _amount,
            newLpShares,
            totalLiquidity,
            totalLpShares,
            lpInfo.earliestRemove
        );
    }

    function removeLiquidity() external override {
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.shares == 0) revert NothingToRemove();
        if (block.timestamp < lpInfo.earliestRemove)
            revert BeforeEarliestRemove();
        require(lpInfo.activeLp, "must be active lp");
        uint256 liquidityRemoved = (lpInfo.shares * totalLiquidity) /
            totalLpShares;
        totalLpShares -= lpInfo.shares;
        totalLiquidity -= liquidityRemoved;
        lpInfo.toLoanIdx = uint32(loanIdx);
        lpInfo.activeLp = false;

        IERC20Metadata(loanCcyToken).transfer(msg.sender, liquidityRemoved);
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
            uint128,
            uint128,
            uint128
        )
    {
        uint256 fee = (_inAmount * protocolFee) / BASE;
        uint256 pledgeAmount = _inAmount - fee;
        uint256 loanAmount = (pledgeAmount * maxLoanPerColl * totalLiquidity) /
            (pledgeAmount *
                maxLoanPerColl +
                totalLiquidity *
                10**COLL_TOKEN_DECIMALS);

        uint256 rate;
        uint256 x = totalLiquidity - loanAmount;
        if (x < tvl1) {
            rate = (r1 * tvl1) / (x);
        } else if (x < tvl2) {
            rate = ((r1 - r2) * (tvl2 - x)) / (tvl2 - tvl1) + r2;
        } else {
            rate = r2;
        }
        uint256 repaymentAmount = (loanAmount * (BASE + rate)) / BASE;
        return (
            uint128(loanAmount),
            uint128(repaymentAmount),
            uint128(pledgeAmount)
        );
    }

    function borrow(
        uint128 _inAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline
    ) external payable override {
        uint256 timeStamp = block.timestamp;
        if (timeStamp > _deadline) revert PastDeadline();
        if (
            (isEthColl() && _inAmount != msg.value) ||
            (!isEthColl() && msg.value != 0)
        ) revert InconsistentMsgValue();
        (
            uint128 loanAmount,
            uint128 repaymentAmount,
            uint128 pledgeAmount
        ) = loanTerms(_inAmount);
        if (pledgeAmount == 0) revert InvalidPledgeAmount();
        if (loanAmount < minLoan) revert TooSmallLoan();
        if (loanAmount < _minLoanLimit) revert LoanBelowLimit();
        if (repaymentAmount <= loanAmount) revert ErroneousLoanTerms();
        if (repaymentAmount > _maxRepayLimit) revert RepaymentAboveLimit();
        LoanInfo memory loanInfo;
        loanInfo.expiry = uint32(timeStamp) + LOAN_TENOR;
        loanInfo.totalLpShares = totalLpShares;
        loanInfo.repayment = repaymentAmount;
        loanInfo.collateral = pledgeAmount;
        loanIdxToLoanInfo[loanIdx] = loanInfo;
        loanIdxToBorrower[loanIdx] = msg.sender;
        loanIdx += 1;
        totalLiquidity -= loanAmount;

        uint128 fee = _inAmount - pledgeAmount;
        totalFees += fee;
        if (!isEthColl()) {
            IERC20Metadata(collCcyToken).transferFrom(
                msg.sender,
                address(this),
                pledgeAmount - fee
            );
            if (fee > 0) {
                IERC20Metadata(collCcyToken).transferFrom(
                    msg.sender,
                    TREASURY,
                    fee
                );
            }
        } else if (fee > 0) {
            payable(TREASURY).transfer(fee);
        }
        IERC20Metadata(loanCcyToken).transfer(msg.sender, loanAmount);

        emit Borrow(
            loanIdx - 1,
            pledgeAmount,
            loanAmount,
            repaymentAmount,
            loanInfo.expiry,
            fee
        );
    }

    function repay(uint256 _loanIdx) external override {
        if (_loanIdx == 0 || _loanIdx >= loanIdx) revert InvalidLoanIdx();
        if (loanIdxToBorrower[_loanIdx] != msg.sender)
            revert UnauthorizedRepay();
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        if (block.timestamp > loanInfo.expiry) revert CannotRepayAfterExpiry();
        if (loanInfo.repaid) revert AlreadyRepaid();
        if (block.timestamp == loanInfo.expiry - LOAN_TENOR)
            revert CannotRepayInSameBlock();
        loanInfo.repaid = true;
        IERC20Metadata(loanCcyToken).transferFrom(
            msg.sender,
            address(this),
            loanInfo.repayment
        );
        if (isEthColl()) {
            payable(msg.sender).transfer(loanInfo.collateral);
        } else {
            IERC20Metadata(collCcyToken).transfer(
                msg.sender,
                loanInfo.collateral
            );
        }
        emit Repay(_loanIdx, loanInfo.repayment, loanInfo.collateral);
    }

    function claim(uint256[] calldata _loanIdxs) external override {
        uint256 arrayLen = _loanIdxs.length;
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (arrayLen == 0 || lpInfo.shares == 0) revert NothingToClaim();
        if (_loanIdxs[0] == 0 || _loanIdxs[arrayLen - 1] >= loanIdx)
            revert InvalidLoanIdx();
        if (_loanIdxs[0] < lpInfo.fromLoanIdx) revert UnentitledFromLoanIdx();
        if (
            lpInfo.toLoanIdx != 0 && _loanIdxs[arrayLen - 1] >= lpInfo.toLoanIdx
        ) revert UnentitledToLoanIdx();

        (
            uint256 repayments,
            uint256 collateral,
            uint256 numDefaults
        ) = getClaimsFromList(_loanIdxs, arrayLen, lpInfo.shares);
        lpInfo.fromLoanIdx = uint32(_loanIdxs[arrayLen - 1]) + 1;

        if (repayments > 0) {
            IERC20Metadata(loanCcyToken).transfer(msg.sender, repayments);
        }
        if (collateral > 0) {
            if (isEthColl()) {
                payable(msg.sender).transfer(collateral);
            } else {
                IERC20Metadata(collCcyToken).transfer(msg.sender, collateral);
            }
        }
        emit Claim(_loanIdxs, repayments, collateral, numDefaults);
    }

    //including _fromLoanIdx and _toLoanIdx
    function aggregateClaims(uint256 _fromLoanIdx, uint256 _toLoanIdx)
        external
        override
    {
        if (_fromLoanIdx == 0 || _toLoanIdx >= loanIdx) revert InvalidLoanIdx();
        if (_fromLoanIdx >= _toLoanIdx) revert InvalidFromToAggregation();
        AggClaimsInfo memory aggClaimsInfo;
        aggClaimsInfo = loanIdxRangeToAggClaimsInfo[
            keccak256(abi.encodePacked(_fromLoanIdx, _toLoanIdx))
        ];
        if (aggClaimsInfo.repayments > 0 || aggClaimsInfo.collateral > 0)
            revert AggregatedAlready();
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
        aggClaimsInfo.repayments = uint128(repayments);
        aggClaimsInfo.collateral = uint128(collateral);
        loanIdxRangeToAggClaimsInfo[
            keccak256(abi.encodePacked(_fromLoanIdx, _toLoanIdx))
        ] = aggClaimsInfo;
        emit AggregateClaims(
            _fromLoanIdx,
            _toLoanIdx,
            repayments,
            collateral,
            numDefaults
        );
    }

    //including _fromLoanIdx and _toLoanIdx
    function claimFromAggregated(uint256 _fromLoanIdx, uint256 _toLoanIdx)
        external
        override
    {
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        if (lpInfo.shares == 0) revert NothingToClaim();
        if (_fromLoanIdx < lpInfo.fromLoanIdx) revert UnentitledFromLoanIdx();
        if (lpInfo.toLoanIdx != 0 && _toLoanIdx >= lpInfo.toLoanIdx)
            revert UnentitledToLoanIdx();

        (uint256 repayments, uint256 collateral) = getClaimsFromAggregated(
            _fromLoanIdx,
            _toLoanIdx,
            lpInfo.shares
        );
        lpInfo.fromLoanIdx = uint32(_toLoanIdx) + 1;

        if (repayments > 0) {
            IERC20Metadata(loanCcyToken).transfer(msg.sender, repayments);
        }
        if (collateral > 0) {
            if (isEthColl()) {
                payable(msg.sender).transfer(collateral);
            } else {
                IERC20Metadata(collCcyToken).transfer(msg.sender, collateral);
            }
        }
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
    ) public view returns (uint256, uint256) {
        AggClaimsInfo memory aggClaimsInfo;
        aggClaimsInfo = loanIdxRangeToAggClaimsInfo[
            keccak256(abi.encodePacked(_fromLoanIdx, _toLoanIdx))
        ];
        if (aggClaimsInfo.repayments == 0 && aggClaimsInfo.collateral == 0)
            revert NothingAggregatedToClaim();

        uint256 repayments = (aggClaimsInfo.repayments * _shares) / BASE;
        uint256 collateral = (aggClaimsInfo.collateral * _shares) / BASE;

        return (repayments, collateral);
    }

    function getClaimsFromList(
        uint256[] calldata _loanIdxs,
        uint256 arrayLen,
        uint256 _shares
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 repayments;
        uint256 collateral;
        uint256 numDefaults;
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
        repayments = (repayments * _shares) / BASE;
        collateral = (collateral * _shares) / BASE;

        return (repayments, collateral, numDefaults);
    }

    function setProtocolFee(uint128 _newFee) external {
        require(msg.sender == TREASURY, "must have treasury as sender");
        require(_newFee != protocolFee, "must have different _newFee");
        require(_newFee <= MAX_PROTOCOL_FEE, "must be <= MAX_PROTOCOL_FEE");
        emit FeeUpdate(protocolFee, _newFee);
        protocolFee = _newFee;
    }
}
