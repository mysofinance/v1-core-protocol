// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;


contract Test {

    event Test(uint256 a, uint256 b, uint256 c);
    uint24 constant LOAN_TENOR = 10; //1M = 199384
    uint24 constant GRACE_PERIOD = 199384;
    uint8 constant COLL_DEICMALS = 18;
    uint8 constant PRECISION = 18;
    uint8 constant LEVELS_PER_SLOT = 3;
    uint256 immutable initMinLpAmount;
    uint256 immutable maxBorrowablePerColl;
    uint128[LEVELS_PER_SLOT-1] levelWeights;

    struct LpInfo {
        address addr;
        uint128 weights;
        bool removedLiquidity;
        uint32 claimUntil;
    }

    struct LoanInfo {
        uint256[LEVELS_PER_SLOT] lpSnapshot;
        uint256 collAndRepayAmounts;
        uint128 totalWeights;
        address borrower;
        uint32 expiry;
        bool repaid;
    }

    uint128 public loanIdx;
    uint128 totalWeights;
    uint256 scaleFactor;
    uint256 public totalLiquidity;
    uint256[LEVELS_PER_SLOT] lpSlots;
    uint256 public claimable;
    mapping(uint256 => LpInfo) slotIdxToLpInfo;
    mapping(uint256 => LoanInfo) loanIdxToLoanInfo;
    mapping(address => uint256) lpToMaxLoanIdxClaimed;

    constructor(uint256 _maxBorrowablePerColl, uint128[LEVELS_PER_SLOT-1] memory _levelWeights, uint256 _initMinLpAmount) {
        require(_maxBorrowablePerColl > 0, "invalid max. borrowable amount");
        require(_initMinLpAmount > 0, "invalid init. lp amount");
        for (uint256 i = 0; i < LEVELS_PER_SLOT-1; ++i) {
            require(_levelWeights[i] > 0, "invalid level weight");
        }
        maxBorrowablePerColl = _maxBorrowablePerColl;
        levelWeights = _levelWeights;
        initMinLpAmount = _initMinLpAmount;
        scaleFactor = 10**PRECISION;
        loanIdx = 1;//bump to 1 to handle default 0 in lpToMaxLoanIdxClaimed
    }

    function addLiquidity(uint256 _slotIdx, bool[LEVELS_PER_SLOT] calldata _levelFlags) external {
        require(_slotIdx < 256, "invalid lp slot");
        LpInfo storage lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr == address(0) || (lpInfo.removedLiquidity && lpInfo.claimUntil < block.number), "lp slot alreay in use");
        uint256 liquidityAdded;
        uint128 weights;
        for (uint256 i = 0; i < LEVELS_PER_SLOT; ++i) {
            if(_levelFlags[i]) {
                lpSlots[i] |= uint256(1) << _slotIdx;
                weights += i == 0 ? 1 : levelWeights[i-1];
            }
        }
        liquidityAdded = uint256(weights) * initMinLpAmount * scaleFactor / 10**PRECISION;
        require(liquidityAdded > 0, "liquidityAdded > 0");
        totalWeights += weights;
        totalLiquidity += liquidityAdded;
        lpInfo.addr = msg.sender;
        lpInfo.weights = weights;
        lpInfo.removedLiquidity = false;
        //ERC20 transfer liquidityAdded
    }

    function removeLiquidity(uint256 _slotIdx) external {
        LpInfo storage lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr != address(0), "empty lp slot");
        require(lpInfo.addr == msg.sender, "unauthorized lp slot");
        require(!lpInfo.removedLiquidity, "already removed liquidity");
        uint256 liquidityRemoved;
        for (uint256 i = 0; i < LEVELS_PER_SLOT; ++i) {
            lpSlots[i] = lpSlots[i] & ~(uint256(1) << _slotIdx);
        }
        liquidityRemoved = lpInfo.weights * initMinLpAmount * scaleFactor / 10**PRECISION;
        totalWeights -= lpInfo.weights;
        totalLiquidity -= liquidityRemoved;
        lpInfo.removedLiquidity = true;
        lpInfo.claimUntil = uint32(block.number) + LOAN_TENOR + GRACE_PERIOD;
        //ERC20 transfer liquidityRemoved
    }

    function borrow(uint256 _pledgeAmount) external {
        require(_pledgeAmount > 0, "must pledge > 0");
        uint256 loanAmount = _pledgeAmount * maxBorrowablePerColl * totalLiquidity / (_pledgeAmount * maxBorrowablePerColl + totalLiquidity * 10**COLL_DEICMALS);
        uint256 interestRate = 5*10**16;//5% for illustration purpose
        uint256 repaymentAmount = loanAmount * (10**PRECISION + interestRate) / 10**PRECISION;
        require(repaymentAmount > loanAmount, "repayment must be greater than loan");
        scaleFactor = scaleFactor * (totalLiquidity - loanAmount) / totalLiquidity;
        emit Test(loanAmount, repaymentAmount, scaleFactor);
        require(scaleFactor > 0, "scaleFactor > 0");
        LoanInfo memory loanInfo;
        loanInfo.borrower = msg.sender;
        loanInfo.expiry = uint32(block.number) + LOAN_TENOR;
        loanInfo.lpSnapshot = lpSlots;
        loanInfo.totalWeights = totalWeights;
        loanInfo.collAndRepayAmounts = (_pledgeAmount << 128) + uint128(repaymentAmount);
        loanIdxToLoanInfo[loanIdx] = loanInfo;
        loanIdx += 1;
        totalLiquidity -= loanAmount;
        //ERC20 transfer _pledgeAmount and loanAmount
    }

    function repay(uint256 _loanIdx) external {
        require(_loanIdx > 0, "loan id must be > 0");
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        require(loanInfo.borrower == msg.sender, "unauthorized repay");
        require(block.number + 1 < loanInfo.expiry, "loan expired");
        require(!loanInfo.repaid, "loan already repaid");
        loanInfo.repaid = true;
        claimable += uint128(loanInfo.collAndRepayAmounts);
        //ERC20 transfer repaid and collateral
    }

    function claim(uint256 _slotIdx, uint256[] calldata _loanIdxs, uint8 _checkLevel) external {
        LpInfo memory lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr == msg.sender, "lp unentitled for slot");
        require(_loanIdxs[0] != 0, "loan idx must be > 0");
        require(_loanIdxs[0] > lpToMaxLoanIdxClaimed[msg.sender], "lp already claimed");
        LoanInfo memory loanInfo = loanIdxToLoanInfo[_loanIdxs[0]];
        require(block.number > loanInfo.expiry, "loan must have expired");//only need to check once due to sorting
        uint256 repayments;
        uint256 collateral;
        uint256 check = uint256(1) << _slotIdx;
        uint256 arrayLen = _loanIdxs.length;
        uint256 prevLoanIdx;
        for (uint128 i = 0; i < arrayLen; ++i) {
            if(i > 0) {
                require(_loanIdxs[i] > prevLoanIdx, "loan ids must be ascending");
                loanInfo = loanIdxToLoanInfo[_loanIdxs[i]];
            }
            check &= loanInfo.lpSnapshot[_checkLevel];
            if (loanInfo.repaid) {
                repayments += uint128(loanInfo.collAndRepayAmounts) * loanInfo.totalWeights / lpInfo.weights;
            } else {
                collateral += (loanInfo.collAndRepayAmounts >> 128);
            }
            prevLoanIdx = _loanIdxs[i];
        }
        check = (check >> _slotIdx) & uint256(1);
        require(check == 1, "lp not entitled for all loan ids");
        lpToMaxLoanIdxClaimed[msg.sender] = _loanIdxs[arrayLen-1];
        claimable -= repayments;
        //ERC20 transfer repayments and collateral
    }

    function isEntitled(uint8 _slotIdx, uint256[] calldata _loanIdxs) external view returns(bool[] memory) {
        uint256 n = _loanIdxs.length;
        require(n > 0, "invalid _loanIdxs");
        bool[] memory _isEntitled = new bool[](n);
        for (uint128 i = 0; i < n; ++i) {
            LoanInfo memory loanInfo = loanIdxToLoanInfo[_loanIdxs[i]];
            uint128 j = 0;
            uint256 check;
            while(check == 0 && j < LEVELS_PER_SLOT) {
                check = (loanInfo.lpSnapshot[j] >> _slotIdx) & uint256(1);
                if(check == 1){
                    _isEntitled[i] = true;
                }
                j += 1;
            }
        }
        return _isEntitled;
    }
}