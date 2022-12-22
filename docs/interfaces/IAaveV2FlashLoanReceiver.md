# IAaveV2FlashLoanReceiver









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

### executeOperation

```solidity
function executeOperation(address[] assets, uint256[] amounts, uint256[] premiums, address initiator, bytes params) external nonpayable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| assets | address[] | undefined |
| amounts | uint256[] | undefined |
| premiums | uint256[] | undefined |
| initiator | address | undefined |
| params | bytes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |




