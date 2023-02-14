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
  const artifact = await deployer.loadArtifact("PoolWethUsdc");

  // Estimate contract deployment fee
  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10);
  const _r2 = MONE.mul(2).div(100);
  const _liquidityBnd1 = ONE_USDC.mul(10000);
  const _liquidityBnd2 = ONE_USDC.mul(100000);
  const _minLoan = ONE_USDC.mul(100);

  const deploymentFee = await deployer.estimateDeployFee(artifact, [
    _loanTenor,
    _maxLoanPerColl,
    _r1,
    _r2,
    _liquidityBnd1,
    _liquidityBnd2,
    _minLoan,
    100,
    0,
  ]);

  // Deploy this contract. The returned object will be of a `Contract` type, similarly to ones in `ethers`.
  // `greeting` is an argument for contract constructor.
  const parsedFee = ethers.utils.formatEther(deploymentFee.toString());

  console.log(`The deployment is estimated to cost ${parsedFee} ETH`);

  const contract = await deployer.deploy(artifact, [
    _loanTenor,
    _maxLoanPerColl,
    _r1,
    _r2,
    _liquidityBnd1,
    _liquidityBnd2,
    _minLoan,
    100,
    0,
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

// Pool address - 0x6911F48A228969d4d54DE6b1739882e2f735f237
