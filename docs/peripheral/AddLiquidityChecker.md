# AddLiquidityChecker

_this contract needs to implement any allowedToAdd // just have it return true to allow any adder, else implement any logic // you want in that function to have more fine-grained add control // example here is a whitelist mapping (could only be one address for one particular adder) // but in principle if you put complex logic or even require a seperate contract to call which checked // a merkle tree white (or black) list or whatever you wanted_

## Methods

### allowedToAdd

```solidity
function allowedToAdd(address liquidityAdder) external view returns (bool)
```

#### Parameters

| Name           | Type    | Description |
| -------------- | ------- | ----------- |
| liquidityAdder | address | undefined   |

#### Returns

| Name | Type | Description |
| ---- | ---- | ----------- |
| \_0  | bool | undefined   |

### toggleWhitelist

```solidity
function toggleWhitelist(address updatedAddr) external nonpayable
```

#### Parameters

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| updatedAddr | address | undefined   |

### whitelistAddrs

```solidity
function whitelistAddrs(address) external view returns (bool)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | address | undefined   |

#### Returns

| Name | Type | Description |
| ---- | ---- | ----------- |
| \_0  | bool | undefined   |

## Errors

### InvalidAdmin

```solidity
error InvalidAdmin()
```
