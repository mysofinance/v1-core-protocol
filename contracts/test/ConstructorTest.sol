// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {BasePool} from "../BasePool.sol";
import {IPAXG} from "../interfaces/IPAXG.sol";

contract ConstructorTest is BasePool {
    constructor(
        address _loanCcyAddr,
        address _collCcyAddr,
        uint24 _loanTenor,
        uint128 _maxLoanPerColl,
        uint256 _r1,
        uint256 _r2,
        uint256 _liquidityBnd1,
        uint256 _liquidityBnd2,
        uint256 _minLoan,
        uint256 _baseAggrBucketSize,
        uint128 _creatorFee
    )
        BasePool(
            _loanCcyAddr,
            _collCcyAddr,
            _loanTenor,
            _maxLoanPerColl,
            _r1,
            _r2,
            _liquidityBnd1,
            _liquidityBnd2,
            _minLoan,
            _baseAggrBucketSize,
            _creatorFee,
            10 * 10**6
        )
    {}

    function getTotalLiquidity() internal view override returns (uint256) {
        return totalLiquidity;
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
