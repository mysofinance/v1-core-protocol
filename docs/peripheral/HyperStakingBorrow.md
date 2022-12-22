# HyperStakingBorrow









## Methods

### ADDRESSES_PROVIDER

```solidity
function ADDRESSES_PROVIDER() external view returns (contract IAaveV2LendingPoolAddressesProvider)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IAaveV2LendingPoolAddressesProvider | undefined |

### LENDING_POOL

```solidity
function LENDING_POOL() external view returns (contract IAaveV2LendingPool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IAaveV2LendingPool | undefined |

### borrow

```solidity
function borrow(HyperStakingBorrow.FlashBorrowPayload flashBorrowPayload, uint256 _wethFlashBorrow) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| flashBorrowPayload | HyperStakingBorrow.FlashBorrowPayload | undefined |
| _wethFlashBorrow | uint256 | undefined |

### executeOperation

```solidity
function executeOperation(address[], uint256[] amounts, uint256[] premiums, address, bytes params) external nonpayable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address[] | undefined |
| amounts | uint256[] | undefined |
| premiums | uint256[] | undefined |
| _3 | address | undefined |
| params | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |




