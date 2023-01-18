// verfied using hardhat verify:
// npx hardhat verify --constructor-args "scripts/4_deploy_reth_weth_v_1_1_arguments.js" 0x458A0a35543B06e781737eAd3C5880f8972838B9 --contract "contracts/test/TestPoolRethWeth_v_1_1.sol:TestPoolRethWeth_v_1_1" --network goerli

const BASE = ethers.BigNumber.from("10").pow("18");
const ONE_YEAR = 60 * 60 * 24 * 365;
const tenor = 60 * 60;
const poolConfig = {
  tenor: tenor,
  maxLoanPerColl: BASE.mul(1020).div(1000),
  r1: BASE.mul(5).div(100).mul(tenor).div(ONE_YEAR),
  r2: BASE.mul(2).div(100).mul(tenor).div(ONE_YEAR),
  liquidityBnd1: BASE.mul(1),
  liquidityBnd2: BASE.mul(100),
  minLoan: BASE.div(10),
  baseAggrBucketSize: 100,
  creatorFee: 0,
};

module.exports = [
  poolConfig.tenor,
  poolConfig.maxLoanPerColl,
  poolConfig.r1,
  poolConfig.r2,
  poolConfig.liquidityBnd1,
  poolConfig.liquidityBnd2,
  poolConfig.minLoan,
  poolConfig.baseAggrBucketSize,
  poolConfig.creatorFee,
];
