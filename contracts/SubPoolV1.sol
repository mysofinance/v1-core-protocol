// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract SubPoolV1 {
    event NewSubPool(
        address collCcyToken,
        address loanCcyToken,
        uint24 loanTenor,
        uint128 maxLoanPerColl,
        uint256 r1,
        uint256 r2,
        uint256 tvl1,
        uint256 tvl2
    );
    event AddLiquidity(
        uint256 amount,
        uint256 newLpShares,
        uint256 totalLiquidity,
        uint256 totalLpShares,
        uint256 earliestRemove
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
        uint256 expiry
    );
    event AggregateClaims(
        uint256 fromLoanIdx,
        uint256 toLoanIdx,
        uint256 repayments,
        uint256 collateral,
        uint256 numDefaults
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
    event Repay(uint256 loanIdx, uint256 repayment, uint256 collateral);

    uint32 constant MIN_LPING_PERIOD = 30;
    uint24 immutable LOAN_TENOR;
    uint8 immutable COLL_TOKEN_DECIMALS;

    uint128 public totalLpShares;
    uint256 public totalLiquidity;
    uint256 public loanIdx;
    uint256 public maxLoanPerColl;
    uint256 public r1;
    uint256 public r2;
    uint256 public tvl1;
    uint256 public tvl2;

    address public collCcyToken;
    address public loanCcyToken;

    mapping(address => LpInfo) public addrToLpInfo;
    mapping(uint256 => LoanInfo) public loanIdxToLoanInfo;
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
        address borrower;
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
        uint256 _tvl2
    ) {
        require(_loanCcyToken != address(0), "invalid loan ccy token");
        require(_collCcyToken != _loanCcyToken, "same ccys");
        require(_loanTenor >= 86400, "invalid loanTenor");
        require(_maxLoanPerColl > 0, "invalid max. borrowable amount");
        require(_r1 > _r2, "invalid apr params");
        require(_tvl2 > _tvl1, "invalid tvl params");
        loanCcyToken = _loanCcyToken;
        collCcyToken = _collCcyToken;
        LOAN_TENOR = _loanTenor;
        maxLoanPerColl = _maxLoanPerColl;
        r1 = _r1;
        r2 = _r2;
        tvl1 = _tvl1;
        tvl2 = _tvl2;
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
            _tvl2
        );
    }

    function addLiquidity(uint128 _amount, uint256 _deadline) external {
        uint256 timeStamp = block.timestamp;
        require(timeStamp < _deadline, "after deadline");
        require(_amount > 0, "_amount > 0");
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        bool canAdd = lpInfo.activeLp
            ? false
            : lpInfo.toLoanIdx == lpInfo.fromLoanIdx;
        require(canAdd, "must be inactive without open claims");
        uint128 newLpShares;
        if (totalLiquidity == 0 && totalLpShares == 0) {
            newLpShares = _amount;
        } else {
            newLpShares = uint128((_amount * totalLpShares) / totalLiquidity);
        }
        totalLpShares += newLpShares;
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

    function removeLiquidity() external {
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        require(lpInfo.shares != 0, "no shares");
        require(
            block.timestamp > lpInfo.earliestRemove,
            "before min. lping period"
        );
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

    function loanTerms(uint128 _pledgeAmount)
        public
        view
        returns (uint128, uint128)
    {
        uint128 loanAmount = uint128(
            (_pledgeAmount * maxLoanPerColl * totalLiquidity) /
                (_pledgeAmount *
                    maxLoanPerColl +
                    totalLiquidity *
                    10**COLL_TOKEN_DECIMALS)
        );

        uint256 rate;
        uint256 x = totalLiquidity - loanAmount;
        if (x < tvl1) {
            rate = (r1 * tvl1) / (x);
        } else if (x < tvl2) {
            rate = ((r1 - r2) * (tvl2 - x)) / (tvl2 - tvl1) + r2;
        } else {
            rate = r2;
        }
        uint128 repaymentAmount = uint128(
            (loanAmount * (10**18 + rate)) / 10**18
        );
        return (loanAmount, repaymentAmount);
    }

    function borrow(
        uint128 _pledgeAmount,
        uint128 _minLoan,
        uint128 _maxRepay,
        uint256 _deadline
    ) external payable {
        uint256 timeStamp = block.timestamp;
        require(timeStamp < _deadline, "after deadline");
        uint128 pledgeAmount = collCcyToken == address(0)
            ? uint128(msg.value)
            : _pledgeAmount;
        require(pledgeAmount > 0, "must pledge > 0");
        (uint128 loanAmount, uint128 repaymentAmount) = loanTerms(pledgeAmount);
        require(loanAmount >= _minLoan, "below _minLoan limit");
        require(
            repaymentAmount > loanAmount,
            "repayment must be greater than loan"
        );
        require(repaymentAmount <= _maxRepay, "above _maxRepay limit");
        LoanInfo memory loanInfo;
        loanInfo.borrower = msg.sender;
        loanInfo.expiry = uint32(timeStamp) + LOAN_TENOR;
        loanInfo.totalLpShares = totalLpShares;
        loanInfo.repayment = repaymentAmount;
        loanInfo.collateral = pledgeAmount;
        loanIdxToLoanInfo[loanIdx] = loanInfo;
        loanIdx += 1;
        totalLiquidity -= loanAmount;

        if (collCcyToken != address(0)) {
            IERC20Metadata(collCcyToken).transferFrom(
                msg.sender,
                address(this),
                pledgeAmount
            );
        }
        IERC20Metadata(loanCcyToken).transfer(msg.sender, loanAmount);

        emit Borrow(
            loanIdx - 1,
            pledgeAmount,
            loanAmount,
            repaymentAmount,
            loanInfo.expiry
        );
    }

    function repay(uint256 _loanIdx) external {
        require(_loanIdx > 0 && _loanIdx < loanIdx, "loan id out of bounds");
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        require(loanInfo.borrower == msg.sender, "unauthorized repay");
        require(block.timestamp < loanInfo.expiry, "loan expired");
        require(!loanInfo.repaid, "loan already repaid");
        require(
            block.timestamp > loanInfo.expiry - LOAN_TENOR,
            "cannot repay in same block"
        );
        loanInfo.repaid = true;

        IERC20Metadata(loanCcyToken).transferFrom(
            msg.sender,
            address(this),
            loanInfo.repayment
        );
        if (collCcyToken == address(0)) {
            payable(msg.sender).transfer(loanInfo.collateral);
        } else {
            IERC20Metadata(collCcyToken).transfer(
                msg.sender,
                loanInfo.collateral
            );
        }
        emit Repay(_loanIdx, loanInfo.repayment, loanInfo.collateral);
    }

    function claim(uint256[] calldata _loanIdxs) external {
        uint256 arrayLen = _loanIdxs.length;
        require(arrayLen > 0 && arrayLen < loanIdx, "_loanIdxs out of bounds");
        require(_loanIdxs[0] != 0, "loan idx must be > 0");
        require(_loanIdxs[arrayLen - 1] < loanIdx, "invalid loan id");

        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        require(lpInfo.shares > 0, "nothing to claim");
        require(_loanIdxs[0] >= lpInfo.fromLoanIdx, "outside lower loan id");
        require(
            lpInfo.toLoanIdx == 0 || _loanIdxs[arrayLen - 1] < lpInfo.toLoanIdx,
            "outside upper loan id"
        );

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
            if (collCcyToken == address(0)) {
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
    {
        require(_fromLoanIdx > 0, "_fromLoanIdx > 0");
        require(_toLoanIdx < loanIdx, "_toLoanIdx < loanIdx");
        require(_fromLoanIdx < _toLoanIdx, "_fromLoanIdx < _toLoanIdx");
        AggClaimsInfo memory aggClaimsInfo;
        aggClaimsInfo = loanIdxRangeToAggClaimsInfo[
            keccak256(abi.encodePacked(_fromLoanIdx, _toLoanIdx))
        ];
        require(
            aggClaimsInfo.repayments == 0 && aggClaimsInfo.collateral == 0,
            "already aggregated"
        );
        uint128 repayments;
        uint128 collateral;
        uint256 numDefaults;
        LoanInfo memory loanInfo;
        for (uint256 i = _fromLoanIdx; i <= _toLoanIdx; ++i) {
            loanInfo = loanIdxToLoanInfo[i];
            if (loanInfo.repaid) {
                repayments +=
                    (loanInfo.repayment * 10**18) /
                    loanInfo.totalLpShares;
            } else if (loanInfo.expiry < block.timestamp) {
                collateral +=
                    (loanInfo.collateral * 10**18) /
                    loanInfo.totalLpShares;
                numDefaults += 1;
            } else {
                require(false, "must have been repaid or expired");
            }
        }
        aggClaimsInfo.repayments = repayments;
        aggClaimsInfo.collateral = collateral;
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
    {
        LpInfo storage lpInfo = addrToLpInfo[msg.sender];
        require(lpInfo.shares > 0, "nothing to claim");
        require(_fromLoanIdx >= lpInfo.fromLoanIdx, "outside lower loan id");
        require(
            lpInfo.toLoanIdx == 0 || _toLoanIdx < lpInfo.toLoanIdx,
            "outside upper loan id"
        );

        (uint256 repayments, uint256 collateral) = getClaimsFromAggregated(
            _fromLoanIdx,
            _toLoanIdx,
            lpInfo.shares
        );
        lpInfo.fromLoanIdx = uint32(_toLoanIdx);

        if (repayments > 0) {
            IERC20Metadata(loanCcyToken).transfer(msg.sender, repayments);
        }
        if (collateral > 0) {
            if (collCcyToken == address(0)) {
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
        require(
            aggClaimsInfo.repayments > 0 || aggClaimsInfo.collateral > 0,
            "nothing aggregated"
        );

        uint256 repayments = (aggClaimsInfo.repayments * _shares) / 10**18;
        uint256 collateral = (aggClaimsInfo.collateral * _shares) / 10**18;

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
        LoanInfo memory loanInfo = loanIdxToLoanInfo[_loanIdxs[0]];
        uint256 repayments;
        uint256 collateral;
        uint256 numDefaults;
        for (uint256 i = 0; i < arrayLen; ++i) {
            if (i > 0) {
                loanInfo = loanIdxToLoanInfo[_loanIdxs[i]];
                require(
                    _loanIdxs[i] > _loanIdxs[i - 1],
                    "non ascending loan ids"
                );
            }
            if (loanInfo.repaid) {
                repayments +=
                    (loanInfo.repayment * 10**18) /
                    loanInfo.totalLpShares;
            } else if (loanInfo.expiry < block.timestamp) {
                collateral +=
                    (loanInfo.collateral * 10**18) /
                    loanInfo.totalLpShares;
                numDefaults += 1;
            } else {
                require(false, "must have been repaid or expired");
            }
        }
        repayments = (repayments * _shares) / 10**18;
        collateral = (collateral * _shares) / 10**18;

        return (repayments, collateral, numDefaults);
    }
}