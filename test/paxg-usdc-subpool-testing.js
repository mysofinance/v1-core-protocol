const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PAXG-USDC SubPool Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_PAXG = MONE;
  const _collCcyToken = "0x45804880De22913dAFE09f4980848ECE6EcbAf78";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _tvl1 = ONE_USDC.mul(100000);
  const _tvl2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.mul(300);
  const MIN_LIQUIDITY = ONE_USDC.mul(100);
  const SUPPLY_CONTROLLER = "0xE25a329d385f77df5D4eD56265babe2b99A5436e";

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();

    USDC = await ethers.getContractFactory("USDC");
    USDC = await USDC.connect(deployer);
    usdc = await USDC.deploy("USDC", "USDC", 6);
    const _loanCcyToken = usdc.address;

    PAXG = await ethers.getContractAt("IPAXG", _collCcyToken);
    await ethers.provider.send("hardhat_setBalance", [
      SUPPLY_CONTROLLER,
      "0x56BC75E2D63100000",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SUPPLY_CONTROLLER],
    });
    supplyController = await ethers.getSigner(SUPPLY_CONTROLLER);

    await PAXG.connect(supplyController).increaseSupply("800000000000000000000000000");
    await PAXG.connect(supplyController).transfer(borrower.address, "800000000000000000000000000");

    await usdc.connect(deployer).mint(lp1.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    await usdc.connect(deployer).mint(lp2.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    await usdc.connect(deployer).mint(lp3.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    await usdc.connect(deployer).mint(lp4.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    await usdc.connect(deployer).mint(lp5.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    await usdc.connect(deployer).mint(borrower.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

    SubPool = await ethers.getContractFactory("SubPoolV1");
    SubPool = await SubPool.connect(deployer);

    subPool = await SubPool.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _tvl1, _tvl2, _minLoan);
    await subPool.deployed();

    Aggregation = await ethers.getContractFactory("Aggregation");
    Aggregation = await Aggregation.connect(deployer);

    aggregation = await Aggregation.deploy(subPool.address);
    await aggregation.deployed();

    await subPool.setAggregationAddr(aggregation.address);

    PAXG.connect(borrower).approve(subPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    usdc.connect(lp1).approve(subPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    usdc.connect(lp2).approve(subPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    usdc.connect(lp3).approve(subPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    usdc.connect(lp4).approve(subPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    usdc.connect(lp5).approve(subPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    usdc.connect(borrower).approve(subPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  });

  it("Should have correct initial values", async function () {
    totalLiquidity = await subPool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(0);

    loanIdx = await subPool.loanIdx();
    expect(loanIdx).to.be.equal(1);
  });

  it("Should fail on loan terms without LPs", async function () {
    await expect(subPool.loanTerms(ONE_PAXG)).to.be.reverted;
  });

  it("Should allow LPs to add liquidity", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1111), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(10111), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(130111), timestamp+60, 0);
    totalLiquidity = await subPool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(ONE_USDC.mul(141333));
  });

  it("Should not allow adding liquidity if already active LP", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);
    await expect(subPool.loanTerms(subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0))).to.be.reverted;
  });

  it("Should allow borrowing with PAXG", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(10000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);

    loanTerms = await subPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+60, 0);
  });
  
  it("Should not allow new LPs to claim on unentitled previous loans", async function () {
    //add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(30000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(20000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(10000), timestamp+60, 0);

    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x52B7D2DCC80CD2E4000000",
    ]);
    //borrow & repay
    loanTerms = await subPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await subPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await subPool.connect(borrower).repay(1);

    //borrow & repay
    loanTerms = await subPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await subPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await subPool.connect(borrower).repay(2);

    //borrow & default
    loanTerms = await subPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await subPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //claim
    await subPool.connect(lp1).claim([1,2,3]);
    //cannot claim twice
    await expect(subPool.connect(lp1).claim([1,2,3])).to.be.reverted;

    //remove liquidity
    await subPool.connect(lp1).removeLiquidity();
    //cannot remove twice
    await expect(subPool.connect(lp1).removeLiquidity()).to.be.reverted;

    //ensure new lp cannot claim on previous loan
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp4).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);
    await expect(subPool.connect(lp4).claim([1])).to.be.reverted;
    await expect(subPool.connect(lp4).claim([2])).to.be.reverted;
    await expect(subPool.connect(lp4).claim([3])).to.be.reverted;
    await expect(subPool.connect(lp4).claim([1,2])).to.be.reverted;
    await expect(subPool.connect(lp4).claim([2,3])).to.be.reverted;
    await expect(subPool.connect(lp4).claim([1,3])).to.be.reverted;
    await expect(subPool.connect(lp4).claim([1,2,3])).to.be.reverted;
  });
  
  it("Should be possible to borrow when there's sufficient liquidity, and allow new LPs to add liquidity to make borrowing possible again", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);

    for (let i = 0; i < 7; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_PAXG);
      if(loanTerms[0].sub(_minLoan).gte(MONE.mul(0))) {
        await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      } else {
        await expect(subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0)).to.be.reverted;
        break;
      }
      console.log("totalLiquidity: ", totalLiquidity);
      console.log("loanTerms: ", loanTerms);
    }

    console.log("--------------------------------------------------------")
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);
    for (let i = 0; i < 7; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_PAXG);
      if(loanTerms[0].sub(_minLoan).gte(MONE.mul(0))) {
        await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      } else {
        await expect(subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0)).to.be.reverted;
        break;
      }
      console.log("totalLiquidity: ", totalLiquidity);
      console.log("loanTerms: ", loanTerms);
    }
    await expect(subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0)).to.be.reverted;
  });

  it("Should allow LPs to claim individually", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);

    for (let i = 0; i < 100; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_PAXG);
      await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      await subPool.connect(borrower).repay(i+1);
    }
    loanIds = Array.from(Array(100), (_, index) => index + 1);

    await subPool.connect(lp1).claim(loanIds);
    //cannot claim twice
    await expect(subPool.connect(lp1).claim(loanIds)).to.be.reverted;

    await subPool.connect(lp2).claim(loanIds);
    await subPool.connect(lp3).claim(loanIds);
  });
  
  it("Should handle aggregate claims correctly (1/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await subPool.connect(lp4).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepaymentsIndicative = ethers.BigNumber.from(0);
    totalRepayments = ethers.BigNumber.from(0);
    totalInterestCosts = ethers.BigNumber.from(0);
    preBorrBal = await usdc.balanceOf(borrower.address);
    pledgeAmount = ONE_PAXG.mul(2);
    for (let i = 0; i < 100; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      //indicative repayment
      loanTerms = await subPool.loanTerms(pledgeAmount);
      totalRepaymentsIndicative = totalRepaymentsIndicative.add(loanTerms[1]);
      //borrow
      await subPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
      //actual repayment
      loanInfo = await subPool.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      //interest costs
      totalInterestCosts = totalInterestCosts.add(loanTerms[1].sub(loanTerms[0]));
      //repay
      await subPool.connect(borrower).repay(i+1);
    }
    await expect(totalRepaymentsIndicative).to.be.equal(totalRepayments);
    console.log("totalRepayments", totalRepayments)
    //total interest cost
    postBorrBal = await usdc.balanceOf(borrower.address);
    await expect(preBorrBal.sub(postBorrBal)).to.be.equal(totalInterestCosts);

    //aggregate claims
    await subPool.connect(addrs[0]).aggregateClaims(1, 100);

    //lp1 claims individually
    preClaimBal = await usdc.balanceOf(lp1.address);
    loanIds = Array.from(Array(100), (_, index) => index + 1);
    await subPool.connect(lp1).claim(loanIds);
    postClaimBal = await usdc.balanceOf(lp1.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(10000).div(actClaim)
    await expect((10000 <= pct) && (pct <= 10010)).to.be.true;

    //cannot claim twice
    await expect(subPool.connect(lp1).claimFromAggregated(1, 100)).to.be.reverted;
    
    //lp2 claims via aggregate
    benchmarkDiff = postClaimBal.sub(preClaimBal)
    preClaimBal = await usdc.balanceOf(lp2.address);
    await subPool.connect(lp2).claimFromAggregated(1, 100);
    postClaimBal = await usdc.balanceOf(lp2.address);
    diff = postClaimBal.sub(preClaimBal)
    await expect(benchmarkDiff).to.be.equal(diff);

    //cannot claim twice
    await expect(subPool.connect(lp2).claimFromAggregated(1, 100)).to.be.reverted;

    //lp3 claims
    preClaimBal = await usdc.balanceOf(lp3.address);
    await subPool.connect(lp3).claimFromAggregated(1,100);
    postClaimBal = await usdc.balanceOf(lp3.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(10000).div(actClaim)
    await expect((10000 <= pct) && (pct <= 10010)).to.be.true;

    //lp4 claims
    preClaimBal = await usdc.balanceOf(lp4.address);
    await subPool.connect(lp4).claimFromAggregated(1,100);
    postClaimBal = await usdc.balanceOf(lp4.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(10000).div(actClaim)
    await expect((10000 <= pct) && (pct <= 10010)).to.be.true;
  });
  
  it("Should handle aggregate claims correctly (2/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(1);

    //2nd borrow & repay
    await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(2);

    //3rd borrow & default
    await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_PAXG);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //aggregate claims
    await subPool.connect(addrs[0]).aggregateClaims(1, 3);

    //lp1 claims
    preClaimEthBal = await PAXG.balanceOf(lp1.address); //await ethers.provider.getBalance(lp1.address);
    preClaimTokenBal = await usdc.balanceOf(lp1.address);
    await subPool.connect(lp1).claimFromAggregated(1, 3);
    postClaimEthBal = await PAXG.balanceOf(lp1.address); //ethers.provider.getBalance(lp1.address);
    postClaimTokenBal = await usdc.balanceOf(lp1.address);

    //PAXG diffs
    console.log("preClaimEthBal", preClaimEthBal)
    console.log("postClaimEthBal", postClaimEthBal)
    ethDiff = postClaimEthBal.sub(preClaimEthBal);
    console.log("ethDiff", ethDiff)
    expEthDiff = totalLeftColl.mul(5).div(10);
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;

    //token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal);
    expTokenDiff = totalRepayments.mul(5).div(10);
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;


    //lp2 claims
    console.log("totalRepayments", totalRepayments)
    preClaimEthBal = await PAXG.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    preClaimTokenBal = await usdc.balanceOf(lp2.address);
    await subPool.connect(lp2).claimFromAggregated(1, 3);
    postClaimEthBal = await PAXG.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    postClaimTokenBal = await usdc.balanceOf(lp2.address);

    //PAXG diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal);
    expEthDiff = totalLeftColl.mul(3).div(10);
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;

    //token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal);
    expTokenDiff = totalRepayments.mul(3).div(10);
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;


    //lp3 claims
    console.log("totalRepayments", totalRepayments)
    preClaimEthBal = await PAXG.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    preClaimTokenBal = await usdc.balanceOf(lp3.address);
    await subPool.connect(lp3).claimFromAggregated(1, 3);
    postClaimEthBal = await PAXG.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    postClaimTokenBal = await usdc.balanceOf(lp3.address);

    //PAXG diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal);
    expEthDiff = totalLeftColl.mul(2).div(10);
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;

    //token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal);
    expTokenDiff = totalRepayments.mul(2).div(10);
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;
  });

  it("Should allow removing liquidity", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    for (let i = 0; i < 100; i++) {
      await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      loanInfo = await subPool.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      await subPool.connect(borrower).repay(i+1);
    }

    for (let i = 0; i < 100; i++) {
      await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      loanInfo = await subPool.loanIdxToLoanInfo(i+101);
      totalRepayments = totalRepayments.add(loanInfo[0]);
    }

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //aggregate claims
    await subPool.connect(addrs[0]).aggregateClaims(1, 200);
    
    //claim
    await subPool.connect(lp1).claimFromAggregated(1, 200);
    await subPool.connect(lp2).claimFromAggregated(1, 200);

    //remove liquidity
    await subPool.connect(lp1).removeLiquidity();
    await subPool.connect(lp2).removeLiquidity();
    await subPool.connect(lp3).removeLiquidity();

    balEth = await PAXG.balanceOf(subPool.address); //await ethers.provider.getBalance(subPool.address);
    balTestToken = await usdc.balanceOf(subPool.address);
    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();

    await expect(totalLiquidity).to.be.equal(MIN_LIQUIDITY);
    await expect(totalLpShares).to.be.equal(0);
    console.log("(2/2) balEth:", balEth);
    console.log("(2/2) balTestToken:", balTestToken);
    console.log("(2/2) totalLiquidity:", totalLiquidity);
    console.log("(2/2) totalLpShares:", totalLpShares);
  })

  it("Should allow adding liquidity again after removing and claiming", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(1);

    //2nd borrow & repay
    await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(2);

    //3rd borrow & default
    await subPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_PAXG);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //aggregate claims
    await subPool.connect(addrs[0]).aggregateClaims(1, 3);
    
    //claim
    await subPool.connect(lp1).claimFromAggregated(1, 3);
    await subPool.connect(lp2).claimFromAggregated(1, 3);
    await subPool.connect(lp3).claimFromAggregated(1, 3);

    //remove liquidity
    await subPool.connect(lp1).removeLiquidity();
    await subPool.connect(lp2).removeLiquidity();
    await subPool.connect(lp3).removeLiquidity();

    balEth = await PAXG.balanceOf(subPool.address); //await ethers.provider.getBalance(subPool.address);
    balTestToken = await usdc.balanceOf(subPool.address);
    console.log("balEth:", balEth);
    console.log("balTestToken:", balTestToken);

    //add liquidity with dust should automatically transfer
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+1000, 0);

    //check dust was transferred to treasury
    balTreasury = await usdc.balanceOf("0x0000000000000000000000000000000000000001");
    await expect(balTreasury).to.be.equal(MIN_LIQUIDITY);

    //check lp shares
    totalLpShares = await subPool.totalLpShares();
    await expect(totalLpShares).to.be.equal(ONE_USDC.mul(500000));
  })

  it("Should never fall below MIN_LIQUIDITY", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(1001), timestamp+60, 0);

    await subPool.connect(borrower).borrow(ONE_PAXG.mul(10000), 0, MONE, timestamp+1000000000, 0);
    
    //check total liquidity & balance
    totalLiquidity = await subPool.totalLiquidity();
    balance = await usdc.balanceOf(subPool.address);
    console.log("totalLiquidity:", totalLiquidity);
    console.log("balance:", balance)
    expect(totalLiquidity).to.be.equal(balance);
    expect(totalLiquidity).to.be.gte(MIN_LIQUIDITY);
  })

  it("Should allow rolling over loan", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);

    pledgeAmount = ONE_PAXG;
    await subPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(1);

    loanTerms = await subPool.loanTerms(loanInfo.collateral);
    balTestTokenPre = await usdc.balanceOf(borrower.address);
    await subPool.connect(borrower).rollOver(1, 0, MONE, timestamp+1000000000, 0);
    balTestTokenPost = await usdc.balanceOf(borrower.address);

    expRollCost = loanInfo.repayment.sub(loanTerms[0]);
    actRollCost = balTestTokenPre.sub(balTestTokenPost);
    expect(expRollCost).to.be.equal(actRollCost);
  })

  it("Shouldn't overflow even after 5x rounds of LPing USDC 100mn and borrowing against 100,000,000 PAXG", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    pledgeAmount = ONE_PAXG.mul(100000000);

    await subPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(1);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await subPool.connect(lp2).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(2);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await subPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(3);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await subPool.connect(lp4).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(4);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)


    await subPool.connect(lp5).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await subPool.loanIdxToLoanInfo(5);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)
  })
});
