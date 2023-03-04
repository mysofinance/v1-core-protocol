// verfied using hardhat verify:
// npx hardhat verify --constructor-args "scripts/9_deploy_gohm_dai_pilot_v_1_1_arguments.js" 0xb339953fC028B9998775C00594a74Dd1488eE2c6 --contract "contracts/pools/gohm-dai/PoolGohmDai_v_1_1.sol:PoolGohmDai_v_1_1" --network mainnet

const BASE = ethers.BigNumber.from("10").pow("18")
const ONE_DAI = ethers.BigNumber.from("10").pow("18")
const ONE_DAY = ethers.BigNumber.from(60*60*24)
const ONE_YEAR = ethers.BigNumber.from(60*60*24*365)
const tenor = ONE_DAY.mul(90)
const poolConfig = {
  tenor: tenor,
  maxLoanPerColl: ONE_DAI.mul(2029),
  r1: BASE.mul(1).div(1000000).mul(tenor).div(ONE_YEAR),
  r2: BASE.mul(1).div(10000000).mul(tenor).div(ONE_YEAR),
  liquidityBnd1: ONE_DAI,
  liquidityBnd2: ONE_DAI.mul(100),
  minLoan: ONE_DAI.mul(500),
  baseAggrBucketSize: 10,
  creatorFee: BASE.mul(15).div(1000)
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