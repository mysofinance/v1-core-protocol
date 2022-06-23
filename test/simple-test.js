const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;

  beforeEach( async () => {
    [deployer, lp, borrower, ...addrs] = await ethers.getSigners();

    Pool = await ethers.getContractFactory("OrderBookLikeV1Pool");
    Pool = await Pool.connect(deployer);

    _maxLoanPerColl = ONE_USDC.mul(500);
    _initMinLpAmount = ONE_USDC.mul(1000);
    _r1 = MONE.mul(2).div(10)
    _r2 = MONE.mul(2).div(100)
    _tvl1 = ONE_USDC.mul(100000);
    _tvl2 = ONE_USDC.mul(1000000);
    pool = await Pool.deploy(_maxLoanPerColl, _initMinLpAmount, _r1, _r2, _tvl1, _tvl2);
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
    await pool.connect(lp).addLiquidity(0, ONE_USDC.mul(1111));
    await pool.connect(lp).addLiquidity(1, ONE_USDC.mul(10111));
    await pool.connect(lp).addLiquidity(255, ONE_USDC.mul(130111));
    totalLiquidity = await pool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(ONE_USDC.mul(141000));
  });

  it("Should not allow adding too small amounts", async function () {
    await expect(pool.loanTerms(pool.connect(lp).addLiquidity(0, 0))).to.be.reverted;
    await expect(pool.loanTerms(pool.connect(lp).addLiquidity(0, _initMinLpAmount.sub(1)))).to.be.reverted;
  });

  it("Should not allow LPs to add to same slot", async function () {
    await pool.connect(lp).addLiquidity(0, ONE_USDC.mul(1000));
    await expect(pool.loanTerms(pool.connect(lp).addLiquidity(0, ONE_USDC.mul(1000)))).to.be.reverted;
  });

  it("Should not allow LPs to add to slot higher than 255", async function () {
    await expect(pool.loanTerms(pool.connect(lp).addLiquidity(256, ONE_USDC.mul(1000)))).to.be.reverted;
  });

  it("Should allow borrowing", async function () {
    await pool.connect(lp).addLiquidity(0, ONE_USDC.mul(1000));
    await pool.connect(lp).addLiquidity(1, ONE_USDC.mul(10000));
    await pool.connect(lp).addLiquidity(255, ONE_USDC.mul(100000));

    loanTerms = await pool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[0].mul(MONE.add(loanTerms[1])).mul(105).div(100).div(MONE);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await pool.connect(borrower).borrow(ONE_ETH, minLoanLimit, maxRepayLimit, currBlock+10);
  });
});
