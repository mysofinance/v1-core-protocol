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
┃ ┣ weth-dai/
┃ ┃ ┗ PoolWethDai.sol
┃ ┗ weth-usdc/
┃   ┗ PoolWethUsdc.sol
┣ test/
┃ ┣ IUSDC.sol
┃ ┗ IWETH.sol
┗ BasePool.sol
```

## Libraries & Dependencies

The following OpenZeppelin 4.7.0 libraries are used:
* IERC20Metadata
* SafeERC20

For the pools we integrate with the following tokens:
* `PAXG`: `0x45804880De22913dAFE09f4980848ECE6EcbAf78`
* `DAI`: `0x6B175474E89094C44Da98b954EedeAC495271d0F`
* `WETH`: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
* `USDC`: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
* `cUSDC`: `0x39AA39c021dfbaE8faC545936693aC917d5E7563`

## Documentation
Documentation can be found in [docs](/docs) and on [Gitbook](https://myso-finance.gitbook.io/docs/).

## Test Files
```
test/
┣ constructor-testing.js
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
 contracts\                  |      100 |    95.07 |      100 |      100 |                |
  BasePool.sol               |      100 |    95.07 |      100 |      100 |                |
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
 contracts\test\             |    56.86 |        0 |    72.73 |    56.86 |                |
  AddLiquidityAndBorrow.sol  |       60 |        0 |      100 |       60 |... 59,60,62,63 |
  Borrow.sol                 |    58.33 |        0 |      100 |    58.33 | 45,48,51,52,53 |
  CTokenInterface.sol        |      100 |      100 |      100 |      100 |                |
  ConstructorTest.sol        |        0 |      100 |       25 |        0 |       40,46,52 |
  IUSDC.sol                  |      100 |      100 |      100 |      100 |                |
  IWETH.sol                  |      100 |      100 |      100 |      100 |                |
  PeripheralTest.sol         |     61.9 |      100 |      100 |     61.9 |... 3,96,99,100 |
-----------------------------|----------|----------|----------|----------|----------------|
All files                    |    94.07 |    91.22 |    94.92 |     94.5 |                |
-----------------------------|----------|----------|----------|----------|----------------|
```
