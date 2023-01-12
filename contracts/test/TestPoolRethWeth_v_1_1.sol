// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BasePool_v_1_1} from "../BasePool_v_1_1.sol";

contract TestPoolRethWeth_v_1_1 is BasePool_v_1_1 {
    constructor(
        uint256 _loanTenor,
        uint256 _maxLoanPerColl,
        uint256 _r1,
        uint256 _r2,
        uint256 _liquidityBnd1,
        uint256 _liquidityBnd2,
        uint256 _minLoan,
        uint256 _baseAggrBucketSize,
        uint256 _creatorFee
    )
        BasePool_v_1_1(
            0xAd8A44ABa5B476b26169Db0927d2a2061cB52344,
            0x1bf071eFa5D35776B149605dE477AaFE4B0cA282,
            _loanTenor,
            _maxLoanPerColl,
            _r1,
            _r2,
            _liquidityBnd1,
            _liquidityBnd2,
            _minLoan,
            _baseAggrBucketSize,
            _creatorFee,
            10 ** 16
        )
    {}

    function updateTerms(
        uint256 _maxLoanPerColl,
        uint256 _creatorFee,
        uint256 _r1,
        uint256 _r2,
        uint256 _liquidityBnd1,
        uint256 _liquidityBnd2
    ) external {
        if (msg.sender != poolCreator) {
            revert();
        }
        if (_maxLoanPerColl == 0) revert InvalidMaxLoanPerColl();
        if (_r1 <= _r2 || _r2 == 0) revert InvalidRateParams();
        if (_liquidityBnd2 <= _liquidityBnd1 || _liquidityBnd1 == 0)
            revert InvalidLiquidityBnds();
        if (_creatorFee > MAX_FEE) revert InvalidFee();
        maxLoanPerColl = _maxLoanPerColl;
        creatorFee = _creatorFee;
        r1 = _r1;
        r2 = _r2;
        liquidityBnd1 = _liquidityBnd1;
        liquidityBnd2 = _liquidityBnd2;
        emit UpdatedTerms(
            maxLoanPerColl,
            creatorFee,
            r1,
            r2,
            liquidityBnd1,
            liquidityBnd2
        );
    }

    function getCollCcyTransferFee(
        uint128 /*_transferAmount*/
    ) internal pure override returns (uint128 transferFee) {
        transferFee = 0;
    }

    function getLoanCcyTransferFee(
        uint128 /*_transferAmount*/
    ) internal pure override returns (uint128 transferFee) {
        transferFee = 0;
    }
}
