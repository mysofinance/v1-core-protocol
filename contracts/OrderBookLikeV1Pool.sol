// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

contract OrderBookLikeV1Pool {
    event Test(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e);
    uint24 constant LOAN_TENOR = 10; //1M = 199384
    uint24 constant GRACE_PERIOD = 199384;
    uint24 constant MIN_LPING_PERIOD = 1;
    uint8 constant COLL_DECIMALS = 18;
    uint8 constant PRECISION = 18;
    uint256 immutable initMinLpAmount;
    uint256 immutable maxLoanPerColl;
    uint256 immutable r1;
    uint256 immutable r2;
    uint256 immutable tvl1;
    uint256 immutable tvl2;

    struct LpInfo {
        address addr;
        uint128 weight;
        bool removedLiquidity;
        uint32 reassignableAfter;
        uint32 earliestRemove;
    }

    struct LoanInfo {
        uint256 lpSnapshot;
        uint128 repayment;
        uint128 collateral;
        uint128 totalWeights;
        address borrower;
        uint32 expiry;
        bool repaid;
    }

    struct BatchedClaimsInfo {
        uint128 repayments;
        uint128 collateral;
        uint128 batchedWeight;
        uint128 maxLoanIdx;
    }

    uint128 public loanIdx;
    uint128 totalWeights;
    uint256 scaleFactor;
    uint256 public totalLiquidity;
    uint256 lpSlots;
    uint256 public totalClaimableRepays;
    mapping(uint256 => LpInfo) slotIdxToLpInfo;
    mapping(uint256 => LoanInfo) loanIdxToLoanInfo;
    mapping(bytes32 => uint256) lpToMaxLoanIdxClaimed;
    mapping(bytes32 => BatchedClaimsInfo) slotsToClaimsInfo;

    constructor(
        uint256 _maxLoanPerColl,
        uint256 _initMinLpAmount,
        uint256 _r1,
        uint256 _r2,
        uint256 _tvl1,
        uint256 _tvl2
    ) {
        require(_maxLoanPerColl > 0, "invalid max. borrowable amount");
        require(_initMinLpAmount > 0, "invalid init. lp amount");
        require(_r1 > _r2, "invalid apr params");
        require(_tvl2 > _tvl1, "invalid tvl params");
        maxLoanPerColl = _maxLoanPerColl;
        initMinLpAmount = _initMinLpAmount;
        scaleFactor = 10**PRECISION;
        r1 = _r1;
        r2 = _r2;
        tvl1 = _tvl1;
        tvl2 = _tvl2;
        loanIdx = 1; //bump to 1 to handle default 0 in lpToMaxLoanIdxClaimed
    }

    function minLpAmount() external view returns (uint256) {
        return (initMinLpAmount * scaleFactor) / 10**PRECISION;
    }

    function addLiquidity(uint256 _slotIdx, uint128 _amount) external {
        require(_slotIdx < 256, "_slotIdx out of bounds");
        require(_amount > 0, "weights > 0");
        LpInfo storage lpInfo = slotIdxToLpInfo[_slotIdx];
        require(
            lpInfo.addr == address(0) ||
                (lpInfo.removedLiquidity &&
                    lpInfo.reassignableAfter < block.number),
            "lp slot alreay in use"
        );
        uint128 weight = uint128(_amount * 10**PRECISION / (initMinLpAmount * scaleFactor));
        uint256 liquidityAdded = weight * initMinLpAmount * scaleFactor / 10**PRECISION;
        require(liquidityAdded > 0, "liquidityAdded > 0");
        lpSlots |= uint256(1) << _slotIdx;
        totalWeights += weight;
        totalLiquidity += liquidityAdded;
        lpInfo.addr = msg.sender;
        lpInfo.weight = weight;
        lpInfo.removedLiquidity = false;
        lpInfo.earliestRemove = uint32(block.number) + MIN_LPING_PERIOD;
        //ERC20 transfer liquidityAdded
    }

    function removeLiquidity(uint256 _slotIdx) external {
        require(_slotIdx < 256, "_slotIdx out of bounds");
        LpInfo storage lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr != address(0), "empty lp slot");
        require(lpInfo.addr == msg.sender, "unauthorized lp slot");
        require(!lpInfo.removedLiquidity, "already removed liquidity");
        uint256 blockNum = block.number;
        require(blockNum > lpInfo.earliestRemove, "before min. lping period");
        uint256 liquidityRemoved;
        lpSlots &= ~(uint256(1) << _slotIdx);
        liquidityRemoved =
            (lpInfo.weight * initMinLpAmount * scaleFactor) /
            10**PRECISION;
        totalWeights -= lpInfo.weight;
        totalLiquidity -= liquidityRemoved;
        lpInfo.removedLiquidity = true;
        lpInfo.reassignableAfter = uint32(blockNum) + LOAN_TENOR + GRACE_PERIOD;
        //ERC20 transfer liquidityRemoved
    }

    function loanTerms(uint128 _pledgeAmount)
        public
        view
        returns (uint128, uint256)
    {
        uint256 loanAmount = (_pledgeAmount * maxLoanPerColl * totalLiquidity) /
            (_pledgeAmount *
                maxLoanPerColl +
                totalLiquidity *
                10**COLL_DECIMALS);

        uint256 rate;
        uint256 x = totalLiquidity - loanAmount;
        if (x < tvl1) {
            rate = (r1 * tvl1) / (x);
        } else if (x < tvl2) {
            rate = ((r1 - r2) * (tvl2 - x)) / (tvl2 - tvl1) + r2;
        } else {
            rate = r2;
        }

        return (uint128(loanAmount), rate);
    }

    function borrow(
        uint128 _pledgeAmount,
        uint128 _minLoan,
        uint128 _maxRepay,
        uint256 _deadline
    ) external {
        uint256 blockNum = block.number;
        require(blockNum < _deadline, "after deadline");
        require(_pledgeAmount > 0, "must pledge > 0");
        (uint128 loanAmount, uint256 rate) = loanTerms(_pledgeAmount);
        require(loanAmount > _minLoan, "below _minLoan limit");
        uint128 repaymentAmount = uint128((loanAmount * (10**PRECISION + rate)) /
            10**PRECISION);
        require(
            repaymentAmount > loanAmount,
            "repayment must be greater than loan"
        );
        require(repaymentAmount < _maxRepay, "above _maxRepay limit");
        scaleFactor =
            (scaleFactor * (totalLiquidity - loanAmount)) /
            totalLiquidity;
        emit Test(
            totalLiquidity,
            loanAmount,
            rate,
            repaymentAmount,
            scaleFactor
        );
        require(scaleFactor > 0, "scaleFactor > 0");
        LoanInfo memory loanInfo;
        loanInfo.borrower = msg.sender;
        loanInfo.expiry = uint32(blockNum) + LOAN_TENOR;
        loanInfo.lpSnapshot = lpSlots;
        loanInfo.totalWeights = totalWeights;
        loanInfo.repayment = repaymentAmount;
        loanInfo.collateral = _pledgeAmount;
        loanIdxToLoanInfo[loanIdx] = loanInfo;
        loanIdx += 1;
        totalLiquidity -= loanAmount;
        //ERC20 transfer _pledgeAmount and loanAmount
    }

    function repay(uint256 _loanIdx) external {
        require(_loanIdx > 0 && _loanIdx < loanIdx, "loan id out of bounds");
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        require(loanInfo.borrower == msg.sender, "unauthorized repay");
        require(block.number + 1 < loanInfo.expiry, "loan expired");
        require(!loanInfo.repaid, "loan already repaid");
        require(
            block.number > loanInfo.expiry - LOAN_TENOR,
            "cannot repay in same block"
        );
        loanInfo.repaid = true;
        totalClaimableRepays += loanInfo.repayment;
        //ERC20 transfer repaid and collateral
    }

    function claim(uint256 _slotIdx, uint256[] calldata _loanIdxs) external {
        require(_slotIdx < 256, "_slotIdx out of bounds");
        uint256 arrayLen = _loanIdxs.length;
        require(arrayLen > 0 && arrayLen < loanIdx, "_loanIdxs out of bounds");
        require(_loanIdxs[0] != 0, "loan idx must be > 0");
        require(_loanIdxs[arrayLen-1] < loanIdx, "invalid loan id");
        LpInfo memory lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr == msg.sender, "lp unentitled for slot");
        require(
            _loanIdxs[0] >
                lpToMaxLoanIdxClaimed[
                    keccak256(abi.encodePacked(_slotIdx, msg.sender))
                ],
            "lp already claimed given slot"
        );
        LoanInfo memory loanInfo = loanIdxToLoanInfo[_loanIdxs[0]];
        require(block.number > loanInfo.expiry, "loans must have expired");
        uint256 checkSlot = uint256(1) << _slotIdx;
        (
            uint256 repayments,
            uint256 collateral,
            uint256 checkInAll
        ) = _repayCollAndCheckMask(checkSlot, _loanIdxs, lpInfo.weight);
        require(checkInAll == checkSlot, "slot not entitled to all loans");
        lpToMaxLoanIdxClaimed[
            keccak256(abi.encodePacked(_slotIdx, msg.sender))
        ] = _loanIdxs[arrayLen - 1];
        totalClaimableRepays -= repayments;
        //ERC20 transfer repayments and collateral
    }

    function claimBatched(
        uint256 _idx,
        uint256[] calldata _slots,
        uint256[] calldata _loanIdxs
    ) external {
        uint256 slotArrayLen = _slots.length;
        require(
            slotArrayLen > _idx && slotArrayLen < 256,
            "slotArrayLen out of bounds"
        );
        LpInfo memory lpInfo = slotIdxToLpInfo[_slots[_idx]];
        require(lpInfo.addr == msg.sender, "unentitled lp");
        uint256 loanArrayLen = _loanIdxs.length;
        require(
            loanArrayLen > 0 && loanArrayLen < loanIdx,
            "loanArrayLen out of bounds"
        );
        require(_loanIdxs[0] != 0, "loan idx must be > 0");
        require(_loanIdxs[loanArrayLen-1] < loanIdx, "invalid loan id");
        BatchedClaimsInfo memory claimsInfo = slotsToClaimsInfo[
            keccak256(abi.encodePacked(_slots, _loanIdxs))
        ];
        lpToMaxLoanIdxClaimed[
            keccak256(abi.encodePacked(_idx, msg.sender))
        ] = _loanIdxs[loanArrayLen - 1];
        uint256 repayments = (claimsInfo.repayments * lpInfo.weight) /
            claimsInfo.batchedWeight;
        uint256 collateral = (claimsInfo.collateral * lpInfo.weight) /
            claimsInfo.batchedWeight;
        //ERC20 transfer repayments and collateral
    }

    function batchClaims(
        uint256[] calldata _slots,
        uint256[] calldata _loanIdxs
    ) external {
        (uint128 batchedWeight, uint256 slots) = _weightsAndSlots(_slots);
        (
            uint256 repayments,
            uint256 collateral,
            uint256 checkMask
        ) = _repayCollAndCheckMask(slots, _loanIdxs, batchedWeight);
        uint256 prev = _loanIdxs[0];
        require(slots == checkMask, "slots not entitled to all loans");
        BatchedClaimsInfo memory claimsInfo;
        claimsInfo.repayments = uint128(repayments);
        claimsInfo.collateral = uint128(collateral);
        claimsInfo.batchedWeight = batchedWeight;
        claimsInfo.maxLoanIdx = uint32(prev);
        slotsToClaimsInfo[
            keccak256(abi.encodePacked(_slots, _loanIdxs))
        ] = claimsInfo;
    }

    function _weightsAndSlots(uint256[] calldata _slots)
        internal
        view
        returns (uint128, uint256)
    {
        uint256 slotArrayLen = _slots.length;
        require(slotArrayLen < 256, "slotArrayLen out of bounds");
        LpInfo memory lpInfo;
        uint128 batchedWeight;
        uint256 slots;
        uint256 prev;
        for (uint128 i = 0; i < slotArrayLen; ++i) {
            lpInfo = slotIdxToLpInfo[_slots[i]];
            batchedWeight += lpInfo.weight;
            if (i > 0) {
                require(_slots[i] > prev, "slots must be ascending");
            }
            slots |= uint256(1) << _slots[i];
            prev = _slots[i];
        }
        return (batchedWeight, slots);
    }

    function _repayCollAndCheckMask(
        uint256 _slots,
        uint256[] calldata _loanIdxs,
        uint256 _weight
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 loanArrayLen = _loanIdxs.length;
        require(
            loanArrayLen > 0 && loanArrayLen < loanIdx,
            "loanArrayLen out of bounds"
        );
        LoanInfo memory loanInfo;
        require(block.number > loanInfo.expiry, "loans must have expired");
        uint256 checkMask = _slots;
        uint256 repayments;
        uint256 collateral;
        uint256 prev = _loanIdxs[0];
        for (uint128 i = 0; i < loanArrayLen; ++i) {
            if (i > 0) {
                require(_loanIdxs[i] > prev, "loan ids must be ascending");
            }
            loanInfo = loanIdxToLoanInfo[_loanIdxs[i]];
            checkMask &= loanInfo.lpSnapshot;
            if (loanInfo.repaid) {
                repayments +=
                    (loanInfo.repayment * _weight) /
                    loanInfo.totalWeights;
            } else {
                collateral +=
                    (loanInfo.collateral * _weight) /
                    loanInfo.totalWeights;
            }
            prev = _loanIdxs[i];
        }
        return (repayments, collateral, checkMask);
    }
}
