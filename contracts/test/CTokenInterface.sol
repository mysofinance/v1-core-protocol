pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface CTokenInterface is IERC20Metadata {
    function exchangeRateCurrent() external virtual returns (uint256);

    function exchangeRateStored() external view virtual returns (uint256);

    function mint(uint256 mintAmount) external virtual returns (uint256);

    function redeem(uint256 redeemTokens) external virtual returns (uint256);
}
