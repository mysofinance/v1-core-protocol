const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Constructor Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;
  const _loanCcyToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; 
  const _collCcyToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _liquidityBnd1 = ONE_USDC.mul(100000);
  const _liquidityBnd2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.mul(100);

  it("Should revert with invalid deployment parameters in constructor", async function () {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();

    // deploy pool
    ConstructorTest = await ethers.getContractFactory("ConstructorTest");
    ConstructorTest = await ConstructorTest.connect(deployer);
    constructorTest = await ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0);
    await constructorTest.deployed();

    // test constructor reverts
    await expect(ConstructorTest.deploy(ZERO_ADDRESS, _collCcyToken, 800, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidZeroAddress");
    await expect(ConstructorTest.deploy(_loanCcyToken, ZERO_ADDRESS, 800, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidZeroAddress");
    await expect(ConstructorTest.deploy(_loanCcyToken, _loanCcyToken, 800, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "IdenticalLoanAndCollCcy");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, 800, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidLoanTenor");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, 0, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidMaxLoanPerColl");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, 0, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidRateParams");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, 0, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidMinLoan");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 50, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidBaseAggrSize");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 101, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidBaseAggrSize");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, ONE_ETH)).to.be.revertedWithCustomError(constructorTest, "InvalidFee");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r2, _r1, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidRateParams");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, 0, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidRateParams");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd2, _liquidityBnd1, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidLiquidityBnds");
    await expect(ConstructorTest.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, 0, _liquidityBnd1, _minLoan, 100, 0)).to.be.revertedWithCustomError(constructorTest, "InvalidLiquidityBnds");
  })
})