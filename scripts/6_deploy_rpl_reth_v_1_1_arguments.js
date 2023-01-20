// verfied using hardhat verify:
// npx hardhat verify --constructor-args "scripts/6_deploy_rpl_reth_v_1_1_arguments.js" 0x15315dFc9E2Cc4F7F5456323Ab7010a1A74a337d --contract "contracts/pools/rpl-reth/PoolRplReth_v_1_1.sol:PoolRplReth_v_1_1" --network mainnet

const BASE = ethers.BigNumber.from("10").pow("18")
const ONE_RETH = BASE
const ONE_DAY = ethers.BigNumber.from(60*60*24)
const tenor = ONE_DAY.mul(90)
const poolConfig = {
  tenor: tenor,
  maxLoanPerColl: ethers.BigNumber.from("12000000000000000"),
  r1: BASE.mul(1).div(1000),
  r2: BASE.mul(1).div(10000),
  liquidityBnd1: ONE_RETH.div(10),
  liquidityBnd2: ONE_RETH,
  minLoan: ONE_RETH.div(10),
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