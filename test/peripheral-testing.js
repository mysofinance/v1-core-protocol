const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Peripheral testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;
  const _loanCcyToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const _collCcyToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _liquidityBnd1 = ONE_USDC.mul(100000);
  const _liquidityBnd2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.mul(100);
  const USDC_MASTER_MINTER = "0xe982615d461dd5cd06575bbea87624fda4e3de17";
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp, borrower, ...addrs] = await ethers.getSigners();

    // prepare USDC balances
    USDC = await ethers.getContractAt("IUSDC", _loanCcyToken);
    await ethers.provider.send("hardhat_setBalance", [
      USDC_MASTER_MINTER,
      "0x56BC75E2D63100000",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_MASTER_MINTER],
    });
    masterMinter = await ethers.getSigner(USDC_MASTER_MINTER);
    await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128);
    await USDC.connect(masterMinter).mint(lp.address, MAX_UINT128);
    await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128);
    await USDC.connect(masterMinter).mint(borrower.address, MAX_UINT128);

    // prepare WETH balance
    WETH = await ethers.getContractAt("IWETH", _collCcyToken);
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(borrower.address);
    await WETH.connect(borrower).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // deploy pool
    PoolWethUsdc = await ethers.getContractFactory("PoolWethUsdc");
    PoolWethUsdc = await PoolWethUsdc.connect(deployer);
    poolWethUsdc = await PoolWethUsdc.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0);
    await poolWethUsdc.deployed();

    // deploy peripheral contract
    Peripheral = await ethers.getContractFactory("PeripheralTest");
    Peripheral = await Peripheral.connect(deployer);
    peripheral = await Peripheral.deploy(poolWethUsdc.address, _loanCcyToken, _collCcyToken);
    await peripheral.deployed();

    // approve DAI and WETH balances
    await USDC.connect(lp).approve(poolWethUsdc.address, MAX_UINT128);
    await USDC.connect(borrower).approve(peripheral.address, MAX_UINT128);
    await WETH.connect(borrower).approve(peripheral.address, MAX_UINT128);
  });
  
  it("Should revert when trying to borrow and repay within same block", async function () {
    // have lp add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp).addLiquidity(lp.address, ONE_USDC.mul(100000), timestamp+60, 0);

    // have borrower use peripheral contract to atomically borrow and repay
    pledgeAmount = ONE_ETH;
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    await expect(peripheral.connect(borrower).borrowAndRepay(pledgeAmount, loanTerms.loanAmount, loanTerms.repaymentAmount, timestamp+3600, 1)).to.be.revertedWith("CannotRepayInSameBlock");
  });

  it("Should revert when trying to borrow and rollover within same block", async function () {
    // have lp add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp).addLiquidity(lp.address, ONE_USDC.mul(100000), timestamp+60, 0);

    // have borrower use peripheral contract to atomically borrow and repay
    pledgeAmount = ONE_ETH;
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    await expect(peripheral.connect(borrower).borrowAndRollOver(pledgeAmount, loanTerms.loanAmount, loanTerms.repaymentAmount, timestamp+3600, 1)).to.be.revertedWith("CannotRepayInSameBlock");
  });
});
