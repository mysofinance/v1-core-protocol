// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface RocketTokenRETHInterface is IERC20 {
    function getEthValue(uint256 _rethAmount) external view returns (uint256);

    function getRethValue(uint256 _ethAmount) external view returns (uint256);

    function getExchangeRate() external view returns (uint256);

    function getTotalCollateral() external view returns (uint256);

    function getCollateralRate() external view returns (uint256);

    function depositExcess() external payable;

    function depositExcessCollateral() external;

    function mint(uint256 _ethAmount, address _to) external;

    function burn(uint256 _rethAmount) external;
}
