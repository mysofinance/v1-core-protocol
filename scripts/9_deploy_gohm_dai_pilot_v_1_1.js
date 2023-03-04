async function main() {
    // Create a Frame connection
    const ethProvider = require('eth-provider')
    const frame = ethProvider('frame')

    // pool parameters
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
    console.log("poolConfig", poolConfig)

    // get contract
    const Pool = await ethers.getContractFactory("PoolGohmDai_v_1_1")

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