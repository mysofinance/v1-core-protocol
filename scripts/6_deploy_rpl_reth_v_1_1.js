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
    console.log("poolConfig", poolConfig)

    // get contract
    const Pool = await ethers.getContractFactory("PoolRplReth_v_1_1")

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