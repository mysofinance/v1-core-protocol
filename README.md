# MYSO

...

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
 contracts\                 |     99.3 |    92.86 |      100 |    98.41 |                |
  BasePool.sol              |     99.3 |    92.86 |      100 |    98.41 |... 03,889,1129 |
 contracts\interfaces\      |      100 |      100 |      100 |      100 |                |
  IBasePool.sol             |      100 |      100 |      100 |      100 |                |
  IPAXG.sol                 |      100 |      100 |      100 |      100 |                |
 contracts\pools\paxg-usdc\ |      100 |      100 |      100 |      100 |                |
  PoolPaxgUsdc.sol          |      100 |      100 |      100 |      100 |                |
 contracts\pools\weth-dai\  |      100 |      100 |      100 |      100 |                |
  PoolWethDai.sol           |      100 |      100 |      100 |      100 |                |
 contracts\pools\weth-usdc\ |      100 |      100 |      100 |      100 |                |
  PoolWethUsdc.sol          |      100 |      100 |      100 |      100 |                |
 contracts\test\            |        0 |      100 |       25 |        0 |                |
  ConstructorTest.sol       |        0 |      100 |       25 |        0 |       40,46,52 |
  IUSDC.sol                 |      100 |      100 |      100 |      100 |                |
  IWETH.sol                 |      100 |      100 |      100 |      100 |                |
----------------------------|----------|----------|----------|----------|----------------|
All files                   |    98.33 |    92.86 |    93.02 |    97.56 |                |
----------------------------|----------|----------|----------|----------|----------------|
```
