const ethers = require("ethers");
const { Wallet } = require("zksync-web3");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const hre = require("hardhat");

// An example of a deploy script that will deploy and call a simple contract.
async function main() {
  const { PRIVATE_KEY } = process.env;

  // Initialize the wallet.
  const wallet = new Wallet(PRIVATE_KEY);

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact("TestPoolWethUsdc_v_1_1");

  // pool parameters
  const BASE = ethers.BigNumber.from("10").pow("18");
  const ONE_USDC = ethers.BigNumber.from("10").pow("6");
  const ONE_DAY = ethers.BigNumber.from(60 * 60 * 24);
  const tenor = ONE_DAY.mul(30);
  const poolConfig = {
    tenor: 86400,
    maxLoanPerColl: 1200000000,
    r1: 547945205479452,
    r2: 273972602739726,
    liquidityBnd1: 1000000000,
    liquidityBnd2: 1000000000000,
    minLoan: 100000000,
    baseAggrBucketSize: 10,
    creatorFee: 1000000000000000,
  };
  console.log("poolConfig", poolConfig);

  const contract = await deployer.deploy(artifact, [
    poolConfig.tenor,
    poolConfig.maxLoanPerColl,
    poolConfig.r1,
    poolConfig.r2,
    poolConfig.liquidityBnd1,
    poolConfig.liquidityBnd2,
    poolConfig.minLoan,
    poolConfig.baseAggrBucketSize,
    poolConfig.creatorFee,
  ]);

  // Show the contract info.
  console.log(`${artifact.contractName} was deployed to ${contract.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Pool address - 0x69c46d1Ea267643e39a449c75186B7Da107bc160
