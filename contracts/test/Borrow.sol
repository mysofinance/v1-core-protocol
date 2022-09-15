// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IBasePool} from "../interfaces/IBasePool.sol";

contract Borrow {
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

    function borrow(
        address _recipient,
        uint128 _pledgeAmount,
        uint128 _minLoanLimit,
        uint128 _maxRepayLimit,
        uint256 _deadline
    ) external {
        IERC20Metadata(collCcyToken).transferFrom(
            _recipient,
            address(this),
            _pledgeAmount
        );
        IBasePool(pool).borrow(
            address(this),
            _pledgeAmount,
            _minLoanLimit,
            _maxRepayLimit,
            _deadline,
            0
        );
        uint256 loanCcyBal = IERC20Metadata(loanCcyToken).balanceOf(
            address(this)
        );
        uint256 collCcyBal = IERC20Metadata(collCcyToken).balanceOf(
            address(this)
        );
        IERC20Metadata(loanCcyToken).transfer(_recipient, loanCcyBal);
        if (collCcyBal > 0) {
            IERC20Metadata(collCcyToken).transfer(_recipient, collCcyBal);
        }
    }
}
