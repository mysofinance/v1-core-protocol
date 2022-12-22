// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.17;

interface IPriceOracleGetter {
    function getAssetPrice(address _asset) external view returns (uint256);

    function getAssetsPrices(
        address[2] calldata _assets
    ) external view returns (uint256[2] memory);

    function getSourceOfAsset(address _asset) external view returns (address);

    function getFallbackOracle() external view returns (address);
}
