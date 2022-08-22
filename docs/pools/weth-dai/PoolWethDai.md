# PoolWethDai









## Methods

### addLiquidity

```solidity
function addLiquidity(address _onBehalfOf, uint128 _sendAmount, uint256 _deadline, uint16 _referralCode) external nonpayable
```

Function which adds to an LPs current position

*This function will update loanIdxsWhereSharesChanged only if not the first add. If address on behalf of is not sender, then sender must have permission.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _onBehalfOf | address | Recipient of the LP shares |
| _sendAmount | uint128 | Amount of loan currency LP wishes to deposit |
| _deadline | uint256 | Last timestamp after which function will revert |
| _referralCode | uint16 | Will possibly be used later to reward referrals |

### baseAggrBucketSize

```solidity
function baseAggrBucketSize() external view returns (uint256)
```

Getter which returns the base aggregation size




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### borrow

```solidity
function borrow(address _onBehalf, uint128 _sendAmount, uint128 _minLoanLimit, uint128 _maxRepayLimit, uint256 _deadline, uint16 _referralCode) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _onBehalf | address | undefined |
| _sendAmount | uint128 | undefined |
| _minLoanLimit | uint128 | undefined |
| _maxRepayLimit | uint128 | undefined |
| _deadline | uint256 | undefined |
| _referralCode | uint16 | undefined |

### claim

```solidity
function claim(address _onBehalfOf, uint256[] _loanIdxs, bool _isReinvested, uint256 _deadline) external nonpayable
```

Function which handles individual claiming by LPs

*This function is more expensive, but needs to be used when LP changes position size in the middle of smallest aggregation block or if LP wants to claim some of the loans before the expiry time of the last loan in the aggregation block. _loanIdxs must be increasing array. If address on behalf of is not sender, then sender must have permission to claim. As well if reinvestment ootion is chosen, sender must have permission to add liquidity*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _onBehalfOf | address | LP address which is owner or has approved sender to claim on their behalf (and possibly reinvest) |
| _loanIdxs | uint256[] | Loan indices on which LP wants to claim |
| _isReinvested | bool | Flag for if LP wants claimed loanCcy to be re-invested |
| _deadline | uint256 | Deadline if reinvestment occurs. (If no reinvestment, this is ignored) |

### claimFromAggregated

```solidity
function claimFromAggregated(address _onBehalfOf, uint256[] _aggIdxs, bool _isReinvested, uint256 _deadline) external nonpayable
```

Function which handles aggregate claiming by LPs

*This function is much more efficient, but can only be used when LPs position size did not change over the entire interval LP would like to claim over. _aggIdxs must be increasing array. the first index of _aggIdxs is the from loan index to start aggregation, the rest of the indices are the end loan indexes of the intervals he wants to claim. If address on behalf of is not sender, then sender must have permission to claim. As well if reinvestment option is chosen, sender must have permission to add liquidity*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _onBehalfOf | address | LP address which is owner or has approved sender to claim on their behalf (and possibly reinvest) |
| _aggIdxs | uint256[] | From index and end indices of the aggregation that LP wants to claim |
| _isReinvested | bool | Flag for if LP wants claimed loanCcy to be re-invested |
| _deadline | uint256 | Deadline if reinvestment occurs. (If no reinvestment, this is ignored) |

### collCcyToken

```solidity
function collCcyToken() external view returns (address)
```

Getter which returns the pool&#39;s collateral currency




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### getClaimsFromAggregated

```solidity
function getClaimsFromAggregated(uint256 _fromLoanIdx, uint256 _toLoanIdx, uint256 _shares) external view returns (uint256 repayments, uint256 collateral)
```

Function which returns claims for a given aggregated from and to index and amount of sharesOverTime

*This function is called internally, but also can be used by other protocols so has some checks which are unnecessary if it was solely an internal function*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _fromLoanIdx | uint256 | Loan index on which he wants to start aggregate claim (must be mod 0 wrt 100) |
| _toLoanIdx | uint256 | End loan index of the aggregation |
| _shares | uint256 | Amount of sharesOverTime which the LP owned over this given aggregation period |

#### Returns

| Name | Type | Description |
|---|---|---|
| repayments | uint256 | undefined |
| collateral | uint256 | undefined |

### getLpInfo

```solidity
function getLpInfo(address _lpAddr) external view returns (uint32 fromLoanIdx, uint32 earliestRemove, uint32 currSharePtr, uint256[] sharesOverTime, uint256[] loanIdxsWhereSharesChanged)
```

Function which gets all LP info

*fromLoanIdx = 0 can be utilized for checking if someone had been an LP in the pool*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _lpAddr | address | Address for which LP info is being retrieved |

#### Returns

| Name | Type | Description |
|---|---|---|
| fromLoanIdx | uint32 | Lower bound loan idx (incl.) from which LP is entitled to claim |
| earliestRemove | uint32 | Earliest timestamp from which LP is allowed to remove liquidity |
| currSharePtr | uint32 | Current pointer for the shares over time array |
| sharesOverTime | uint256[] | Array with elements representing number of LP shares for their past and current positions |
| loanIdxsWhereSharesChanged | uint256[] | Array with elements representing upper loan idx bounds (excl.), where LP can claim |

### getRateParams

```solidity
function getRateParams() external view returns (uint256 _liquidityBnd1, uint256 _liquidityBnd2, uint256 _r1, uint256 _r2)
```

Function which returns rate parameters need for interest rate calculation

*This function can be used to get parameters needed for interest rate calculations*


#### Returns

| Name | Type | Description |
|---|---|---|
| _liquidityBnd1 | uint256 | undefined |
| _liquidityBnd2 | uint256 | undefined |
| _r1 | uint256 | undefined |
| _r2 | uint256 | undefined |

### getTotalLiquidity

```solidity
function getTotalLiquidity() external view returns (uint256)
```

Getter which returns the pool&#39;s total liquidity available for new loans




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | The total liquidity of the pool that is available for new loans |

### isApproved

```solidity
function isApproved(address, address, enum IBasePool.ApprovalTypes) external view returns (bool)
```

Function returns if owner or beneficiary has approved a sender address for a given type



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | address | undefined |
| _2 | enum IBasePool.ApprovalTypes | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### loanCcyToken

```solidity
function loanCcyToken() external view returns (address)
```

Getter which returns the pool&#39;s loan currency




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### loanIdx

```solidity
function loanIdx() external view returns (uint256)
```

Getter which returns the pool&#39;s current loan idx counter; the next incoming loan will receive this loan idx;




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### loanIdxToBorrower

```solidity
function loanIdxToBorrower(uint256) external view returns (address)
```

Getter which returns the borrower for a given loan idx



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### loanIdxToLoanInfo

```solidity
function loanIdxToLoanInfo(uint256) external view returns (uint128 repayment, uint128 collateral, uint128 totalLpShares, uint32 expiry, bool repaid)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| repayment | uint128 | undefined |
| collateral | uint128 | undefined |
| totalLpShares | uint128 | undefined |
| expiry | uint32 | undefined |
| repaid | bool | undefined |

### loanTerms

```solidity
function loanTerms(uint128 _inAmountAfterFees) external view returns (uint128 loanAmount, uint128 repaymentAmount, uint128 pledgeAmount, uint128 _protocolFee, uint256 _totalLiquidity)
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
| _protocolFee | uint128 | Amount of collateral currency to be transferred to treasury |
| _totalLiquidity | uint256 | The total liquidity of the pool (pre-borrow) that is available for new loans  |

### maxLoanPerColl

```solidity
function maxLoanPerColl() external view returns (uint256)
```

Getter which returns the pool&#39;s maximum loan amount per pledged collateral unit




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### minLoan

```solidity
function minLoan() external view returns (uint256)
```

Getter which returns the pool&#39;s minimum loan size




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### overrideSharePointer

```solidity
function overrideSharePointer(uint256 _newSharePointer) external nonpayable
```

Function will update the share pointer for the LP

*This function will allow an LP to skip his pointer ahead but caution should be used since once an LP has updated their from index they lose all rights to any outstanding claims before that from index*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _newSharePointer | uint256 | New location of the LP&#39;s current share pointer |

### protocolFee

```solidity
function protocolFee() external view returns (uint128)
```

Getter which returns the pool&#39;s protocol fee




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined |

### removeLiquidity

```solidity
function removeLiquidity(address _onBehalfOf, uint256 numShares) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _onBehalfOf | address | undefined |
| numShares | uint256 | undefined |

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
function rollOver(uint256 _loanIdx, uint128 _minLoanLimit, uint128 _maxRepayLimit, uint256 _deadline, uint128 _sendAmount) external nonpayable
```

Function which allows repayment of a loan and roll over into new loan

*The old loan gets repaid and then a new loan with a new loan Id is taken out. No actual transfers are made other than the interest*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _loanIdx | uint256 | Index of the loan to be repaid |
| _minLoanLimit | uint128 | Minimum amount of loan currency acceptable from new loan. |
| _maxRepayLimit | uint128 | Maximum allowable loan currency amount borrower for new loan. |
| _deadline | uint256 | Timestamp after which transaction will be void |
| _sendAmount | uint128 | Amount of loan currency borrower needs to send to pay difference in repayment and loan amount |

### setApprovals

```solidity
function setApprovals(address _approvee, bool[5] _approvals) external nonpayable
```

Function which sets approval for another to perform a certain function on sender&#39;s behalf



#### Parameters

| Name | Type | Description |
|---|---|---|
| _approvee | address | This address is being given approval for the action(s) by the current sender |
| _approvals | bool[5] | Array of flags to set which actions are approved or not approved |

### totalLpShares

```solidity
function totalLpShares() external view returns (uint128)
```

Getter which returns the pool&#39;s total outstanding LP shares




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined |



## Events

### AddLiquidity

```solidity
event AddLiquidity(uint256 amount, uint256 newLpShares, uint256 totalLiquidity, uint256 totalLpShares, uint256 earliestRemove, uint16 referralCode)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount  | uint256 | undefined |
| newLpShares  | uint256 | undefined |
| totalLiquidity  | uint256 | undefined |
| totalLpShares  | uint256 | undefined |
| earliestRemove  | uint256 | undefined |
| referralCode  | uint16 | undefined |

