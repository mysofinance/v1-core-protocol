const ethers = require("ethers");
const { utils, Wallet } = require("zksync-web3");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const hre = require("hardhat");

// An example of a deploy script that will deploy and call a simple contract.
async function main() {
  const { PRIVATE_KEY } = process.env;

  console.log(`Running deploy script for the weth contract`);

  // Initialize the wallet.
  const wallet = new Wallet(`0x${PRIVATE_KEY}`);

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact("FiatTokenV2");

  const contract = await deployer.deploy(artifact);

  // Show the contract info.
  console.log(`${artifact.contractName} was deployed to ${contract.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// USDC was deployed to 0x496402aE6104357B55B8e555f6cb143b2AE429F9
