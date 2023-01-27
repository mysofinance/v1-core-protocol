async function main() {
    /*
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying from address ${deployer.address}`)
    */
    // Create a Frame connection
    const ethProvider = require('eth-provider')
    const frame = ethProvider('frame')

    // pool parameters
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
    console.log("poolConfig", poolConfig)

    // get contract
    const Pool = await ethers.getContractFactory("TestPoolWethUsdc_v_1_1")

    // deploy pool
    /*
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
    await pool.deployed()

    console.log(`Deployed to address ${pool.address}`)
    */

    const deployTx = await Pool.getDeployTransaction(
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

    // Set `deployTx.from` to current Frame account
    deployTx.from = (await frame.request({ method: 'eth_requestAccounts' }))[0]
    
    // Sign and send the transaction using Frame
    await frame.request({ method: 'eth_sendTransaction', params: [deployTx] })

  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });