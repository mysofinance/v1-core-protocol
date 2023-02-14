// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BasePool } from "../../BasePool.sol";

contract PoolWethUsdc is BasePool {
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
      0x496402aE6104357B55B8e555f6cb143b2AE429F9,
      0xDde7759573c2a8cCa7C806a127c947aEc7124B12,
      _loanTenor,
      _maxLoanPerColl,
      _r1,
      _r2,
      _liquidityBnd1,
      _liquidityBnd2,
      _minLoan,
      _baseAggrBucketSize,
      _creatorFee,
      10 * 10 ** 6
    )
  {}

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
