// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IDAOController} from "../interfaces/IDAOController.sol";

contract DaoController {
    using SafeERC20 for IERC20Metadata;

    error IncorrectInitializedAddress();
    error UnapprovedSender();
    error VaultAlreadyInitialized();
    error InvalidFee();
    error CollTokenAlreadyTracked();

    event AdminUpdate(address prevAdmin, address newAdmin);

    event ProtocolAddrUpdate(
        address indexed vault,
        address previous,
        address current
    );

    //NOTE: BASE = 10 ** 18;

    /** these are immutable after admin initializes*/
    // denominated in BASE, this is fee that poolCreator (typically Myso) of vault is guaranteed
    mapping(address => uint256) public minFeeByVault;
    // pool Creator address (typically Myso) for a given vault
    mapping(address => address) public poolCreatorByVault;
    // collateral currency token (typically a DAO token) of a given vault
    mapping(address => address) public collTokenByVault;

    /** these can be updated by vault's protocolAddr */
    // address which controls the parameters of a given vault (typically DAO multi-sig)
    mapping(address => address) public currentProtocolAddrByVault;
    // address which is pending update for protocolAddr of a vault
    mapping(address => address) public pendingProtocolAddrByVault;
    //denominated in BASE, fee of vault currently...needed to determine ratio that poolCreator should get
    mapping(address => uint256) public currentFeeByVault;

    /** this tracks balance of collToken from a vault */
    // tracks balance per vault for which a transfer to pool Creator was made
    mapping(address => uint256) public lastBalancesSinceTransferByVault;

    /** this tracks if a token has already been used as collCcy */
    // tracks if a coll token is already being tracked
    // only one DAO token can be tracked at a time without clashes
    mapping(address => bool) public isCollTokenInUse;

    address public admin; // only address allowed to initialize for contracts
    address public pendingAdmin; // address that will be admin after claim

    constructor() {
        admin = msg.sender;
    }

    function initializeContract(
        uint256 _minFee,
        address _poolCreator,
        uint256 _currentFee,
        address _currentProtocolAddr,
        address _collTokenAddr,
        address _vaultAddr
    ) external {
        if (msg.sender != admin) revert UnapprovedSender();
        if (
            _poolCreator == address(0) ||
            _currentProtocolAddr == address(0) ||
            _collTokenAddr == address(0)
        ) revert IncorrectInitializedAddress();
        if (_currentFee < _minFee) revert InvalidFee();
        if (poolCreatorByVault[_vaultAddr] != address(0))
            revert VaultAlreadyInitialized();
        if (isCollTokenInUse[_collTokenAddr]) revert CollTokenAlreadyTracked();
        minFeeByVault[_vaultAddr] = _minFee;
        poolCreatorByVault[_vaultAddr] = _poolCreator;
        collTokenByVault[_vaultAddr] = _collTokenAddr;
        currentProtocolAddrByVault[_vaultAddr] = _currentProtocolAddr;
        currentFeeByVault[_vaultAddr] = _currentFee;
        isCollTokenInUse[_collTokenAddr] = true;
    }

    function proposeNewAdmin(address newAddr) external {
        if (msg.sender != admin) {
            revert UnapprovedSender();
        }
        pendingAdmin = newAddr;
    }

    function claimNewAdmin() external {
        if (msg.sender != pendingAdmin) {
            revert UnapprovedSender();
        }
        address prevPoolAdmin = admin;
        admin = msg.sender;
        emit AdminUpdate(prevPoolAdmin, msg.sender);
    }

    function proposeNewProtocolAddrForVault(
        address newAddr,
        address vault
    ) external {
        if (msg.sender != currentProtocolAddrByVault[vault]) {
            revert UnapprovedSender();
        }
        pendingProtocolAddrByVault[vault] = newAddr;
    }

    function claimNewProtoclAddrForVault(address vault) external {
        if (msg.sender != pendingProtocolAddrByVault[vault]) {
            revert UnapprovedSender();
        }
        address prevProtocolAddr = currentProtocolAddrByVault[vault];
        currentProtocolAddrByVault[vault] = msg.sender;
        emit ProtocolAddrUpdate(vault, prevProtocolAddr, msg.sender);
    }

    function updateTermsOfVault(
        uint256 _maxLoanPerColl,
        uint256 _creatorFee,
        uint256 _r1,
        uint256 _r2,
        uint256 _liquidityBnd1,
        uint256 _liquidityBnd2,
        address vault
    ) external {
        if (msg.sender != currentProtocolAddrByVault[vault])
            revert UnapprovedSender();
        if (_creatorFee < minFeeByVault[vault]) revert InvalidFee();
        IDAOController(vault).updateTerms(
            _maxLoanPerColl,
            _creatorFee,
            _r1,
            _r2,
            _liquidityBnd1,
            _liquidityBnd2
        );
        address collTokenAddr = collTokenByVault[vault];
        uint256 lastTransferBalance = lastBalancesSinceTransferByVault[vault];
        uint256 currentBalance = IERC20Metadata(collTokenAddr).balanceOf(
            address(this)
        );
        uint256 feesToTransfer = ((currentBalance - lastTransferBalance) *
            minFeeByVault[vault]) / currentFeeByVault[vault];
        lastBalancesSinceTransferByVault[vault] =
            currentBalance -
            feesToTransfer;
        currentFeeByVault[vault] = _creatorFee;
        IERC20Metadata(collTokenAddr).safeTransfer(admin, feesToTransfer);
    }

    function withdrawFromVault(address vault) external {
        if (msg.sender != currentProtocolAddrByVault[vault])
            revert UnapprovedSender();
        address collTokenAddr = collTokenByVault[vault];
        uint256 lastTransferBalance = lastBalancesSinceTransferByVault[vault];
        uint256 currentBalance = IERC20Metadata(collTokenAddr).balanceOf(
            address(this)
        );
        uint256 feesToTransfer = ((currentBalance - lastTransferBalance) *
            minFeeByVault[vault]) / currentFeeByVault[vault];
        IERC20Metadata(collTokenAddr).safeTransfer(admin, feesToTransfer);
        IERC20Metadata(collTokenAddr).safeTransfer(
            currentProtocolAddrByVault[vault],
            currentBalance - feesToTransfer
        );
        lastBalancesSinceTransferByVault[vault] = 0;
    }
}
