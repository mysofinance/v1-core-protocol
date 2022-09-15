pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IPAXG is IERC20Metadata {
    function getFeeFor(uint256 _value) external view returns (uint256);

    function increaseSupply(uint256 _value) external returns (bool success);
}
