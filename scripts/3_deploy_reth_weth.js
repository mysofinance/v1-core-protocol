async function main() {
    // Create a Frame connection
    const ethProvider = require('eth-provider')
    const frame = ethProvider('frame')

    // pool config
    const BASE = ethers.BigNumber.from("10").pow("18")
    const ONE_YEAR = 60*60*24*365
    const poolTenor = 60*60*24*90
    const poolDeployConfig = {
      tenor: poolTenor,
      maxLoanPerColl: BASE.mul(1020).div(1000),
      r1: BASE.mul(4).div(100).mul(poolTenor).div(ONE_YEAR),
      r2: BASE.mul(2).div(100).mul(poolTenor).div(ONE_YEAR),
      liquidityBnd1: BASE,
      liquidityBnd2: BASE.mul(50),
      minLoan: BASE.div(10),
      baseAggrBucketSize: 100,
      creatorFee: BASE.div(100).mul(poolTenor).div(ONE_YEAR)
    }

    console.log(`pool config...`)
    console.log(`tenor: ${poolDeployConfig.tenor}`)
    console.log(`maxLoanPerColl: ${poolDeployConfig.maxLoanPerColl}`)
    console.log(`r1: ${poolDeployConfig.r1}`)
    console.log(`r2: ${poolDeployConfig.r2}`)
    console.log(`liquidityBnd1: ${poolDeployConfig.liquidityBnd1}`)
    console.log(`liquidityBnd2: ${poolDeployConfig.liquidityBnd2}`)
    console.log(`minLoan: ${poolDeployConfig.minLoan}`)
    console.log(`baseAggrBucketSize: ${poolDeployConfig.baseAggrBucketSize}`)
    console.log(`creatorFee: ${poolDeployConfig.creatorFee}`)

    // get contract
    const PoolRethWeth = await ethers.getContractFactory("PoolRethWeth")
    const deployTx = await PoolRethWeth.getDeployTransaction(
      poolDeployConfig.tenor,
      poolDeployConfig.maxLoanPerColl,
      poolDeployConfig.r1,
      poolDeployConfig.r2,
      poolDeployConfig.liquidityBnd1,
      poolDeployConfig.liquidityBnd2,
      poolDeployConfig.minLoan,
      poolDeployConfig.baseAggrBucketSize,
      poolDeployConfig.creatorFee,
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
    })