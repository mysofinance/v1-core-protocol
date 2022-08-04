// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BasePool} from "../../BasePool.sol";
import {IPAXG} from "../../interfaces/IPAXG.sol";
import {IAToken} from "../../interfaces/IAToken.sol";

contract PoolPaxgAusdc is BasePool {
    constructor(
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
            0xBcca60bB61934080951369a648Fb03DF4F96263C,
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

    function getTotalLiquidity() public view override returns (uint256) {
        uint256 balanceOf = IAToken(loanCcyToken).balanceOf(address(this));
        return balanceOf;
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
