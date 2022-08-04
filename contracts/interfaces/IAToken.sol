pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IAToken is IERC20Metadata {
    function scaledBalanceOf(address user) external view returns (uint256);
}
