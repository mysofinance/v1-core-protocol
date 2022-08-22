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

For the `PAXG-USDC` pool we integrate with the PAXG token at `0x45804880De22913dAFE09f4980848ECE6EcbAf78` on Ethereum mainnet and make use of its `getFeeFor` function.

## Documentation
Documentation can be found in [docs](/docs) and on [Gitbook](https://myso-finance.gitbook.io/docs/).

## Test Files
```
test/
┣ constructor-test.js
┣ paxg-usdc-testing.js
┣ weth-dai-testing.js
┗ weth-usdc-testing.js
```

### Test Coverage

```
----------------------------|----------|----------|----------|----------|----------------|
File                        |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
----------------------------|----------|----------|----------|----------|----------------|
 contracts\                 |      100 |    96.48 |      100 |      100 |                |
  BasePool.sol              |      100 |    96.48 |      100 |      100 |                |
 contracts\interfaces\      |      100 |      100 |      100 |      100 |                |
  IBasePool.sol             |      100 |      100 |      100 |      100 |                |
  IPAXG.sol                 |      100 |      100 |      100 |      100 |                |
 contracts\pools\paxg-usdc\ |      100 |      100 |      100 |      100 |                |
  PoolPaxgUsdc.sol          |      100 |      100 |      100 |      100 |                |
 contracts\pools\weth-dai\  |      100 |      100 |      100 |      100 |                |
  PoolWethDai.sol           |      100 |      100 |      100 |      100 |                |
 contracts\pools\weth-usdc\ |      100 |      100 |      100 |      100 |                |
  PoolWethUsdc.sol          |      100 |      100 |      100 |      100 |                |
 contracts\test\            |    54.17 |      100 |    57.14 |    54.17 |                |
  ConstructorTest.sol       |        0 |      100 |       25 |        0 |       39,45,51 |
  IUSDC.sol                 |      100 |      100 |      100 |      100 |                |
  IWETH.sol                 |      100 |      100 |      100 |      100 |                |
  PeripheralTest.sol        |     61.9 |      100 |      100 |     61.9 |... 3,96,99,100 |
----------------------------|----------|----------|----------|----------|----------------|
All files                   |    96.59 |    96.48 |    93.48 |    96.87 |                |
----------------------------|----------|----------|----------|----------|----------------|
```
