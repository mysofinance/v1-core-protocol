// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;


contract Test {

    uint8 constant PRECISION = 18;
    uint8 constant LEVELS_PER_SLOT = 3;
    uint8[LEVELS_PER_SLOT-1] levelWeights;
    uint24 immutable initMinLpAmount;

    struct LpInfo {
        address addr;
        uint8 weights;
    }

    struct LoanInfo {
        uint256[LEVELS_PER_SLOT] lpSnapshot;
        uint256 repayAndCollateral;
        uint32 expiry;
        uint128 loan;
        bool repaid;
    }

    uint128 loanIdx;
    uint128 scaleFactor;
    uint128 immutable maxBorrowablePerColl;
    uint256 public totalLiquidity;
    uint128 totalWeights;
    uint256[LEVELS_PER_SLOT] lpSlots;
    mapping(uint256 => LpInfo) slotIdxToLpInfo;
    mapping(uint256 => LoanInfo) loanIdxToLoanInfo;
    mapping(address => uint256) lpToMaxLoanIdxClaimed;

    constructor(uint128 _maxBorrowablePerColl, uint8[LEVELS_PER_SLOT-1] memory _levelWeights, uint24 _initMinLpAmount) {
        require(_maxBorrowablePerColl > 0, "invalid max. borrowable amount");
        maxBorrowablePerColl = _maxBorrowablePerColl;
        levelWeights = _levelWeights;
        initMinLpAmount = _initMinLpAmount;
        scaleFactor = uint128(10**PRECISION);
        loanIdx = 1;//bump to 1 to handle default 0 in lpToMaxLoanIdxClaimed
    }

    function addLiquidity(uint256 _slotIdx, bool[LEVELS_PER_SLOT] calldata _levelFlags) external {
        require(slotIdxToLpInfo[_slotIdx].addr == address(0), "lp slot alreay used");
        uint8 weights;
        for (uint256 i = 0; i < LEVELS_PER_SLOT; ++i) {
            if(_levelFlags[i]) {
                lpSlots[i] |= uint256(1) << _slotIdx;
                weights += i == 0 ? 1 : levelWeights[i-1];
            }
        }
        totalWeights += weights;
        totalLiquidity += weights * initMinLpAmount * scaleFactor / 10**PRECISION;
        slotIdxToLpInfo[_slotIdx] = LpInfo(msg.sender, weights);
    }

    function removeLiquidity(uint256 _slotIdx) external {
        LpInfo storage lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr != address(0), "unused lp slot");
        require(lpInfo.addr == msg.sender, "unassociated lp slot");
        for (uint256 i = 0; i < LEVELS_PER_SLOT; ++i) {
            lpSlots[i] = lpSlots[i] & ~(uint256(1) << _slotIdx);
        }
        totalWeights -= lpInfo.weights;
        totalLiquidity -= lpInfo.weights * initMinLpAmount * scaleFactor / 10**PRECISION;
        lpInfo.addr = address(0);
    }

    function borrow(uint256 _pledgeAmount) external {
        uint256 loanAmount = _pledgeAmount * maxBorrowablePerColl;
        scaleFactor = scaleFactor;//update
        LoanInfo memory loanInfo;
        loanInfo.lpSnapshot = lpSlots;
        loanInfo.repayAndCollateral = 1;
        loanIdxToLoanInfo[loanIdx] = loanInfo;
        loanIdx += 1;
    }

    function repay(uint256 _loanIdx) external {
        LoanInfo storage loanInfo = loanIdxToLoanInfo[_loanIdx];
        require(block.number + 1 < loanInfo.expiry, "loan expired");
        require(!loanInfo.repaid, "loan already repaid");
        loanInfo.repaid = true;
    }

    function claim(uint256 _slotIdx, uint256[] calldata _loanIdxs, uint8 _checkLevel) external {
        LpInfo memory lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr == msg.sender, "lp unentitled for slot");
        require(_loanIdxs[0] != 0, "loan idx must be > 0");
        require(_loanIdxs[0] > lpToMaxLoanIdxClaimed[msg.sender], "lp already claimed");
        uint128 repayments;
        uint128 collateral;
        uint256 check = uint256(1) << _slotIdx;
        uint256 arrayLen = _loanIdxs.length;
        uint256 currLoanIdx;
        uint256 prevLoanIdx;
        for (uint128 i = 0; i < arrayLen; ++i) {
            currLoanIdx = _loanIdxs[i];
            require(i==0 || _loanIdxs[i] > prevLoanIdx, "loanIdxs must be ascending");
            LoanInfo memory loanInfo = loanIdxToLoanInfo[currLoanIdx];
            check &= loanInfo.lpSnapshot[_checkLevel];
            if (loanInfo.repaid) {
                repayments += uint128(loanInfo.repayAndCollateral << 128);
            } else {
                collateral += uint128(loanInfo.repayAndCollateral);
            }
            prevLoanIdx = currLoanIdx;
        }
        check = (check >> _slotIdx) & uint256(1); //check outside of loop to reduce gas costs
        lpToMaxLoanIdxClaimed[msg.sender] = currLoanIdx;
        require(check == 1, "lp not entitled for all loan idxs");
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