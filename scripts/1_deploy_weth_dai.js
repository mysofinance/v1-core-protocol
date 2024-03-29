async function main() {
  //get env variables
  const { DEPLOYER_PRIVATE_KEY } = process.env;

  //get address from pk
  let provider = ethers.getDefaultProvider();
  //const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  const [deployer] = await ethers.getSigners();

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_DAI = MONE;
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_DAI.mul(500);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _liquidityBnd1 = ONE_DAI.mul(100000);
  const _liquidityBnd2 = ONE_DAI.mul(1000000);
  const _minLoan = ONE_DAI.mul(300);
  

  console.log("STARTING DEPLOYMENT SCRIPT")
  console.log("Deployer address is: ", deployer.address);

  //deploy paxg-weth contract
  const PoolContract = await ethers.getContractFactory("PoolWethDai");
  const poolContract = await PoolContract.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2,
      _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0
  );
  await poolContract.deployed();

  //print resulting address
  console.log("Pool Contract address: ", poolContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });