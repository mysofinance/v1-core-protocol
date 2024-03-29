# MYSO
This repository contains the smart contracts source code for the MYSO V1 protocol. The repository uses Hardhat as development environment for compilation, testing and deployment tasks.

## What is MYSO?
MYSO is a protocol for Zero-Liquidation Loans, where users can borrow or lend with one another on a peer-to-pool basis. A Zero-Liquidation Loan is a crypto-collateralized loan with a fixed tenor (e.g., 30 days) in which borrowers aren't exposed to liquidation risk. 

After pledging some collateral users can take out a loan and later reclaim their collateral by repaying prior to expiry. Liquidity Providers (LPs) bear the risk that during the loan lifetime the collateral can be worth less the loan amount, in which case borrowers might not repay and LPs will be left with the collateral. However, LPs earn a yield in exchange for bearing this risk (similar to a covered call strategy).

## Quick Start
```
npm i
npm hardhat test
```

## Contract Files
```
contracts/
┣ interfaces/
┃ ┣ IBasePool.sol
┃ ┗ IPAXG.sol
┣ pools/
┃ ┣ paxg-usdc/
┃ ┃ ┗ PoolPaxgUsdc.sol
┃ ┣ usdc-weth/
┃ ┃ ┗ PoolUsdcWeth.sol
┃ ┣ weth-cusdc/
┃ ┃ ┗ PoolWethCusdc.sol
┃ ┣ weth-dai/
┃ ┃ ┗ PoolWethDai.sol
┃ ┗ weth-usdc/
┃   ┗ PoolWethUsdc.sol
┣ test/
┃ ┣ AddLiquidityAndBorrow.sol
┃ ┣ Borrow.sol
┃ ┣ ConstructorTest.sol
┃ ┣ CTokenInterface.sol
┃ ┣ IUSDC.sol
┃ ┣ IWETH.sol
┃ ┗ PeripheralTest.sol
┗ BasePool.sol
```

## Libraries & Dependencies

The following OpenZeppelin 4.7.0 libraries are used:
* IERC20Metadata
* SafeERC20

## Documentation
Documentation can be found in [docs](/docs) and in the [whitepaper](https://figshare.com/articles/preprint/MYSO_v1_Core_A_Trust-Minimized_Protocol_for_Zero-Liquidation_Loans/21581328).

## Test Files
```
test/
┣ constructor-testing.js
┣ creator-testing.js
┣ paxg-usdc-testing.js
┣ peripheral-testing.js
┣ usdc-weth-testing.js
┣ weth-cusdc-testing.js
┣ weth-dai-testing.js
┗ weth-usdc-testing.js
```

### Test Coverage

```
-----------------------------|----------|----------|----------|----------|----------------|
File                         |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
-----------------------------|----------|----------|----------|----------|----------------|
 contracts\                  |      100 |    94.59 |      100 |      100 |                |
  BasePool.sol               |      100 |    94.59 |      100 |      100 |                |
 contracts\interfaces\       |      100 |      100 |      100 |      100 |                |
  IBasePool.sol              |      100 |      100 |      100 |      100 |                |
  IPAXG.sol                  |      100 |      100 |      100 |      100 |                |
 contracts\pools\paxg-usdc\  |      100 |      100 |      100 |      100 |                |
  PoolPaxgUsdc.sol           |      100 |      100 |      100 |      100 |                |
 contracts\pools\usdc-weth\  |      100 |      100 |      100 |      100 |                |
  PoolUsdcWeth.sol           |      100 |      100 |      100 |      100 |                |
 contracts\pools\weth-cusdc\ |      100 |      100 |      100 |      100 |                |
  PoolWethCusdc.sol          |      100 |      100 |      100 |      100 |                |
 contracts\pools\weth-dai\   |      100 |      100 |      100 |      100 |                |
  PoolWethDai.sol            |      100 |      100 |      100 |      100 |                |
 contracts\pools\weth-usdc\  |      100 |      100 |      100 |      100 |                |
  PoolWethUsdc.sol           |      100 |      100 |      100 |      100 |                |
 contracts\test\             |       58 |        0 |       80 |       58 |                |
  AddLiquidityAndBorrow.sol  |       60 |        0 |      100 |       60 |... 59,60,62,63 |
  Borrow.sol                 |    58.33 |        0 |      100 |    58.33 | 45,48,51,52,53 |
  CTokenInterface.sol        |      100 |      100 |      100 |      100 |                |
  ConstructorTest.sol        |        0 |      100 |    33.33 |        0 |          42,48 |
  IUSDC.sol                  |      100 |      100 |      100 |      100 |                |
  IWETH.sol                  |      100 |      100 |      100 |      100 |                |
  PeripheralTest.sol         |     61.9 |      100 |      100 |     61.9 |... 3,96,99,100 |
-----------------------------|----------|----------|----------|----------|----------------|
All files                    |     94.5 |    90.91 |    96.43 |    94.89 |                |
-----------------------------|----------|----------|----------|----------|----------------|
```
