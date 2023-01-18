// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

interface IDAOController {
    function updateTerms(
        uint256 _maxLoanPerColl,
        uint256 _creatorFee,
        uint256 _r1,
        uint256 _r2,
        uint256 _liquidityBnd1,
        uint256 _liquidityBnd2
    ) external;
}
