// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IBasePool} from "../interfaces/IBasePool.sol";

contract PeripheralTest {
    address pool;
    address loanCcyToken;
    address collCcyToken;

    constructor(
        address _pool,
        address _loanCcyToken,
        address _collCcyToken
    ) {
        pool = _pool;
        IERC20Metadata(_loanCcyToken).approve(_pool, type(uint256).max);
        IERC20Metadata(_collCcyToken).approve(_pool, type(uint256).max);
        loanCcyToken = _loanCcyToken;
        collCcyToken = _collCcyToken;
    }

    function borrowAndRepay(
        uint128 _sendAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint256 _loanIdx
    ) external {
        IERC20Metadata(collCcyToken).transferFrom(
            msg.sender,
            address(this),
            _sendAmount
        );
        IBasePool(pool).borrow(
            address(this),
            _sendAmount,
            _minLoanLimit,
            _maxRepayLimit,
            _deadline,
            0
        );
        IERC20Metadata(loanCcyToken).transferFrom(
            msg.sender,
            address(this),
            _maxRepayLimit
        );
        IBasePool(pool).repay(_loanIdx, address(this), _maxRepayLimit);
        uint256 loanCcyBal = IERC20Metadata(loanCcyToken).balanceOf(
            address(this)
        );
        uint256 collCcyBal = IERC20Metadata(collCcyToken).balanceOf(
            address(this)
        );
        IERC20Metadata(loanCcyToken).transfer(msg.sender, loanCcyBal);
        IERC20Metadata(collCcyToken).transfer(msg.sender, collCcyBal);
    }

    function borrowAndRollOver(
        uint128 _sendAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline,
        uint256 _loanIdx
    ) external {
        IERC20Metadata(collCcyToken).transferFrom(
            msg.sender,
            address(this),
            _sendAmount
        );
        IBasePool(pool).borrow(
            address(this),
            _sendAmount,
            _minLoanLimit,
            _maxRepayLimit,
            _deadline,
            0
        );
        IERC20Metadata(loanCcyToken).transferFrom(
            msg.sender,
            address(this),
            _maxRepayLimit
        );
        IBasePool(pool).rollOver(
            _loanIdx,
            _minLoanLimit,
            _maxRepayLimit,
            _deadline,
            _maxRepayLimit - _minLoanLimit
        );
        uint256 loanCcyBal = IERC20Metadata(loanCcyToken).balanceOf(
            address(this)
        );
        uint256 collCcyBal = IERC20Metadata(collCcyToken).balanceOf(
            address(this)
        );
        IERC20Metadata(loanCcyToken).transfer(msg.sender, loanCcyBal);
        IERC20Metadata(collCcyToken).transfer(msg.sender, collCcyBal);
    }
}
