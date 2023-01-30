# IBasePool_v_1_2









## Methods

### borrow

```solidity
function borrow(uint128[3] limitsAndAmount, uint256 _deadline, uint256 _referralCode) external nonpayable
```

Function which allows borrowing from the pool _sendAmount Amount of collateral currency sent by borrower _minLoan Minimum loan currency amount acceptable to borrower _maxRepay Maximum allowable loan currency amount borrower is willing to repay



#### Parameters

| Name | Type | Description |
|---|---|---|
| limitsAndAmount | uint128[3] | undefined |
| _deadline | uint256 | Timestamp after which transaction will be void |
| _referralCode | uint256 | Code for later possible rewards in referral program |

### claimCreator

```solidity
function claimCreator() external nonpayable
```

Function to claim proposed creator role




### getPoolInfo

```solidity
function getPoolInfo() external view returns (address _loanCcyToken, address _collCcyToken, uint256 _maxLoanPerColl, uint256 _minLoan, uint256 _loanTenor, uint256 _totalLiquidity, uint256 _loanIdx)
```

Function which returns pool information

*This function can be used to get pool information*


#### Returns

| Name | Type | Description |
|---|---|---|
| _loanCcyToken | address | Loan currency |
| _collCcyToken | address | Collateral currency |
| _maxLoanPerColl | uint256 | Maximum loan amount per pledged collateral unit |
| _minLoan | uint256 | Minimum loan size |
| _loanTenor | uint256 | Loan tenor |
| _totalLiquidity | uint256 | Total liquidity available for loans |
| _loanIdx | uint256 | Loan index for the next incoming loan |

### getRateParams

```solidity
function getRateParams() external view returns (uint256 _liquidityBnd1, uint256 _liquidityBnd2, uint256 _r1, uint256 _r2)
```

Function which returns rate parameters need for interest rate calculation

*This function can be used to get parameters needed for interest rate calculations*


#### Returns

| Name | Type | Description |
|---|---|---|
| _liquidityBnd1 | uint256 | Amount of liquidity the pool needs to end the reciprocal (hyperbola) range and start &quot;target&quot; range |
| _liquidityBnd2 | uint256 | Amount of liquidity the pool needs to end the &quot;target&quot; range and start flat rate |
| _r1 | uint256 | Rate that is used at start of target range |
| _r2 | uint256 | Minimum rate at end of target range. This is minimum allowable rate |

### loanIdxToBorrower

```solidity
function loanIdxToBorrower(uint256 loanIdx) external view returns (address)
```

Getter which returns the borrower for a given loan idx



#### Parameters

| Name | Type | Description |
|---|---|---|
| loanIdx | uint256 | The loan idx |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The borrower address |

### loanTerms

```solidity
function loanTerms(uint128 _inAmountAfterFees) external view returns (uint128 loanAmount, uint128 repaymentAmount, uint128 pledgeAmount, uint256 _creatorFee)
```

Function which calculates loan terms



#### Parameters

| Name | Type | Description |
|---|---|---|
| _inAmountAfterFees | uint128 | Amount of collateral currency after fees are deducted |

#### Returns

| Name | Type | Description |
|---|---|---|
| loanAmount | uint128 | Amount of loan currency to be trasnferred to the borrower |
| repaymentAmount | uint128 | Amount of loan currency borrower must repay to reclaim collateral |
| pledgeAmount | uint128 | Amount of collateral currency borrower retrieves upon repayment |
| _creatorFee | uint256 | Amount of collateral currency to be transferred to treasury |

### proposeNewCreator

```solidity
function proposeNewCreator(address _newAddr) external nonpayable
```

Function which proposes a new pool creator address



#### Parameters

| Name | Type | Description |
|---|---|---|
| _newAddr | address | Address that is being proposed as new pool creator |

### removeLiquidity

```solidity
function removeLiquidity(uint256 amount) external nonpayable
```

Function which removes shares from an LPs

*This function will remove loan currency*

#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | Amount of loan Coll to remove |

### repay

```solidity
function repay(uint256 _loanIdx, address _recipient, uint128 _sendAmount) external nonpayable
```

Function which allows repayment of a loan

*The sent amount of loan currency must be sufficient to account for any fees on transfer (if any)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _loanIdx | uint256 | Index of the loan to be repaid |
| _recipient | address | Address that will receive the collateral transfer |
| _sendAmount | uint128 | Amount of loan currency sent for repayment. |

### rollOver

```solidity
function rollOver(uint256 _loanIdx, uint128[3] limitsAndAmount, uint256 _deadline) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _loanIdx | uint256 | undefined |
| limitsAndAmount | uint128[3] | undefined |
| _deadline | uint256 | undefined |



## Events

### Borrow

```solidity
event Borrow(address indexed borrower, uint256 loanIdx, uint256 collateral, uint256 loanAmount, uint256 repaymentAmount, uint256 indexed expiry, uint256 indexed referralCode)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| borrower `indexed` | address | undefined |
| loanIdx  | uint256 | undefined |
| collateral  | uint256 | undefined |
| loanAmount  | uint256 | undefined |
| repaymentAmount  | uint256 | undefined |
| expiry `indexed` | uint256 | undefined |
| referralCode `indexed` | uint256 | undefined |

### LpWhitelistUpdate

```solidity
event LpWhitelistUpdate(address indexed lpAddr, bool isApproved)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| lpAddr `indexed` | address | undefined |
| isApproved  | bool | undefined |

### NewSubPool

```solidity
event NewSubPool(address loanCcyToken, address collCcyToken, uint256 loanTenor, uint256 maxLoanPerColl, uint256 r1, uint256 r2, uint256 liquidityBnd1, uint256 liquidityBnd2, uint256 minLoan, uint256 creatorFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| loanCcyToken  | address | undefined |
| collCcyToken  | address | undefined |
| loanTenor  | uint256 | undefined |
| maxLoanPerColl  | uint256 | undefined |
| r1  | uint256 | undefined |
| r2  | uint256 | undefined |
| liquidityBnd1  | uint256 | undefined |
| liquidityBnd2  | uint256 | undefined |
| minLoan  | uint256 | undefined |
| creatorFee  | uint256 | undefined |

### RemoveLiquidity

```solidity
event RemoveLiquidity(uint256 amount, uint256 indexed loanIdx)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount  | uint256 | undefined |
| loanIdx `indexed` | uint256 | undefined |

### Repay

```solidity
event Repay(address indexed borrower, uint256 loanIdx, uint256 repaymentAmountAfterFees)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| borrower `indexed` | address | undefined |
| loanIdx  | uint256 | undefined |
| repaymentAmountAfterFees  | uint256 | undefined |

### Rollover

```solidity
event Rollover(address indexed borrower, uint256 loanIdx, uint256 collateral, uint256 loanAmount, uint256 repaymentAmount, uint256 indexed expiry)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| borrower `indexed` | address | undefined |
| loanIdx  | uint256 | undefined |
| collateral  | uint256 | undefined |
| loanAmount  | uint256 | undefined |
| repaymentAmount  | uint256 | undefined |
| expiry `indexed` | uint256 | undefined |

### UpdatedTerms

```solidity
event UpdatedTerms(uint256 maxLoanPerColl, uint256 creatorFee, uint256 r1, uint256 r2, uint256 liquidityBnd1, uint256 liquidityBnd2)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| maxLoanPerColl  | uint256 | undefined |
| creatorFee  | uint256 | undefined |
| r1  | uint256 | undefined |
| r2  | uint256 | undefined |
| liquidityBnd1  | uint256 | undefined |
| liquidityBnd2  | uint256 | undefined |



