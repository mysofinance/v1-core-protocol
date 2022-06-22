const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Greeter", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;

  beforeEach( async () => {
    [deployer, lp, borrower, ...addrs] = await ethers.getSigners();

    Pool = await ethers.getContractFactory("OrderBookLikeV1Pool");
    Pool = await Pool.connect(deployer);

    _maxLoanPerColl = ONE_USDC.mul(500);
    _initMinLpAmount = ONE_USDC.mul(1000);
    _apr1 = MONE.mul(2).div(10)
    _apr2 = MONE.mul(2).div(100)
    _tvl1 = ONE_USDC.mul(100000);
    _tvl2 = ONE_USDC.mul(1000000);
    pool = await Pool.deploy(_maxLoanPerColl, _initMinLpAmount, _apr1, _apr2, _tvl1, _tvl2);
    await pool.deployed();
  });

  it("Should have correct initial values", async function () {
    minLpAmount = await pool.minLpAmount();
    expect(minLpAmount).to.be.equal(_initMinLpAmount);

    totalLiquidity = await pool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(0);

    loanIdx = await pool.loanIdx();
    expect(loanIdx).to.be.equal(1);
  });

  it("Should fail on loan terms without LPs", async function () {
    await expect(pool.loanTerms(ONE_ETH)).to.be.reverted;
  });

  it("Should allow LPs to add liquidity", async function () {
    await pool.connect(lp).addLiquidity(0, 1);
    totalLiquidity = await pool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(_initMinLpAmount);
  });

  it("Should not allow LPs to add to same slot", async function () {
    await pool.connect(lp).addLiquidity(0, 1);
    await expect(pool.loanTerms(pool.connect(lp).addLiquidity(0, 1))).to.be.reverted;
  });

  it("Should not allow LPs to add to slot higher than 255", async function () {
    await expect(pool.loanTerms(pool.connect(lp).addLiquidity(0, 256))).to.be.reverted;
  });

  it("Should not allow LPs to add with 0 weight", async function () {
    await expect(pool.loanTerms(pool.connect(lp).addLiquidity(0, 0))).to.be.reverted;
  });
});
