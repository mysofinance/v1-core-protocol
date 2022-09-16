// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BasePool} from "../../BasePool.sol";
import {IPAXG} from "../../interfaces/IPAXG.sol";

contract PoolPaxgUsdc is BasePool {
    constructor(
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
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0x45804880De22913dAFE09f4980848ECE6EcbAf78,
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

    function getCollCcyTransferFee(uint128 _transferAmount)
        internal
        view
        override
        returns (uint128 transferFee)
    {
        uint256 _transferFee = IPAXG(collCcyToken).getFeeFor(_transferAmount);
        transferFee = uint128(_transferFee);
        assert(transferFee == _transferFee);
    }

    function getLoanCcyTransferFee(
        uint128 /*_transferAmount*/
    ) internal pure override returns (uint128 transferFee) {
        transferFee = 0;
    }
}
