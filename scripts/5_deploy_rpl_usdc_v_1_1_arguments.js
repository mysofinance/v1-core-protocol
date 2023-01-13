// verfied using hardhat verify:
// npx hardhat verify --constructor-args "scripts/5_deploy_reth_weth_v_1_1_arguments.js" ... --contract "contracts/pools/rpl-usdc/PoolRplUsdc_v_1_1.sol:PoolRplUsdc_v_1_1" --network mainnet

const BASE = ethers.BigNumber.from("10").pow("18")
const ONE_USDC = ethers.BigNumber.from("1000000")
const ONE_DAY = ethers.BigNumber.from("86400");
const tenor = ONE_DAY.mul(180)
const poolConfig = {
  tenor: tenor,
  maxLoanPerColl: ONE_USDC.mul(56).div(10),
  r1: BASE.mul(20).div(100).mul(tenor).div(ONE_YEAR),
  r2: BASE.mul(17).div(100).mul(tenor).div(ONE_YEAR),
  liquidityBnd1: ONE_USDC.mul(1000),
  liquidityBnd2: ONE_USDC.mul(10000),
  minLoan: ONE_USDC.mul(100),
  baseAggrBucketSize: 100,
  creatorFee: BASE.mul(10).div(10000)
}

module.exports = [
  poolConfig.tenor,
  poolConfig.maxLoanPerColl,
  poolConfig.r1,
  poolConfig.r2,
  poolConfig.liquidityBnd1,
  poolConfig.liquidityBnd2,
  poolConfig.minLoan,
  poolConfig.baseAggrBucketSize,
  poolConfig.creatorFee
  ];