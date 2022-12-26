// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AaveV2FlashLoanReceiverBase} from "./AaveV2FlashLoanReceiverBase.sol";
import {IAaveV2LendingPool} from "../interfaces/IAaveV2LendingPool.sol";
import {IAaveV2LendingPoolAddressesProvider} from "../interfaces/IAaveV2LendingPoolAddressesProvider.sol";
import {DataTypes} from "../interfaces/BalancerDataTypes.sol";
import {IBalancerAsset} from "../interfaces/IBalancerAsset.sol";
import {IBalancerVault} from "../interfaces/IBalancerVault.sol";
import {IBasePool} from "../interfaces/IBasePool.sol";

contract HyperStakingBorrow is AaveV2FlashLoanReceiverBase {
    using SafeERC20 for IERC20Metadata;

    address WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address RETH = 0xae78736Cd615f374D3085123A210448E74Fc6393;
    address AaveV2LendingPool = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
    address BalancerV2 = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

    struct FlashBorrowPayload {
        address _mysoPoolRethWeth;
        address _onBehalf;
        uint256 _wethFlashBorrow;
        uint256 _minRethSwapReceive;
        uint128 _rethPledgeTopup;
        uint128 _minWethLoanReceive;
        uint128 _maxRethRepay;
        uint256 _deadline;
    }

    constructor()
        AaveV2FlashLoanReceiverBase(
            IAaveV2LendingPoolAddressesProvider(
                0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
            )
        )
    {}

    function borrow(FlashBorrowPayload calldata flashBorrowPayload) external {
        bytes memory params = abi.encode(flashBorrowPayload);

        address[] memory assets = new address[](1);
        assets[0] = address(WETH);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashBorrowPayload._wethFlashBorrow;

        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        IAaveV2LendingPool(AaveV2LendingPool).flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0
        );
    }

    function executeOperation(
        address[] calldata /*assets*/,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address /*initiator*/,
        bytes calldata params
    ) external returns (bool) {
        FlashBorrowPayload memory flashBorrowPayload = abi.decode(
            params,
            (FlashBorrowPayload)
        );
        DataTypes.FundManagement memory fundManagement = DataTypes
            .FundManagement(address(this), false, payable(this), false);
        DataTypes.SingleSwap memory singleSwap = DataTypes.SingleSwap(
            bytes32(
                0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112
            ),
            DataTypes.SwapKind.GIVEN_IN,
            IBalancerAsset(WETH),
            IBalancerAsset(RETH),
            amounts[0] - premiums[0],
            "0x"
        );
        IERC20Metadata(WETH).approve(address(BalancerV2), amounts[0]);

        uint256 amountReceive = IBalancerVault(BalancerV2).swap(
            singleSwap,
            fundManagement,
            flashBorrowPayload._minRethSwapReceive,
            flashBorrowPayload._deadline
        );

        IERC20Metadata(RETH).safeTransferFrom(
            flashBorrowPayload._onBehalf,
            address(this),
            flashBorrowPayload._rethPledgeTopup
        );
        IERC20Metadata(RETH).approve(
            flashBorrowPayload._mysoPoolRethWeth,
            flashBorrowPayload._rethPledgeTopup + uint128(amountReceive)
        );

        IBasePool(flashBorrowPayload._mysoPoolRethWeth).borrow(
            flashBorrowPayload._onBehalf,
            flashBorrowPayload._rethPledgeTopup + uint128(amountReceive),
            flashBorrowPayload._minWethLoanReceive,
            flashBorrowPayload._maxRethRepay,
            flashBorrowPayload._deadline,
            0
        );

        IERC20Metadata(WETH).approve(
            address(AaveV2LendingPool),
            amounts[0] + premiums[0]
        );
        IERC20Metadata(WETH).safeTransfer(
            flashBorrowPayload._onBehalf,
            IERC20Metadata(WETH).balanceOf(address(this)) -
                amounts[0] -
                premiums[0]
        );
        return true;
    }

    receive() external payable {}
}