### ApprovalUpdate

```solidity
event ApprovalUpdate(address ownerOrBeneficiary, address sender, uint256 index)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| ownerOrBeneficiary  | address | undefined |
| sender  | address | undefined |
| index  | uint256 | undefined |

### Borrow

```solidity
event Borrow(uint256 loanIdx, uint256 collateral, uint256 loanAmount, uint256 repaymentAmount, uint256 expiry, uint256 protocolFee, uint16 referralCode)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| loanIdx  | uint256 | undefined |
| collateral  | uint256 | undefined |
| loanAmount  | uint256 | undefined |
| repaymentAmount  | uint256 | undefined |
| expiry  | uint256 | undefined |
| protocolFee  | uint256 | undefined |
| referralCode  | uint16 | undefined |

### Claim

```solidity
event Claim(uint256[] loanIdxs, uint256 repayments, uint256 collateral)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| loanIdxs  | uint256[] | undefined |
| repayments  | uint256 | undefined |
| collateral  | uint256 | undefined |

### ClaimFromAggregated

```solidity
event ClaimFromAggregated(uint256 fromLoanIdx, uint256 toLoanIdx, uint256 repayments, uint256 collateral)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| fromLoanIdx  | uint256 | undefined |
| toLoanIdx  | uint256 | undefined |
| repayments  | uint256 | undefined |
| collateral  | uint256 | undefined |

### FeeUpdate

```solidity
event FeeUpdate(uint128 oldFee, uint128 newFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldFee  | uint128 | undefined |
| newFee  | uint128 | undefined |

### NewSubPool

```solidity
event NewSubPool(address collCcyToken, address loanCcyToken, uint256 loanTenor, uint256 maxLoanPerColl, uint256 r1, uint256 r2, uint256 liquidityBnd1, uint256 liquidityBnd2, uint256 minLoan)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| collCcyToken  | address | undefined |
| loanCcyToken  | address | undefined |
| loanTenor  | uint256 | undefined |
| maxLoanPerColl  | uint256 | undefined |
| r1  | uint256 | undefined |
| r2  | uint256 | undefined |
| liquidityBnd1  | uint256 | undefined |
| liquidityBnd2  | uint256 | undefined |
| minLoan  | uint256 | undefined |

