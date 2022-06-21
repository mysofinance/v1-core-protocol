// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;


contract Contract {

    event Test(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e);
    uint24 constant LOAN_TENOR = 10; //1M = 199384
    uint24 constant GRACE_PERIOD = 199384;
    uint24 constant MIN_LPING_PERIOD = 1;
    uint8 constant COLL_DECIMALS = 18;
    uint8 constant PRECISION = 18;
    uint256 immutable initMinLpAmount;
    uint256 immutable maxLoanPerColl;
    uint256 immutable minAPR;
    uint256 immutable scaleAPR;

    struct LpInfo {
        address addr;
        uint128 weight;
        bool removedLiquidity;
        uint32 reassignableAfter;
        uint32 earliestRemove;
    }

    struct LoanInfo {
        uint256 lpSnapshot;
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
    uint256 lpSlots;
    uint256 public totalClaimableRepays;
    mapping(uint256 => LpInfo) slotIdxToLpInfo;
    mapping(uint256 => LoanInfo) loanIdxToLoanInfo;
    mapping(bytes32 => uint256) lpToMaxLoanIdxClaimed;

    constructor(uint256 _maxLoanPerColl, uint256 _initMinLpAmount, uint256 _minAPR, uint256 _scaleAPR) {
        require(_maxLoanPerColl > 0, "invalid max. borrowable amount");
        require(_initMinLpAmount > 0, "invalid init. lp amount");
        maxLoanPerColl = _maxLoanPerColl;
        initMinLpAmount = _initMinLpAmount;
        scaleFactor = 10**PRECISION;
        minAPR = _minAPR;
        scaleAPR = _scaleAPR;
        loanIdx = 1;//bump to 1 to handle default 0 in lpToMaxLoanIdxClaimed
    }

    function minLpAmount() external view returns(uint256) {
        return initMinLpAmount * scaleFactor / 10**PRECISION;
    }

    function addLiquidity(uint256 _slotIdx, uint128 _weight) external {
        require(_slotIdx < 256, "invalid lp slot");
        require(_weight > 0, "weights > 0");
        LpInfo storage lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr == address(0) || (lpInfo.removedLiquidity && lpInfo.reassignableAfter < block.number), "lp slot alreay in use");
        uint256 liquidityAdded = _weight * initMinLpAmount * scaleFactor / 10**PRECISION;
        require(liquidityAdded > 0, "liquidityAdded > 0");
        lpSlots |= uint256(1) << _slotIdx;
        totalWeights += _weight;
        totalLiquidity += liquidityAdded;
        lpInfo.addr = msg.sender;
        lpInfo.weight = _weight;
        lpInfo.removedLiquidity = false;
        lpInfo.earliestRemove = uint32(block.number) + MIN_LPING_PERIOD;
        //ERC20 transfer liquidityAdded
    }

    function removeLiquidity(uint256 _slotIdx) external {
        LpInfo storage lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr != address(0), "empty lp slot");
        require(lpInfo.addr == msg.sender, "unauthorized lp slot");
        require(!lpInfo.removedLiquidity, "already removed liquidity");
        require(block.number > lpInfo.earliestRemove, "before min. lping period");
        uint256 liquidityRemoved;
        lpSlots &= ~(uint256(1) << _slotIdx);
        liquidityRemoved = lpInfo.weight * initMinLpAmount * scaleFactor / 10**PRECISION;
        totalWeights -= lpInfo.weight;
        totalLiquidity -= liquidityRemoved;
        lpInfo.removedLiquidity = true;
        lpInfo.reassignableAfter = uint32(block.number) + LOAN_TENOR + GRACE_PERIOD;
        //ERC20 transfer liquidityRemoved
    }

    function borrow(uint256 _pledgeAmount, uint256 _minLoan, uint256 _maxRepay, uint256 _deadline) external {
        uint256 blockNum = block.number;
        require(_deadline < blockNum, "after deadline");
        require(_pledgeAmount > 0, "must pledge > 0");
        uint256 loanAmount = _pledgeAmount * maxLoanPerColl * totalLiquidity / (_pledgeAmount * maxLoanPerColl + totalLiquidity * 10**COLL_DECIMALS);
        require(loanAmount > _minLoan, "below _minLoan limit");
        uint256 util = loanAmount * 10**PRECISION / totalLiquidity;
        uint256 interestRate = scaleAPR * util / (10**PRECISION - util) + minAPR;
        uint256 repaymentAmount = loanAmount * (10**PRECISION + interestRate) / 10**PRECISION;
        require(repaymentAmount > loanAmount, "repayment must be greater than loan");
        require(repaymentAmount < _maxRepay, "above _maxRepay limit");
        scaleFactor = scaleFactor * (totalLiquidity - loanAmount) / totalLiquidity;
        emit Test(loanAmount, util, interestRate, repaymentAmount, scaleFactor);
        require(scaleFactor > 0, "scaleFactor > 0");
        LoanInfo memory loanInfo;
        loanInfo.borrower = msg.sender;
        loanInfo.expiry = uint32(blockNum) + LOAN_TENOR;
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
        require(block.number > loanInfo.expiry - LOAN_TENOR, "cannot repay in same block");
        loanInfo.repaid = true;
        totalClaimableRepays += uint128(loanInfo.collAndRepayAmounts);
        //ERC20 transfer repaid and collateral
    }

    function claim(uint256 _slotIdx, uint256[] calldata _loanIdxs) external {
        LpInfo memory lpInfo = slotIdxToLpInfo[_slotIdx];
        require(lpInfo.addr == msg.sender, "lp unentitled for slot");
        require(_loanIdxs[0] != 0, "loan idx must be > 0");
        require(_loanIdxs[0] > lpToMaxLoanIdxClaimed[keccak256(abi.encodePacked(_slotIdx,msg.sender))], "lp already claimed given slot");
        LoanInfo memory loanInfo = loanIdxToLoanInfo[_loanIdxs[0]];
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
            check &= loanInfo.lpSnapshot;
            if (loanInfo.repaid) {
                repayments += uint128(loanInfo.collAndRepayAmounts) * lpInfo.weight / loanInfo.totalWeights;
            } else if (block.number > loanInfo.expiry) {
                collateral += (loanInfo.collAndRepayAmounts >> 128) * lpInfo.weight / loanInfo.totalWeights;
            }
            prevLoanIdx = _loanIdxs[i];
        }
        check = (check >> _slotIdx) & uint256(1);
        require(check == 1, "lp not entitled for all loan ids");
        lpToMaxLoanIdxClaimed[keccak256(abi.encodePacked(_slotIdx,msg.sender))] = _loanIdxs[arrayLen-1];
        totalClaimableRepays -= repayments;
        //ERC20 transfer repayments and collateral
    }

    function groupClaim(uint256[] calldata _slotIdx, uint256[] calldata _loanIdxs) external {
    }
}