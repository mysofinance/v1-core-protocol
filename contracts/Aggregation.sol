// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.15;

import {ISubPoolV1} from "./interfaces/ISubPoolV1.sol";

contract Aggregation {
    error InvalidFromToAggregation();
    error NonAscendingLoanIdxs();
    error InvalidSubAggregation();
    error NothingAggregatedToClaim();

    uint256 constant BASE = 10**18;

    address public poolAddr;

    constructor(address _poolAddr){
        poolAddr = _poolAddr;
    }

    function aggregrateClaimsHelper(uint256 startLoanIndex, uint256[] memory endAggIdxs)
        external
        view
        returns (ISubPoolV1.AggClaimsInfo[] memory)
    {
        ISubPoolV1.AggClaimsInfo[] memory newAggClaims = new ISubPoolV1.AggClaimsInfo[](
            endAggIdxs.length
        );
        uint256 index = 0;
        uint256 startIndex = startLoanIndex;
        uint256 endIndex = endAggIdxs.length == 0 ? 0 : endAggIdxs[0];
        ISubPoolV1.AggClaimsInfo memory currAggClaimInfo;
        while (index < endAggIdxs.length) {
            if(startIndex % 100 != 0 || endIndex % 100 != 99){
                revert InvalidFromToAggregation();
            }
            if (index != endAggIdxs.length - 1) {
                if (endAggIdxs[index] >= endAggIdxs[index + 1])
                    revert NonAscendingLoanIdxs();
            }
            if (endIndex - startIndex == 99){
                //check for expiration and/or last non-repaid if adding bitmasks
                uint32 expiryCheck = ISubPoolV1(poolAddr).getLoanExpiry(endIndex);
                if ( expiryCheck > block.timestamp + 1){
                    revert InvalidSubAggregation();
                }
            }
            endIndex - startIndex == 99 ?
                currAggClaimInfo = ISubPoolV1(poolAddr).getAggClaimInfo(startIndex,0,true) :
                currAggClaimInfo = ISubPoolV1(poolAddr).getAggClaimInfo(startIndex,endIndex,false);
            if (
                currAggClaimInfo.collateral == 0 &&
                currAggClaimInfo.repayments == 0
            ) revert InvalidSubAggregation();
            newAggClaims[index] = currAggClaimInfo;
            unchecked {
                startIndex = endIndex + 1;
                index++;
                if(index != endAggIdxs.length){
                    endIndex = endAggIdxs[index];
                }
            }
        }
        return newAggClaims;
    }

    function getClaimsFromAggregated(
        uint256 _fromLoanIdx,
        uint256 _toLoanIdx,
        uint256 _shares
    ) public view returns (uint256, uint256) {
        ISubPoolV1.AggClaimsInfo memory aggClaimsInfo;
        _toLoanIdx - _fromLoanIdx == 99 ?
                aggClaimsInfo = ISubPoolV1(poolAddr).getAggClaimInfo(_fromLoanIdx,0,true) :
                aggClaimsInfo = ISubPoolV1(poolAddr).getAggClaimInfo(_fromLoanIdx,_toLoanIdx,false);
        
        if (aggClaimsInfo.repayments == 0 && aggClaimsInfo.collateral == 0)
            revert NothingAggregatedToClaim();
        if (_toLoanIdx - _fromLoanIdx == 99){
                //check for expiration and/or last non-repaid if adding bitmasks
                uint32 expiryCheck = ISubPoolV1(poolAddr).getLoanExpiry(_toLoanIdx);
                if ( expiryCheck > block.timestamp + 1){
                    revert InvalidSubAggregation();
                }
            }
        uint256 repayments = (aggClaimsInfo.repayments * _shares) / BASE;
        uint256 collateral = (aggClaimsInfo.collateral * _shares) / BASE;

        return (repayments, collateral);
    }
}