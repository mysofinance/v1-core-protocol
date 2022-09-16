pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IUSDC is IERC20Metadata {
    function configureMinter(address minter, uint256 minterAllowedAmount)
        external;

    function mint(address account, uint256 amount) external;
}
