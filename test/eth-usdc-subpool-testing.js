const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ETH-USDC SubPool Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, borrower, ...addrs] = await ethers.getSigners();

    TestToken = await ethers.getContractFactory("TestToken");
    TestToken = await TestToken.connect(deployer);
    testToken = await TestToken.deploy("USDC", "USDC", 6);
    await testToken.connect(deployer).mint(lp1.address, ONE_USDC.mul(1000000));
    await testToken.connect(deployer).mint(lp2.address, ONE_USDC.mul(1000000));
    await testToken.connect(deployer).mint(lp3.address, ONE_USDC.mul(1000000));
    await testToken.connect(deployer).mint(borrower.address, ONE_USDC.mul(1000000));

    SubPool = await ethers.getContractFactory("SubPoolV1");
    SubPool = await SubPool.connect(deployer);

    _loanCcyToken = testToken.address;
    _collCcyToken = "0x0000000000000000000000000000000000000000";
    _loanTenor = 86400;
    _maxLoanPerColl = ONE_USDC.mul(500);
    _r1 = MONE.mul(2).div(10)
    _r2 = MONE.mul(2).div(100)
    _tvl1 = ONE_USDC.mul(100000);
    _tvl2 = ONE_USDC.mul(1000000);
    subPool = await SubPool.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _tvl1, _tvl2);
    await subPool.deployed();

    testToken.connect(lp1).approve(subPool.address, ONE_USDC.mul(1000000));
    testToken.connect(lp2).approve(subPool.address, ONE_USDC.mul(1000000));
    testToken.connect(lp3).approve(subPool.address, ONE_USDC.mul(1000000));
    testToken.connect(borrower).approve(subPool.address, ONE_USDC.mul(1000000));
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
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1111), timestamp+60);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(10111), timestamp+60);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(130111), timestamp+60);
    totalLiquidity = await subPool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(ONE_USDC.mul(141333));
  });

  it("Should not allow LPs to add to same slot", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+10);
    await expect(subPool.loanTerms(subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+10))).to.be.reverted;
  });

  it("Should allow borrowing with ETH", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(10000), timestamp+60);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+60);

    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[0].mul(MONE.add(loanTerms[1])).mul(102).div(100).div(MONE);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(borrower).borrow(0, minLoanLimit, maxRepayLimit, timestamp+60, {value: ONE_ETH});
  });

  it("Should not allow borrowing without ETH", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(10000), timestamp+60);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+60);

    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[0].mul(MONE.add(loanTerms[1])).mul(102).div(100).div(MONE);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await expect(subPool.connect(borrower).borrow(ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60)).to.be.reverted;
  });

  it("Should not allow new LPs to claim in retrospect", async function () {
    //add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60);

    //borrow
    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[0].mul(MONE.add(loanTerms[1])).mul(102).div(100).div(MONE);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(borrower).borrow(0, minLoanLimit, maxRepayLimit, timestamp+60, {value: ONE_ETH});
    //await subPool.connect(borrower).borrow(ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //claim
    await subPool.connect(lp1).claim([1]);
    //cannot claim twice
    await expect(subPool.connect(lp1).claim([1])).to.be.reverted;

    //remove liquidity
    await subPool.connect(lp1).removeLiquidity();
    //cannot remove twice
    await expect(subPool.connect(lp1).removeLiquidity()).to.be.reverted;

    //ensure new lp cannot claim on previous loan
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(1000), timestamp+10);
    await expect(subPool.connect(lp2).claim([1])).to.be.reverted;
  });

  it("Should be possible to borrow when there's sufficient liquidity, and allow new LPs to add liquidity to make borrowing possible again", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+10);

    for (let i = 0; i < 7; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_ETH);
      console.log("totalLiquidity: ", totalLiquidity);
      console.log("loanTerms: ", loanTerms);
      await subPool.connect(borrower).borrow(0, 0, MONE, timestamp+1000000000, {value: ONE_ETH});
      //await subPool.connect(borrower).borrow(ONE_ETH, 0, MONE, timestamp+1000000000);
    }
    await expect(subPool.connect(borrower).borrow(0, 0, MONE, timestamp+1000000000, {value: ONE_ETH})).to.be.reverted;
    //await expect(subPool.connect(borrower).borrow(ONE_ETH, 0, MONE, timestamp+1000000000)).to.be.reverted;

    console.log("--------------------------------------------------------")
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(1000), timestamp+10);
    for (let i = 0; i < 7; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_ETH);
      console.log("totalLiquidity: ", totalLiquidity);
      console.log("loanTerms: ", loanTerms);
      await subPool.connect(borrower).borrow(0, 0, MONE, timestamp+1000000000, {value: ONE_ETH});
      //await subPool.connect(borrower).borrow(ONE_ETH, 0, MONE, timestamp+1000000000);
    }
    await expect(subPool.connect(borrower).borrow(0, 0, MONE, timestamp+1000000000, {value: ONE_ETH})).to.be.reverted;
    //await expect(subPool.connect(borrower).borrow(ONE_ETH, 0, MONE, timestamp+1000000000)).to.be.reverted;
  });

  it("Should allow LPs to claim individually", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000), timestamp+10);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(100000), timestamp+10);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+10);

    for (let i = 0; i < 100; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_ETH);
      await subPool.connect(borrower).borrow(0, 0, MONE, timestamp+1000000000, {value: ONE_ETH});
      //await subPool.connect(borrower).borrow(ONE_ETH, 0, MONE, timestamp+1000000000);
      await subPool.connect(borrower).repay(i+1);
    }
    loanIds = Array.from({length:99},(v,k)=>k+1);

    await subPool.connect(lp1).claim(loanIds);
    //cannot claim twice
    await expect(subPool.connect(lp1).claim(loanIds)).to.be.reverted;

    await subPool.connect(lp2).claim(loanIds);
    await subPool.connect(lp3).claim(loanIds);
  });

  it("Should allow to aggregate claims and let LPs claim from aggregated results", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000), timestamp+10);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(100000), timestamp+10);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+10);

    for (let i = 0; i < 100; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_ETH);
      await subPool.connect(borrower).borrow(0, 0, MONE, timestamp+1000000000, {value: ONE_ETH});
      //await subPool.connect(borrower).borrow(ONE_ETH, 0, MONE, timestamp+1000000000);
      await subPool.connect(borrower).repay(i+1);
    }
    await subPool.connect(addrs[0]).aggregateClaims(1, 99);
    await subPool.connect(lp1).claimFromAggregated(1,99);
    //cannot claim twice
    await expect(subPool.connect(lp1).claimFromAggregated(1,99)).to.be.reverted;

    await subPool.connect(lp2).claimFromAggregated(1,99);
    await subPool.connect(lp3).claimFromAggregated(1,99);
  });

});
