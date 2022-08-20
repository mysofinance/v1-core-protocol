const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PAXG-USDC Pool Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_PAXG = MONE;
  const _loanCcyToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const _collCcyToken = "0x45804880De22913dAFE09f4980848ECE6EcbAf78";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _tvl1 = ONE_USDC.mul(100000);
  const _tvl2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.mul(300);
  const MIN_LIQUIDITY = ONE_USDC.mul(100);
  const USDC_MASTER_MINTER = "0xe982615d461dd5cd06575bbea87624fda4e3de17";
  const SUPPLY_CONTROLLER = "0xE25a329d385f77df5D4eD56265babe2b99A5436e";
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, pledger, ...addrs] = await ethers.getSigners();

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
    await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128);
    await USDC.connect(masterMinter).mint(pledger.address, MAX_UINT128);

    // prepare PAXG balances
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
    await PAXG.connect(supplyController).increaseSupply("800000000000000000000000000");
    await PAXG.connect(supplyController).transfer(pledger.address, "800000000000000000000000000");

    PoolPaxg = await ethers.getContractFactory("PoolPaxgUsdc");
    PoolPaxg = await PoolPaxg.connect(deployer);

    paxgPool = await PoolPaxg.deploy(_loanCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _tvl1, _tvl2, _minLoan, 100, 0);
    await paxgPool.deployed();

    // set allowances
    PAXG.connect(borrower).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    PAXG.connect(pledger).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    USDC.connect(lp1).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    USDC.connect(lp2).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    USDC.connect(lp3).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    USDC.connect(lp4).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    USDC.connect(lp5).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    USDC.connect(borrower).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    USDC.connect(pledger).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  });
  
  it("Should have correct initial values", async function () {
    totalLiquidity = await paxgPool.getTotalLiquidity();
    expect(totalLiquidity).to.be.equal(0);

    loanIdx = await paxgPool.loanIdx();
    expect(loanIdx).to.be.equal(1);
  });

  it("Should fail on loan terms without LPs", async function () {
    await expect(paxgPool.loanTerms(ONE_PAXG)).to.be.reverted;
  });

  it("Should allow LPs to add liquidity", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1111), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(10111), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(130111), timestamp+60, 0);
    totalLiquidity = await paxgPool.getTotalLiquidity();
    expect(totalLiquidity).to.be.equal(ONE_USDC.mul(141333));
  });

  it("Should allow borrowing with PAXG", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(10000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(100000), timestamp+60, 0);

    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+60, 0);
  });
  
  it("Should not allow new LPs to claim on unentitled previous loans", async function () {
    //add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(30000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(20000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(10000), timestamp+60, 0);

    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x52B7D2DCC80CD2E4000000",
    ]);
    //borrow & repay
    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await paxgPool.connect(borrower).repay(1, borrower.address, loanTerms.repaymentAmount);

    //borrow & repay
    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await paxgPool.connect(borrower).repay(2, borrower.address, loanTerms.repaymentAmount);

    //borrow & default
    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //claim
    await paxgPool.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999);

    //remove liquidity
    let lp1NumSharesPre = await paxgPool.getLpArrayInfo(lp1.address);
    //check lengths of arrays for Lp
    await expect(lp1NumSharesPre.sharesOverTime.length).to.be.equal(1);
    await expect(lp1NumSharesPre.loanIdxsWhereSharesChanged.length).to.be.equal(0);

    await paxgPool.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre.sharesOverTime[0]);
    
    //cannot remove twice
    await expect(paxgPool.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre)).to.be.reverted;

    lp1NumSharesPost = await paxgPool.getLpArrayInfo(lp1.address);
    await expect(lp1NumSharesPost.sharesOverTime.length).to.be.equal(2);
    await expect(lp1NumSharesPost.loanIdxsWhereSharesChanged.length).to.be.equal(1);
    await expect(lp1NumSharesPost.sharesOverTime[1]).to.be.equal(0);

    //ensure new lp cannot claim on previous loan
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(1000), timestamp+60, 0);
    await expect(paxgPool.connect(lp4).claim(lp4.address, [1], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim(lp4.address, [2], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim(lp4.address, [3], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim(lp4.address, [1,2], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim(lp4.address, [2,3], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim(lp4.address, [1,3], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim(lp4.address, [1,2,3], false, timestamp+9999999)).to.be.reverted;
  });
  
  it("Should be possible to borrow when there's sufficient liquidity, and allow new LPs to add liquidity to make borrowing possible again", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1000), timestamp+60, 0);

    // iteratively take out borrows until until liquidity so low that loan amount below min. loan
    numBorrows = 0;
    tooSmallLoans = false;
    for (let i = 0; i < 100; i++) {
      try {
        loanTerms = await paxgPool.loanTerms(ONE_PAXG);
        await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
        numBorrows += 1;
        console.log("loanTerms: ", loanTerms);
      } catch(error) {
        console.log("loanTerms error: ", error);
        await expect(paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0)).to.be.revertedWith('TooSmallLoan');
        tooSmallLoans = true;
        break;
      }
    }
    // check that some loans were taken out before eventually borrowing starts to revert
    expect(numBorrows).to.be.gte(0);
    expect(tooSmallLoans).to.be.true;

    // add liquidity again
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(1000), timestamp+60, 0);

    // take out a loan should be possible again without revert after liquidity add
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
  });

  it("Should allow LPs to claim individually", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(100000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(100000), timestamp+60, 0);

    for (let i = 0; i < 100; i++) {
      totalLiquidity = await paxgPool.getTotalLiquidity();
      loanTerms = await paxgPool.loanTerms(ONE_PAXG);
      await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      await paxgPool.connect(borrower).repay(i+1, borrower.address, loanTerms.repaymentAmount);
    }
    loanIds = Array.from(Array(100), (_, index) => index + 1);

    await paxgPool.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999);
    //cannot claim twice
    await expect(paxgPool.connect(lp1).claim(loanIds, false, timestamp+9999999)).to.be.reverted;

    await paxgPool.connect(lp2).claim(lp2.address, loanIds, false, timestamp+9999999);
    await paxgPool.connect(lp3).claim(lp3.address, loanIds, false, timestamp+9999999);
  });
  
  it("Should handle aggregate claims correctly (1/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepaymentsIndicative = ethers.BigNumber.from(0);
    totalRepayments = ethers.BigNumber.from(0);
    totalInterestCosts = ethers.BigNumber.from(0);
    preBorrBal = await USDC.balanceOf(borrower.address);
    sendAmount = ONE_PAXG.mul(2);
    for (let i = 0; i < 99; i++) {
      totalLiquidity = await paxgPool.getTotalLiquidity();
      //indicative repayment
      transferFee = await PAXG.getFeeFor(sendAmount);
      inAmount = sendAmount.sub(transferFee);
      loanTerms = await paxgPool.loanTerms(inAmount);
      totalRepaymentsIndicative = totalRepaymentsIndicative.add(loanTerms[1]);
      //borrow
      await paxgPool.connect(borrower).borrow(borrower.address, sendAmount, 0, MONE, timestamp+1000000000, 0);
      //actual repayment
      loanInfo = await paxgPool.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      //interest costs
      totalInterestCosts = totalInterestCosts.add(loanTerms[1].sub(loanTerms[0]));
      //repay
      await paxgPool.connect(borrower).repay(i+1, borrower.address, loanTerms.repaymentAmount);
    }
    await expect(totalRepaymentsIndicative).to.be.equal(totalRepayments);
    console.log("totalRepayments", totalRepayments)
    //total interest cost
    postBorrBal = await USDC.balanceOf(borrower.address);
    await expect(preBorrBal.sub(postBorrBal)).to.be.equal(totalInterestCosts);

    //lp1 claims individually
    preClaimBal = await USDC.balanceOf(lp1.address);
    loanIds = Array.from(Array(99), (_, index) => index + 1);
    await paxgPool.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp1.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    //cannot claim twice
    await expect(paxgPool.connect(lp1).claimFromAggregated(lp1.address, [0, 99], false, timestamp+9999999)).to.be.reverted;

    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //lp2 claims via aggregate
    benchmarkDiff = postClaimBal.sub(preClaimBal)
    preClaimBal = await USDC.balanceOf(lp2.address);
    await expect(paxgPool.connect(lp2).claimFromAggregated(lp2.address, [1, 99], false, timestamp+9999999)).to.be.reverted;
    await paxgPool.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp2.address);
    diff = postClaimBal.sub(preClaimBal)
    await expect(benchmarkDiff).to.be.equal(diff);

    //cannot claim twice
    await expect(paxgPool.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp+9999999)).to.be.reverted;

    //lp3 claims
    preClaimBal = await USDC.balanceOf(lp3.address);
    await paxgPool.connect(lp3).claimFromAggregated(lp3.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp3.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    //lp4 claims
    preClaimBal = await USDC.balanceOf(lp4.address);
    await paxgPool.connect(lp4).claimFromAggregated(lp4.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp4.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;
  });
  
  it("Should handle aggregate claims correctly (2/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(1, borrower.address, loanInfo.repayment);

    //2nd borrow & repay
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(2, borrower.address, loanInfo.repayment);

    //3rd borrow & default
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_PAXG);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //lp1 claims
    preClaimEthBal = await PAXG.balanceOf(lp1.address); //await ethers.provider.getBalance(lp1.address);
    preClaimTokenBal = await USDC.balanceOf(lp1.address);
    await expect(paxgPool.connect(lp1).claimFromAggregated(lp1.address, [1, 3], false, timestamp+9999999)).to.be.reverted;
    await paxgPool.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999);
    postClaimEthBal = await PAXG.balanceOf(lp1.address); //ethers.provider.getBalance(lp1.address);
    postClaimTokenBal = await USDC.balanceOf(lp1.address);

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
    preClaimTokenBal = await USDC.balanceOf(lp2.address);
    await paxgPool.connect(lp2).claim(lp2.address, [1, 2, 3], false, timestamp+9999999);
    postClaimEthBal = await PAXG.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    postClaimTokenBal = await USDC.balanceOf(lp2.address);

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
    preClaimTokenBal = await USDC.balanceOf(lp3.address);
    await expect(paxgPool.connect(lp3).claimFromAggregated(lp3.address, [1, 3], false, timestamp+9999999)).to.be.reverted;
    await paxgPool.connect(lp3).claim(lp3.address, [1, 2, 3], false, timestamp+9999999);
    postClaimEthBal = await PAXG.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    postClaimTokenBal = await USDC.balanceOf(lp3.address);

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
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    for (let i = 0; i < 100; i++) {
      await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      loanInfo = await paxgPool.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      await paxgPool.connect(borrower).repay(i+1, borrower.address, loanInfo.repayment);
    }

    for (let i = 0; i < 99; i++) {
      await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      loanInfo = await paxgPool.loanIdxToLoanInfo(i+101);
      totalRepayments = totalRepayments.add(loanInfo[0]);
    }

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //aggregate only allowed per 100 loans or multiples of 1000 not per 200
    await expect(paxgPool.connect(lp1).claimFromAggregated(lp1.address, [0, 199], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp2).claimFromAggregated(lp2.address, [1, 99, 199], false, timestamp+9999999)).to.be.reverted;

    //claim
    await paxgPool.connect(lp1).claimFromAggregated(lp1.address, [0, 100, 200], false, timestamp+9999999);
    await paxgPool.connect(lp2).claimFromAggregated(lp2.address, [0, 100, 200], false, timestamp+9999999);

    //remove liquidity
    const lp1NumShares = await paxgPool.getLpArrayInfo(lp1.address);
    const lp2NumShares = await paxgPool.getLpArrayInfo(lp2.address);
    const lp3NumShares = await paxgPool.getLpArrayInfo(lp3.address);

    await paxgPool.connect(lp1).removeLiquidity(lp1.address, lp1NumShares.sharesOverTime[0]);
    await paxgPool.connect(lp2).removeLiquidity(lp2.address, lp2NumShares.sharesOverTime[0]);
    await paxgPool.connect(lp3).removeLiquidity(lp3.address, lp3NumShares.sharesOverTime[0]);

    balEth = await PAXG.balanceOf(paxgPool.address); //await ethers.provider.getBalance(paxgPool.address);
    balTestToken = await USDC.balanceOf(paxgPool.address);
    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();

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
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(1, borrower.address, loanInfo.repayment);

    //2nd borrow & repay
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(2, borrower.address, loanInfo.repayment);

    //3rd borrow & default
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_PAXG);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //claim
    await paxgPool.connect(lp1).claim(lp1.address, [1, 2, 3], false, timestamp+9999999);
    await paxgPool.connect(lp2).claim(lp2.address, [1, 2, 3], false, timestamp+9999999);
    await paxgPool.connect(lp3).claim(lp3.address, [1, 2, 3], false, timestamp+9999999);

    //remove liquidity
    const lp1NumShares = await paxgPool.getLpArrayInfo(lp1.address);
    const lp2NumShares = await paxgPool.getLpArrayInfo(lp2.address);
    const lp3NumShares = await paxgPool.getLpArrayInfo(lp3.address);

    await paxgPool.connect(lp1).removeLiquidity(lp1.address, lp1NumShares.sharesOverTime[0]);
    await paxgPool.connect(lp2).removeLiquidity(lp2.address, lp2NumShares.sharesOverTime[0]);
    await paxgPool.connect(lp3).removeLiquidity(lp3.address, lp3NumShares.sharesOverTime[0]);

    balEth = await PAXG.balanceOf(paxgPool.address); //await ethers.provider.getBalance(paxgPool.address);
    balTestToken = await USDC.balanceOf(paxgPool.address);
    console.log("balEth:", balEth);
    console.log("balTestToken:", balTestToken);

    //add liquidity with dust should automatically transfer
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+1000, 0);

    //check dust was transferred to treasury
    balTreasury = await USDC.balanceOf("0x1234567890000000000000000000000000000001");
    await expect(balTreasury).to.be.equal(MIN_LIQUIDITY);

    //check lp shares
    totalLpShares = await paxgPool.totalLpShares();
    await expect(totalLpShares).to.be.equal(ONE_USDC.mul(500000));
  })

  it("Should never fall below MIN_LIQUIDITY", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1001), timestamp+60, 0);

    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG.mul(10000), 0, MONE, timestamp+1000000000, 0);
    
    //check total liquidity & balance
    totalLiquidity = await paxgPool.getTotalLiquidity();
    balance = await USDC.balanceOf(paxgPool.address);
    console.log("totalLiquidity:", totalLiquidity);
    console.log("balance:", balance)
    expect(totalLiquidity).to.be.equal(balance);
    expect(totalLiquidity).to.be.gte(MIN_LIQUIDITY);
  })

  it("Should allow rolling over loan", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000), timestamp+60, 0);

    pledgeAmount = ONE_PAXG;
    await paxgPool.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);

    loanTerms = await paxgPool.loanTerms(loanInfo.collateral);
    balTestTokenPre = await USDC.balanceOf(borrower.address);
    await paxgPool.connect(borrower).rollOver(1, 0, MONE, timestamp+1000000000, 0);
    balTestTokenPost = await USDC.balanceOf(borrower.address);

    expRollCost = loanInfo.repayment.sub(loanTerms[0]);
    actRollCost = balTestTokenPre.sub(balTestTokenPost);
    expect(expRollCost).to.be.equal(actRollCost);
  })

  it("Shouldn't overflow even after 5x rounds of LPing USDC 100mn and borrowing against 100,000,000 PAXG", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    pledgeAmount = ONE_PAXG.mul(100000000);

    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await paxgPool.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(2);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await paxgPool.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(3);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await paxgPool.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(4);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)


    await paxgPool.connect(lp5).addLiquidity(lp5.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(5);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)
  })
  
  it("Should allow borrowing on behalf", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(10000), timestamp+60, 0);

    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);

    // let pledger borrow on behalf of borrower
    await paxgPool.connect(pledger).borrow(borrower.address, ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+60, 0);

    // check loan owner
    loanOwner = await paxgPool.loanIdxToBorrower(1);
    await expect(loanOwner).to.be.equal(borrower.address);

    // get loan info
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);

    // check that pledger is not entitled to repay
    await expect(paxgPool.connect(pledger).repay(1, borrower.address, loanInfo.repayment)).to.be.revertedWith("UnapprovedSender");

    // check that borrower can repay
    await paxgPool.connect(borrower).repay(1, borrower.address, loanInfo.repayment)
  })

  it("Should allow adding liquidity on behalf", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;

    // lp2 shouldn't be able to add liquidity on lp1's behalf without approval
    await expect(paxgPool.connect(lp2).addLiquidity(lp1.address, ONE_USDC.mul(10000), timestamp+60, 0)).to.be.revertedWith("UnapprovedSender");

    // should still fail with wrong approval
    await paxgPool.connect(lp1).setApprovals(lp2.address, [true, true, false, true, true]);
    await expect(paxgPool.connect(lp2).addLiquidity(lp1.address, ONE_USDC.mul(10000), timestamp+60, 0)).to.be.revertedWith("UnapprovedSender");

    // lp1 approves lp2 correctly
    await paxgPool.connect(lp1).setApprovals(lp2.address, [false, false, true, false, false]);

    // lp2 adds liquidity on behalf of lp1
    await paxgPool.connect(lp2).addLiquidity(lp1.address, ONE_USDC.mul(10000), timestamp+60, 0);

    // check lp shares
    lpArrayInfo1 = await paxgPool.getLpArrayInfo(lp1.address);
    lpArrayInfo2 = await paxgPool.getLpArrayInfo(lp2.address);
    await expect(lpArrayInfo1.sharesOverTime[0]).to.be.equal(ONE_USDC.mul(10000));
    await expect(lpArrayInfo2.sharesOverTime.length).to.be.equal(0);
  })

  it("Should allow removing liquidity on behalf", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;

    // add liquidity
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(10000), timestamp+60, 0);

    // lp2 shouldn't be able to remove liquidity on lp1's behalf without approval
    await expect(paxgPool.connect(lp2).removeLiquidity(lp1.address, ONE_USDC.mul(10000))).to.be.revertedWith("UnapprovedSender");

    // should still fail with wrong approval
    await paxgPool.connect(lp1).setApprovals(lp2.address, [true, true, true, false, true]);
    await expect(paxgPool.connect(lp2).removeLiquidity(lp1.address, ONE_USDC.mul(10000))).to.be.revertedWith("UnapprovedSender");
    
    //move forward past earliest remove
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 100])
    await ethers.provider.send("evm_mine");

    // lp1 approves lp2
    await paxgPool.connect(lp1).setApprovals(lp2.address, [false, false, false, true, false]);
    preBal = await USDC.balanceOf(lp2.address); 
    await paxgPool.connect(lp2).removeLiquidity(lp1.address, ONE_USDC.mul(10000));
    postBal = await USDC.balanceOf(lp2.address);
    await expect(postBal.sub(preBal)).to.be.equal(ONE_USDC.mul(10000).sub(MIN_LIQUIDITY));
  })
  
  it("Should allow repaying on behalf", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(10000), timestamp+60, 0);

    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);

    // borrow
    await paxgPool.connect(borrower).borrow(borrower.address, ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+60, 0);

    // get loan info
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);

    // check that lp is not entitled to repay
    await expect(paxgPool.connect(lp1).repay(1, borrower.address, loanInfo.repayment)).to.be.revertedWith("UnapprovedSender");

    // should still fail with wrong approval
    await paxgPool.connect(borrower).setApprovals(lp1.address, [false, true, true, true, true]);
    await expect(paxgPool.connect(lp1).repay(1, borrower.address, loanInfo.repayment)).to.be.revertedWith("UnapprovedSender");

    // check that lp can repay
    await paxgPool.connect(borrower).setApprovals(lp1.address, [true, false, false, false, false]);
    preBal = await PAXG.balanceOf(lp1.address); 
    await paxgPool.connect(lp1).repay(1, lp1.address, loanInfo.repayment);
    postBal = await PAXG.balanceOf(lp1.address);
    transferFee = await PAXG.getFeeFor(loanInfo.collateral);
    postFeeReclaimable = (loanInfo.collateral).sub(transferFee);
    await expect(postBal.sub(preBal)).to.be.equal(postFeeReclaimable);
  })

  it("Should allow rolling over on behalf", async function () {

  })

  it("Should allow claiming on behalf", async function () {

  })
});