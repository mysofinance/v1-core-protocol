const BASE = ethers.BigNumber.from("10").pow("18");
const ONE_YEAR = 60*60*24*365;
const poolTenor = 60*60*24*90;
const poolDeployConfig = {
  tenor: poolTenor,
  maxLoanPerColl: BASE.mul(1010).div(1000),
  r1: BASE.mul(4).div(100).mul(poolTenor).div(ONE_YEAR),
  r2: BASE.mul(2).div(100).mul(poolTenor).div(ONE_YEAR),
  liquidityBnd1: BASE,
  liquidityBnd2: BASE.mul(50),
  minLoan: BASE.div(10),
  baseAggrBucketSize: 100,
  creatorFee: BASE.div(100).mul(poolTenor).div(ONE_YEAR)
}

module.exports = [
    poolDeployConfig.tenor,
    poolDeployConfig.maxLoanPerColl,
    poolDeployConfig.r1,
    poolDeployConfig.r2,
    poolDeployConfig.liquidityBnd1,
    poolDeployConfig.liquidityBnd2,
    poolDeployConfig.minLoan,
    poolDeployConfig.baseAggrBucketSize,
    poolDeployConfig.creatorFee
  ];