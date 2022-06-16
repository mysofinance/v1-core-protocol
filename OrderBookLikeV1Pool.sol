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
    mapping(uint128 => LoanInfo) loanIdxToLoanInfo;

    constructor(uint128 _maxBorrowablePerColl, uint8[LEVELS_PER_SLOT-1] memory _levelWeights, uint24 _initMinLpAmount) {
        require(_maxBorrowablePerColl > 0, "invalid max. borrowable amount");
        maxBorrowablePerColl = _maxBorrowablePerColl;
        levelWeights = _levelWeights;
        initMinLpAmount = _initMinLpAmount;
        scaleFactor = uint128(10**PRECISION);
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
        LpInfo memory lpInfo;
        lpInfo.addr = msg.sender;
        lpInfo.weights = weights;
        slotIdxToLpInfo[_slotIdx] = lpInfo;
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

    function borrow(uint128 _pledgeAmount) external {
        uint256 loanAmount = _pledgeAmount * uint256(maxBorrowablePerColl);
        scaleFactor = scaleFactor;//update
        LoanInfo memory loanInfo;
        loanInfo.lpSnapshot = lpSlots;
        loanInfo.repayAndCollateral = 1;
        loanIdxToLoanInfo[loanIdx] = loanInfo;
        loanIdx += 1;
    }

    function claim(uint256 _slotIdx, uint128[] calldata _loanIdxs, uint8 _checkLevel) external {
        LpInfo memory lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr == msg.sender, "unentitled lp slot");
        uint128 repayments;
        uint128 collateral;
        uint256 check = uint256(1) << _slotIdx;
        for (uint128 i = 0; i < _loanIdxs.length; ++i) {
            LoanInfo memory loanInfo = loanIdxToLoanInfo[_loanIdxs[i]];
            //uint256 flag = (loanInfo.lpSnapshot[_checkLevel] >> _slotIdx) & uint8(1);
            //require(flag == 1, "unentitled lp");
            check &= loanInfo.lpSnapshot[_checkLevel];
            if (loanInfo.repaid) {
                repayments += uint128(loanInfo.repayAndCollateral >> 128);
            } else {
                collateral += uint128(loanInfo.repayAndCollateral << 128);
            }
        }
        check = (check >> _slotIdx) & uint8(1); //check outside of loop to reduce gas costs
        require(check == 1, "unentitled lp");
    }

    function isEntitled(uint8 _slotIdx, uint128[] calldata _loanIdxs) external view returns(bool[] memory) {
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