### Reinvest

```solidity
event Reinvest(uint256 repayments, uint256 newLpShares, uint256 earliestRemove)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| repayments  | uint256 | undefined |
| newLpShares  | uint256 | undefined |
| earliestRemove  | uint256 | undefined |

### RemoveLiquidity

```solidity
event RemoveLiquidity(uint256 amount, uint256 removedLpShares, uint256 totalLiquidity, uint256 totalLpShares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount  | uint256 | undefined |
| removedLpShares  | uint256 | undefined |
| totalLiquidity  | uint256 | undefined |
| totalLpShares  | uint256 | undefined |

### Repay

```solidity
event Repay(uint256 loanIdx)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| loanIdx  | uint256 | undefined |

### Roll

```solidity
event Roll(uint256 oldLoanIdx, uint256 newLoanIdx)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldLoanIdx  | uint256 | undefined |
| newLoanIdx  | uint256 | undefined |



## Errors

### AlreadyRepaid

```solidity
error AlreadyRepaid()
```






### BeforeEarliestRemove

```solidity
error BeforeEarliestRemove()
```






### CannotBeZeroAddress

```solidity
error CannotBeZeroAddress()
```






### CannotClaimWithUnsettledLoan

```solidity
error CannotClaimWithUnsettledLoan()
```






### CannotRepayAfterExpiry

```solidity
error CannotRepayAfterExpiry()
```






### CannotRepayInSameBlock

```solidity
error CannotRepayInSameBlock()
```






### CollAndLoanCcyCannotBeEqual

```solidity
error CollAndLoanCcyCannotBeEqual()
```






### ErroneousLoanTerms

```solidity
error ErroneousLoanTerms()
```






### InsufficientLiquidity

```solidity
error InsufficientLiquidity()
```






### InvalidAddAmount

```solidity
error InvalidAddAmount()
```






### InvalidApprovalAddress

```solidity
error InvalidApprovalAddress()
```






### InvalidBaseAggrSize

```solidity
error InvalidBaseAggrSize()
```






### InvalidLiquidityBnds

```solidity
error InvalidLiquidityBnds()
```






### InvalidLoanIdx

```solidity
error InvalidLoanIdx()
```






### InvalidLoanTenor

```solidity
error InvalidLoanTenor()
```






### InvalidMaxLoanPerColl

```solidity
error InvalidMaxLoanPerColl()
```






### InvalidMinLoan

```solidity
error InvalidMinLoan()
```






### InvalidNewSharePointer

```solidity
error InvalidNewSharePointer()
```






### InvalidRateParams

```solidity
error InvalidRateParams()
```






### InvalidRecipient

```solidity
error InvalidRecipient()
```






### InvalidRemove

```solidity
error InvalidRemove()
```






### InvalidRollOver

```solidity
error InvalidRollOver()
```






### InvalidSendAmount

```solidity
error InvalidSendAmount()
```






### InvalidSubAggregation

```solidity
error InvalidSubAggregation()
```






### LoanBelowLimit

```solidity
error LoanBelowLimit()
```






### LoanIdxsWithChangingShares

```solidity
error LoanIdxsWithChangingShares()
```






### MustBeLp

```solidity
error MustBeLp()
```






### NonAscendingLoanIdxs

```solidity
error NonAscendingLoanIdxs()
```






### NothingToClaim

```solidity
error NothingToClaim()
```






### PastDeadline

```solidity
error PastDeadline()
```






### PotentiallyZeroRoundedFutureClaims

```solidity
error PotentiallyZeroRoundedFutureClaims()
```






### ProtocolFeeTooHigh

```solidity
error ProtocolFeeTooHigh()
```






### RepaymentAboveLimit

```solidity
error RepaymentAboveLimit()
```






### TooSmallLoan

```solidity
error TooSmallLoan()
```






### UnapprovedSender

```solidity
error UnapprovedSender()
```






### UnentitledFromLoanIdx

```solidity
error UnentitledFromLoanIdx()
```






### ZeroShareClaim

```solidity
error ZeroShareClaim()
```






