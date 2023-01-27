// verfied using hardhat verify:
// npx hardhat verify --constructor-args "scripts/7_deploy_weth_usdc_v_1_1_arguments.js" 0x331c54fd17a54dcddb0215b9f02390cef7c7ee8f --contract "contracts/test/TestPoolWethUsdc_v_1_1.sol:TestPoolWethUsdc_v_1_1" --network goerli

const BASE = ethers.BigNumber.from("10").pow("18")
const ONE_USDC = ethers.BigNumber.from("10").pow("6")
const ONE_DAY = ethers.BigNumber.from(60*60*24)
const tenor = ONE_DAY.mul(30)
const poolConfig = {
  tenor: tenor,
  maxLoanPerColl: ONE_USDC.mul(1120),
  r1: BASE.mul(10).div(100),
  r2: BASE.mul(9).div(100),
  liquidityBnd1: ONE_USDC,
  liquidityBnd2: ONE_USDC.mul(100),
  minLoan: ONE_USDC.mul(100),
  baseAggrBucketSize: 10,
  creatorFee: BASE.mul(1).div(100)
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