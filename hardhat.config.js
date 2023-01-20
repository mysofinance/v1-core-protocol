require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");
require('@primitivefi/hardhat-dodoc');
require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers")
require("@nomiclabs/hardhat-etherscan")
require('hardhat-abi-exporter');
require("dotenv").config();

const { ALCHEMY_API_KEY_GOERLI, ALCHEMY_API_KEY_MAINNET, ETHERSCAN_API_KEY, TEST_DEPLOYER_PRIVATE_KEY, INFURA_API_KEY_MAINNET } = process.env

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.17",
  settings: {
    optimizer: {
      enabled: true,
      runs: 1000,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_MAINNET}`,
        blockNumber: 16382000
      }
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY_MAINNET}`,
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/-76GDj41dJcWIiIyZeu1bTYZXtDOIxrI`,
      accounts: [TEST_DEPLOYER_PRIVATE_KEY],
      chainId: 5
    }
  },
  mocha: {
    timeout: 100000000
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: [],
  },
  abiExporter: {
    path: './data/abi',
    runOnCompile: true,
    clear: true,
    flat: false,
    only: [],
    spacing: 2,
    format: "json",
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
};