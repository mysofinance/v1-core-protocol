const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;

  beforeEach( async () => {
    [deployer, lp, borrower, ...addrs] = await ethers.getSigners();

    SubPool = await ethers.getContractFactory("SubPoolV1");
    SubPool = await SubPool.connect(deployer);

    _maxLoanPerColl = ONE_USDC.mul(500);
    _initMinLpAmount = ONE_USDC.mul(1000);
    _r1 = MONE.mul(2).div(10)
    _r2 = MONE.mul(2).div(100)
    _tvl1 = ONE_USDC.mul(100000);
    _tvl2 = ONE_USDC.mul(1000000);
    subPool = await SubPool.deploy(_maxLoanPerColl, _initMinLpAmount, _r1, _r2, _tvl1, _tvl2);
    await subPool.deployed();
  });

  it("Should have correct initial values", async function () {
    totalLiquidity = await subPool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(0);

    loanIdx = await subPool.loanIdx();
    expect(loanIdx).to.be.equal(1);
  });

  it("Should fail on loan terms without LPs", async function () {
    await expect(subPool.loanTerms(ONE_ETH)).to.be.reverted;
  });

  it("Should allow LPs to add liquidity", async function () {
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(lp).addLiquidity(0, ONE_USDC.mul(1111), 0, currBlock+10);
    await subPool.connect(lp).addLiquidity(1, ONE_USDC.mul(10111), 0, currBlock+10);
    await subPool.connect(lp).addLiquidity(255, ONE_USDC.mul(130111), 0, currBlock+10);
    totalLiquidity = await subPool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(ONE_USDC.mul(141000));
  });

  it("Should not allow adding too small amounts", async function () {
    currBlock = await ethers.provider.getBlockNumber();
    await expect(subPool.loanTerms(subPool.connect(lp).addLiquidity(0, 0, 0, currBlock+10))).to.be.reverted;
    await expect(subPool.loanTerms(subPool.connect(lp).addLiquidity(0, _initMinLpAmount.sub(1), 0, currBlock+10))).to.be.reverted;
  });

  it("Should not allow LPs to add to same slot", async function () {
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(lp).addLiquidity(0, ONE_USDC.mul(1000), 0, currBlock+10);
    await expect(subPool.loanTerms(subPool.connect(lp).addLiquidity(0, ONE_USDC.mul(1000), 0, currBlock+10))).to.be.reverted;
  });

  it("Should not allow LPs to add to slot higher than 255", async function () {
    currBlock = await ethers.provider.getBlockNumber();
    await expect(subPool.loanTerms(subPool.connect(lp).addLiquidity(256, ONE_USDC.mul(1000), 0, currBlock+10))).to.be.reverted;
  });

  it("Should allow borrowing", async function () {
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(lp).addLiquidity(0, ONE_USDC.mul(1000), 0, currBlock+10);
    await subPool.connect(lp).addLiquidity(1, ONE_USDC.mul(10000), 0, currBlock+10);
    await subPool.connect(lp).addLiquidity(255, ONE_USDC.mul(100000), 0, currBlock+10);

    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[0].mul(MONE.add(loanTerms[1])).mul(105).div(100).div(MONE);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(borrower).borrow(ONE_ETH, minLoanLimit, maxRepayLimit, currBlock+10);
  });

  it("Should not allow new LPs to claim in retrospect", async function () {
    //add liquidity
    currBlock1 = await ethers.provider.getBlockNumber();
    await subPool.connect(lp).addLiquidity(0, ONE_USDC.mul(1000), 0, currBlock1+10);

    //borrow
    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[0].mul(MONE.add(loanTerms[1])).mul(105).div(100).div(MONE);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(borrower).borrow(ONE_ETH, minLoanLimit, maxRepayLimit, currBlock+10);

    //move forward to loan expiry
    await ethers.provider.send("hardhat_mine", ["0x1000"]);

    //claim
    await subPool.connect(lp).claim(0, [1]);

    //remove liquidity
    await subPool.connect(lp).removeLiquidity(0);

    //move forward until slot reassignable
    await ethers.provider.send("hardhat_mine", ["0x1000"]);

    //ensure new lp cannot claim in retrospect
    currBlock2 = await ethers.provider.getBlockNumber();
    await subPool.connect(addrs[0]).addLiquidity(0, ONE_USDC.mul(1000), 0, currBlock2+10);
    await expect(subPool.connect(addrs[0]).claim(0, [1])).to.be.reverted;
  });
});
