// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BasePool} from "../../BasePool.sol";
import {IPAXG} from "../../interfaces/IPAXG.sol";

contract PoolPaxgUsdc is BasePool {
    constructor(
        address _loanCcyToken,
        uint24 _loanTenor,
        uint128 _maxLoanPerColl,
        uint256 _r1,
        uint256 _r2,
        uint256 _tvl1,
        uint256 _tvl2,
        uint256 _minLoan,
        uint256 _firstLengthPerClaimInterval
    )
        BasePool(
            _loanCcyToken,
            0x45804880De22913dAFE09f4980848ECE6EcbAf78,
            _loanTenor,
            _maxLoanPerColl,
            _r1,
            _r2,
            _tvl1,
            _tvl2,
            _minLoan,
            _firstLengthPerClaimInterval
        )
    {}

    function getBalances() public override view returns (uint256 _totalLiquidity, uint256 _totalClaimable) {
        _totalLiquidity = totalLiquidity;
        _totalClaimable = totalClaimable;
    }

    function getTransferFee(uint128 pledgeAmount)
        internal
        view
        override
        returns (uint128)
    {
        uint256 transferFee = IPAXG(collCcyToken).getFeeFor(pledgeAmount);
        return uint128(transferFee);
    }
}
