async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from address ${deployer.address}`);

  // pool parameters
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
  // get contract
  const Pool = await ethers.getContractFactory("TestPoolRethWeth_v_1_1");

  // deploy pool
  const pool = await Pool.deploy(
    poolConfig.tenor,
    poolConfig.maxLoanPerColl,
    poolConfig.r1,
    poolConfig.r2,
    poolConfig.liquidityBnd1,
    poolConfig.liquidityBnd2,
    poolConfig.minLoan,
    poolConfig.baseAggrBucketSize,
    poolConfig.creatorFee
  );
  await pool.deployed();

  console.log(`Deployed to address ${pool.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
