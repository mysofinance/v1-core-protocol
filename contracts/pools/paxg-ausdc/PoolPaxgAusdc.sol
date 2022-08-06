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

    function getBalances() public override view returns (uint256 _totalLiquidity, uint256 _totalClaimable) {
        uint256 totalBalanceWithoutInterest = totalLiquidity + totalClaimable;
        uint256 totalBalanceWithInterest = IAToken(loanCcyToken).balanceOf(address(this));
        _totalLiquidity = totalLiquidity;
        _totalClaimable = totalClaimable;
        if (totalBalanceWithoutInterest > 0) {
            _totalLiquidity = _totalLiquidity * totalBalanceWithInterest / totalBalanceWithoutInterest;
            _totalClaimable = _totalClaimable * totalBalanceWithInterest / totalBalanceWithoutInterest;
        }
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

    function getClaimsFromList(
        uint256[] calldata _loanIdxs,
        uint256 arrayLen,
        uint256 _shares
    ) internal override view returns (uint256 repayments, uint256 collateral) {
        (repayments, collateral) = super.getClaimsFromList(_loanIdxs, arrayLen, _shares);
        uint256 totalBalanceWithoutInterest = totalLiquidity + totalClaimable;
        uint256 totalBalanceWithInterest = IAToken(loanCcyToken).balanceOf(address(this));
        if (totalBalanceWithoutInterest > 0) {
            repayments = repayments * totalBalanceWithInterest / totalBalanceWithoutInterest;
        }
    }

    function getClaimsFromAggregated(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256 _shares
    ) public override view returns (uint256 repayments, uint256 collateral) {
        (repayments, collateral) = super.getClaimsFromAggregated(_fromLoanIdx, _toLoanIdx, _shares);
        uint256 totalBalanceWithoutInterest = totalLiquidity + totalClaimable;
        uint256 totalBalanceWithInterest = IAToken(loanCcyToken).balanceOf(address(this));
        if (totalBalanceWithoutInterest > 0) {
            repayments = repayments * totalBalanceWithInterest / totalBalanceWithoutInterest;
        }
    }
}
