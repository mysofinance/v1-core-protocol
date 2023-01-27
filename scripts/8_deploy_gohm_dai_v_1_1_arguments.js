// verfied using hardhat verify:
// npx hardhat verify --constructor-args "scripts/8_deploy_gohm_dai_v_1_1_arguments.js" 0xEA9134ad24795549580C7c542134a670D0D19433 --contract "contracts/pools/gohm-dai/PoolGohmDai_v_1_1.sol:PoolGohmDai_v_1_1" --network mainnet

const BASE = ethers.BigNumber.from("10").pow("18")
const ONE_DAI = ethers.BigNumber.from("10").pow("18")
const ONE_DAY = ethers.BigNumber.from(60*60*24)
const ONE_YEAR = ethers.BigNumber.from(60*60*24*365)
const tenor = ONE_DAY.mul(40)
const poolConfig = {
  tenor: tenor,
  maxLoanPerColl: ONE_DAI.mul(1280),
  r1: BASE.mul(9).div(100).mul(tenor).div(ONE_YEAR),
  r2: BASE.mul(8).div(100).mul(tenor).div(ONE_YEAR),
  liquidityBnd1: ONE_DAI,
  liquidityBnd2: ONE_DAI.mul(100),
  minLoan: ONE_DAI.mul(100),
  baseAggrBucketSize: 10,
  creatorFee: BASE.mul(2).div(1000)
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