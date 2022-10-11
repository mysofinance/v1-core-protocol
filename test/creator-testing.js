const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Creator Testing", function () {

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
  const _fee = MONE.mul(30).div(10000);
  const minLiquidity = ONE_USDC.mul(10);
  const USDC_MASTER_MINTER = "0xe982615d461dd5cd06575bbea87624fda4e3de17";
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, newCreator, ...addrs] = await ethers.getSigners();

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
    await USDC.connect(masterMinter).mint(lp1.address, MAX_UINT128);
    await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128);
    await USDC.connect(masterMinter).mint(lp2.address, MAX_UINT128);
    await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128);
    await USDC.connect(masterMinter).mint(lp3.address, MAX_UINT128);
    await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128);
    await USDC.connect(masterMinter).mint(lp4.address, MAX_UINT128);
    await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128);
    await USDC.connect(masterMinter).mint(lp5.address, MAX_UINT128);
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
    poolWethUsdc = await PoolWethUsdc.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, _fee);
    await poolWethUsdc.deployed();

    // approve USDC and WETH balances
    USDC.connect(lp1).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp2).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp3).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp4).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp5).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(borrower).approve(poolWethUsdc.address, MAX_UINT128);
    WETH.connect(borrower).approve(poolWethUsdc.address, MAX_UINT128);
  });

  it("Should handle creator fee correctly", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(10000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(100000), timestamp+60, 0);

    // 1st borrow transaction
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    currBlock = await ethers.provider.getBlockNumber();
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60, 0);

    // check fee was transferred correctly
    bal = await WETH.balanceOf(deployer.address);
    expect(bal).to.be.equal(ONE_ETH.mul(_fee).div(MONE));

    // propose new creator from unauthorized
    await poolWethUsdc.connect(borrower).proposeNewCreator(newCreator.address);
    await poolWethUsdc.connect(borrower).claimCreator();

    // 2nd borrow transaction
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    currBlock = await ethers.provider.getBlockNumber();
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60, 0);

    // check fee was transferred to creator as before
    bal = await WETH.balanceOf(deployer.address);
    expect(bal).to.be.equal(ONE_ETH.mul(_fee).div(MONE).mul(2));

    // propose new creator from authorized
    await poolWethUsdc.connect(deployer).proposeNewCreator(newCreator.address);
    await poolWethUsdc.connect(newCreator).claimCreator();

    // 3rd borrow transaction
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    currBlock = await ethers.provider.getBlockNumber();
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60, 0);

    // check fee was transferred to new creator
    bal = await WETH.balanceOf(deployer.address);
    expect(bal).to.be.equal(ONE_ETH.mul(_fee).div(MONE).mul(2));
    bal = await WETH.balanceOf(newCreator.address);
    expect(bal).to.be.equal(ONE_ETH.mul(_fee).div(MONE));
  });

});
