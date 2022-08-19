const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WETH-USDC Pool Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;
  const _loanCcyToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const _collCcyToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _tvl1 = ONE_USDC.mul(100000);
  const _tvl2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.mul(100);
  const MIN_LIQUIDITY = ONE_USDC.mul(100);
  const USDC_MASTER_MINTER = "0xe982615d461dd5cd06575bbea87624fda4e3de17";
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();

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
    poolWethUsdc = await PoolWethUsdc.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2, _tvl1, _tvl2, _minLoan, 100, 0);
    await poolWethUsdc.deployed();

    // approve DAI and WETH balances
    USDC.connect(lp1).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp2).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp3).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp4).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(lp5).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(borrower).approve(poolWethUsdc.address, MAX_UINT128);
    WETH.connect(borrower).approve(poolWethUsdc.address, MAX_UINT128);
  });
  
  it("Should have correct initial values", async function () {
    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    expect(totalLiquidity).to.be.equal(0);

    loanIdx = await poolWethUsdc.loanIdx();
    expect(loanIdx).to.be.equal(1);
  });

  it("Should fail on loan terms without LPs", async function () {
    await expect(poolWethUsdc.loanTerms(ONE_ETH)).to.be.reverted;
  });

  it("Should allow LPs to add liquidity", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1111), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(10111), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(130111), timestamp+60, 0);
    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    expect(totalLiquidity).to.be.equal(ONE_USDC.mul(141333));
  });

  it("Should allow borrowing with ETH", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(10000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(100000), timestamp+60, 0);

    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60, 0);
  });
  
  it("Should not allow new LPs to claim on unentitled previous loans", async function () {
    //add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(30000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(20000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(10000), timestamp+60, 0);

    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;

    //borrow & repay
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await poolWethUsdc.connect(borrower).repay(1, borrower.address, loanTerms.repaymentAmount);

    //borrow & repay
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await poolWethUsdc.connect(borrower).repay(2, borrower.address, loanTerms.repaymentAmount);

    //borrow & default
    loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //claim
    await poolWethUsdc.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999);
    //cannot claim twice
    await expect(poolWethUsdc.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999)).to.be.reverted;

    //remove liquidity
    let lp1NumSharesPre = await poolWethUsdc.getLpArrayInfo(lp1.address);
    await poolWethUsdc.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre.sharesOverTime[0]);

    //cannot remove twice
    await expect(poolWethUsdc.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre)).to.be.reverted;

    lp1NumSharesPost = await poolWethUsdc.getLpArrayInfo(lp1.address);
    await expect(lp1NumSharesPost.sharesOverTime[1]).to.be.equal(0);

    //ensure new lp cannot claim on previous loan
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(1000), timestamp+60, 0);
    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [1], false, timestamp+9999999)).to.be.reverted;
    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [2], false, timestamp+9999999)).to.be.reverted;
    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [3], false, timestamp+9999999)).to.be.reverted;
    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [1,2], false, timestamp+9999999)).to.be.reverted;
    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [2,3], false, timestamp+9999999)).to.be.reverted;
    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [1,3], false, timestamp+9999999)).to.be.reverted;
    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [1,2,3], false, timestamp+9999999)).to.be.reverted;
  });
  
  it("Should be possible to borrow when there's sufficient liquidity, and allow new LPs to add liquidity to make borrowing possible again", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1000), timestamp+60, 0);

    // iteratively take out borrows until until liquidity so low that loan amount below min. loan
    numBorrows = 0;
    tooSmallLoans = false;
    for (let i = 0; i < 100; i++) {
      try {
        loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
        await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
        numBorrows += 1;
        console.log("loanTerms: ", loanTerms);
      } catch(error) {
        console.log("loanTerms error: ", error);
        await expect(poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0)).to.be.revertedWith('TooSmallLoan');
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
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(1000), timestamp+60, 0);

    // take out a loan should be possible again without revert after liquidity add
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
  });

  it("Should allow LPs to claim individually", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(100000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(100000), timestamp+60, 0);

    for (let i = 0; i < 100; i++) {
      totalLiquidity = await poolWethUsdc.getTotalLiquidity();
      loanTerms = await poolWethUsdc.loanTerms(ONE_ETH);
      await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
      await poolWethUsdc.connect(borrower).repay(i+1, borrower.address, loanTerms.repaymentAmount);
    }
    loanIds = Array.from(Array(100), (_, index) => index + 1);

    await poolWethUsdc.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999);
    //cannot claim twice
    await expect(poolWethUsdc.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999)).to.be.reverted;

    await poolWethUsdc.connect(lp2).claim(lp2.address, loanIds, false, timestamp+9999999);
    await poolWethUsdc.connect(lp3).claim(lp3.address, loanIds, false, timestamp+9999999);
  });
  
  it("Should handle aggregate claims correctly test (1/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(300000), timestamp+60, 0);
    await poolWethUsdc.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepaymentsIndicative = ethers.BigNumber.from(0);
    totalRepayments = ethers.BigNumber.from(0);
    totalInterestCosts = ethers.BigNumber.from(0);
    preBorrBal = await USDC.balanceOf(borrower.address);
    pledgeAmount = ONE_ETH.mul(2);
    for (let i = 0; i < 99; i++) {
      totalLiquidity = await poolWethUsdc.getTotalLiquidity();
      //indicative repayment
      loanTerms = await poolWethUsdc.loanTerms(pledgeAmount);
      totalRepaymentsIndicative = totalRepaymentsIndicative.add(loanTerms[1]);
      //borrow
      await poolWethUsdc.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
      //actual repayment
      loanInfo = await poolWethUsdc.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      //interest costs
      totalInterestCosts = totalInterestCosts.add(loanTerms[1].sub(loanTerms[0]));
      //repay
      await poolWethUsdc.connect(borrower).repay(i+1, borrower.address, loanInfo.repayment);
    }
    await expect(totalRepaymentsIndicative).to.be.equal(totalRepayments);
    console.log("totalRepayments", totalRepayments)
    //total interest cost
    postBorrBal = await USDC.balanceOf(borrower.address);
    await expect(preBorrBal.sub(postBorrBal)).to.be.equal(totalInterestCosts);

    //lp1 claims individually
    preClaimBal = await USDC.balanceOf(lp1.address);
    loanIds = Array.from(Array(99), (_, index) => index + 1);
    await poolWethUsdc.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp1.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //cannot claim twice
    await expect(poolWethUsdc.connect(lp1).claimFromAggregated(lp1.address, [1, 100], false, timestamp+9999999)).to.be.reverted;
    
    //lp2 claims via aggregate
    benchmarkDiff = postClaimBal.sub(preClaimBal)
    preClaimBal = await USDC.balanceOf(lp2.address);
    await poolWethUsdc.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp2.address);
    diff = postClaimBal.sub(preClaimBal)
    await expect(benchmarkDiff).to.be.equal(diff);

    //cannot claim twice
    await expect(poolWethUsdc.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp+9999999)).to.be.reverted;

    //lp3 claims
    preClaimBal = await USDC.balanceOf(lp3.address);
    await poolWethUsdc.connect(lp3).claimFromAggregated(lp3.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp3.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    //lp4 claims
    preClaimBal = await USDC.balanceOf(lp4.address);
    await poolWethUsdc.connect(lp4).claimFromAggregated(lp4.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await USDC.balanceOf(lp4.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;
  });
  
  it("Should handle aggregate claims correctly (2/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(300000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await poolWethUsdc.connect(borrower).repay(1, borrower.address, loanInfo.repayment);

    //2nd borrow & repay
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await poolWethUsdc.connect(borrower).repay(2, borrower.address, loanInfo.repayment);

    //3rd borrow & default
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_ETH);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //lp1 claims
    console.log("totalRepayments", totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp1.address); //await ethers.provider.getBalance(lp1.address);
    preClaimTokenBal = await USDC.balanceOf(lp1.address);
    await expect(poolWethUsdc.connect(lp1).claimFromAggregated(lp1.address, [1, 3], false, timestamp+9999999)).to.be.reverted;
    await poolWethUsdc.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999);
    postClaimEthBal = await WETH.balanceOf(lp1.address); //ethers.provider.getBalance(lp1.address);
    postClaimTokenBal = await USDC.balanceOf(lp1.address);

    //WETH diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal);
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
    preClaimEthBal = await WETH.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    preClaimTokenBal = await USDC.balanceOf(lp2.address);
    await expect(poolWethUsdc.connect(lp2).claimFromAggregated(lp2.address, [1, 3], false, timestamp+9999999)).to.be.reverted;
    await poolWethUsdc.connect(lp2).claim(lp2.address, [1,2,3], false, timestamp+9999999);
    postClaimEthBal = await WETH.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    postClaimTokenBal = await USDC.balanceOf(lp2.address);

    //ETH diffs
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
    preClaimEthBal = await WETH.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    preClaimTokenBal = await USDC.balanceOf(lp3.address);
    await expect(poolWethUsdc.connect(lp3).claimFromAggregated(lp3.address, [1, 3], false, timestamp+9999999)).to.be.reverted;
    await poolWethUsdc.connect(lp3).claim(lp3.address, [1,2,3], false, timestamp+9999999);
    postClaimEthBal = await WETH.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    postClaimTokenBal = await USDC.balanceOf(lp3.address);

    //ETH diffs
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
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(10000000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(6000000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(4000000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    for (let i = 0; i < 3000; i++) {
      try {
        await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
        loanInfo = await poolWethUsdc.loanIdxToLoanInfo(i+1);
        totalRepayments = totalRepayments.add(loanInfo[0]);
        await poolWethUsdc.connect(borrower).repay(i+1, borrower.address, loanInfo.repayment);
      } catch(error) {
        console.log(i, error)
      }
    }

    for (let i = 0; i < 2999; i++) {
      try {
        await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
        loanInfo = await poolWethUsdc.loanIdxToLoanInfo(i+3001);
        totalLeftColl = totalLeftColl.add(loanInfo[1]);
      } catch(error) {
        console.log(i, error)
      }
    }

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //claim
    await poolWethUsdc.connect(lp1).claimFromAggregated(lp1.address, [0, 1000, 2000], false, timestamp+9999999);
    //await poolWethUsdc.connect(lp2).claimFromAggregated([0, 99,199, 299, 399, 499, 599, 699, 799, 899, 999], false, timestamp+9999999);
    await poolWethUsdc.connect(lp2).claimFromAggregated(lp2.address, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000], false, timestamp+9999999);
    await poolWethUsdc.connect(lp3).claimFromAggregated(lp3.address, [0, 1000, 2000, 3000, 4000, 5000], false, timestamp+9999999);

    //remove liquidity
    const lp1NumShares = await poolWethUsdc.getLpArrayInfo(lp1.address);
    const lp2NumShares = await poolWethUsdc.getLpArrayInfo(lp2.address);
    const lp3NumShares = await poolWethUsdc.getLpArrayInfo(lp3.address);

    await poolWethUsdc.connect(lp1).removeLiquidity(lp1.address, lp1NumShares.sharesOverTime[0]);
    await poolWethUsdc.connect(lp2).removeLiquidity(lp2.address, lp2NumShares.sharesOverTime[0]);
    await poolWethUsdc.connect(lp3).removeLiquidity(lp3.address, lp3NumShares.sharesOverTime[0]);

    balEth = await WETH.balanceOf(poolWethUsdc.address); //await ethers.provider.getBalance(poolWethUsdc.address);
    balTestToken = await USDC.balanceOf(poolWethUsdc.address);
    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    totalLpShares = await poolWethUsdc.totalLpShares();

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
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(300000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await poolWethUsdc.connect(borrower).repay(1, borrower.address, loanInfo.repayment);

    //2nd borrow & repay
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await poolWethUsdc.connect(borrower).repay(2, borrower.address, loanInfo.repayment);

    //3rd borrow & default
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_ETH);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //claim
    await poolWethUsdc.connect(lp1).claim(lp1.address, [1, 2, 3], false, timestamp+9999999);
    await poolWethUsdc.connect(lp2).claim(lp2.address, [1, 2, 3], false, timestamp+9999999);
    await poolWethUsdc.connect(lp3).claim(lp3.address, [1, 2, 3], false, timestamp+9999999);

    //remove liquidity
    const lp1NumShares = await poolWethUsdc.getLpArrayInfo(lp1.address);
    const lp2NumShares = await poolWethUsdc.getLpArrayInfo(lp2.address);
    const lp3NumShares = await poolWethUsdc.getLpArrayInfo(lp3.address);

    await poolWethUsdc.connect(lp1).removeLiquidity(lp1.address, lp1NumShares.sharesOverTime[0]);
    await poolWethUsdc.connect(lp2).removeLiquidity(lp2.address, lp2NumShares.sharesOverTime[0]);
    await poolWethUsdc.connect(lp3).removeLiquidity(lp3.address, lp3NumShares.sharesOverTime[0]);

    balEth = await WETH.balanceOf(poolWethUsdc.address); //await ethers.provider.getBalance(poolWethUsdc.address);
    balTestToken = await USDC.balanceOf(poolWethUsdc.address);
    console.log("balEth:", balEth);
    console.log("balTestToken:", balTestToken);

    //add liquidity with dust should automatically transfer
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(500000), timestamp+1000, 0);

    //check dust was transferred to treasury
    balTreasury = await USDC.balanceOf("0x1234567890000000000000000000000000000001");
    await expect(balTreasury).to.be.equal(MIN_LIQUIDITY);

    //check lp shares
    totalLpShares = await poolWethUsdc.totalLpShares();
    await expect(totalLpShares).to.be.equal(ONE_USDC.mul(500000));
  })

  it("Should never fall below MIN_LIQUIDITY", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(1001), timestamp+60, 0);

    //large borrow
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x152D02C7E14AF6800000",
    ]);
    await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH.mul(10000), 0, MAX_UINT128, timestamp+1000000000, 0);
    
    //check total liquidity & balance
    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    balance = await USDC.balanceOf(poolWethUsdc.address);
    console.log("totalLiquidity:", totalLiquidity);
    console.log("balance:", balance)
    expect(totalLiquidity).to.be.equal(balance);
    expect(totalLiquidity).to.be.gte(MIN_LIQUIDITY);
  })

  it("Should allow rolling over loan", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000), timestamp+60, 0);

    pledgeAmount = ONE_ETH;
    await poolWethUsdc.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(1);

    loanTerms = await poolWethUsdc.loanTerms(loanInfo.collateral);
    balTestTokenPre = await USDC.balanceOf(borrower.address);
    await poolWethUsdc.connect(borrower).rollOver(1, 0, MONE, timestamp+1000000000, 0);
    balTestTokenPost = await USDC.balanceOf(borrower.address);

    expRollCost = loanInfo.repayment.sub(loanTerms[0]);
    actRollCost = balTestTokenPre.sub(balTestTokenPost);
    expect(expRollCost).to.be.equal(actRollCost);
  })
  
  it("Shouldn't overflow even after 5x rounds of consecutive LPing with USDC 100mn and borrowing against 120,000,000 ETH", async function () {
    //large borrow
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x204FCE5E3E25026110000000",
    ]);

    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    pledgeAmount = ONE_ETH.mul(120000000);

    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await poolWethUsdc.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await poolWethUsdc.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(1);

    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    totalLpShares = await poolWethUsdc.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await poolWethUsdc.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await poolWethUsdc.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(2);

    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    totalLpShares = await poolWethUsdc.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await poolWethUsdc.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await poolWethUsdc.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(3);

    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    totalLpShares = await poolWethUsdc.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await poolWethUsdc.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await poolWethUsdc.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await poolWethUsdc.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(4);

    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    totalLpShares = await poolWethUsdc.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)


    await poolWethUsdc.connect(lp5).addLiquidity(lp5.address, ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await poolWethUsdc.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await poolWethUsdc.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolWethUsdc.loanIdxToLoanInfo(5);

    totalLiquidity = await poolWethUsdc.getTotalLiquidity();
    totalLpShares = await poolWethUsdc.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)
  })

  it("Should track loan index and share changes over time", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(60000000), timestamp+60, 0);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(40000000), timestamp+60, 0);
    await poolWethUsdc.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(100000000), timestamp+60, 0);

    let lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);

    /*
    * lp_1 : sharesOverTime: [100000000000000] loanIdxsWhereSharesChanged: []
    * lp_2 : sharesOverTime: [60000000000000] loanIdxsWhereSharesChanged: []
    * lp_3 : sharesOverTime: [40000000000000] loanIdxsWhereSharesChanged: []
    * lp_4 : sharesOverTime: [100000000000000] loanIdxsWhereSharesChanged: []
    **/

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    for (let i = 0; i < 130; i++) {
      try {
        await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
        loanInfo = await poolWethUsdc.loanIdxToLoanInfo(i+1);
        totalRepayments = totalRepayments.add(loanInfo[0]);
        await poolWethUsdc.connect(borrower).repay(i+1, borrower.address, loanInfo.repayment);
      } catch(error) {
        console.log(i, error)
      }
    }

    //update liquidity
    const initialLp1NumShares = await poolWethUsdc.getLpArrayInfo(lp1.address);
    const initialLp2NumShares = await poolWethUsdc.getLpArrayInfo(lp2.address);
    const initialLp3NumShares = await poolWethUsdc.getLpArrayInfo(lp3.address);
    const initialLp4NumShares = await poolWethUsdc.getLpArrayInfo(lp4.address);

    let totalLpShares = await poolWethUsdc.totalLpShares();
    await expect(initialLp1NumShares.sharesOverTime[0]).to.be.equal(totalLpShares.div(3));
    

    await poolWethUsdc.connect(lp1).removeLiquidity(lp1.address, initialLp1NumShares.sharesOverTime[0]/2);
    await poolWethUsdc.connect(lp2).removeLiquidity(lp2.address, initialLp2NumShares.sharesOverTime[0]);
    await poolWethUsdc.connect(lp3).addLiquidity(lp3.address, ONE_USDC.mul(40000000), timestamp+6000, 0);
    await poolWethUsdc.connect(lp4).removeLiquidity(lp4.address, initialLp4NumShares.sharesOverTime[0]);

    const secondLp1NumShares = await poolWethUsdc.getLpArrayInfo(lp1.address);
    const secondLp2NumShares = await poolWethUsdc.getLpArrayInfo(lp2.address);
    const secondLp3NumShares = await poolWethUsdc.getLpArrayInfo(lp3.address);
    const secondLp4NumShares = await poolWethUsdc.getLpArrayInfo(lp4.address);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * lp_2 : sharesOverTime: [60000000000000, 0] loanIdxsWhereSharesChanged: [131]
    * lp_3 : sharesOverTime: [40000000000000, 80017333063860] loanIdxsWhereSharesChanged: [131]
    * lp_4 : sharesOverTime: [100000000000000, 0] loanIdxsWhereSharesChanged: [131]
    **/

    await expect(secondLp1NumShares.sharesOverTime[1]).to.be.equal(secondLp1NumShares.sharesOverTime[0].div(2));
    await expect(secondLp1NumShares.loanIdxsWhereSharesChanged[0]).to.be.equal(131);

    for (let i = 0; i < 150; i++) {
      try {
        await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
        loanInfo = await poolWethUsdc.loanIdxToLoanInfo(i+131);
        totalRepayments = totalRepayments.add(loanInfo[0]);
        await poolWethUsdc.connect(borrower).repay(i+131, borrower.address, loanInfo.repayment);
      } catch(error) {
        console.log(i, error)
      }
    }

    //lp2 and lp4 add back in
    await poolWethUsdc.connect(lp2).addLiquidity(lp2.address, ONE_USDC.mul(50000000), timestamp+6000, 0);
    await poolWethUsdc.connect(lp4).addLiquidity(lp4.address, ONE_USDC.mul(100000000), timestamp+6000, 0);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * lp_2 : sharesOverTime: [60000000000000, 0, 50079450445941] loanIdxsWhereSharesChanged: [131, 281]
    * lp_3 : sharesOverTime: [40000000000000, 80025992304529] loanIdxsWhereSharesChanged: [131]
    * lp_4 : sharesOverTime: [60000000000000, 0, 100158900891883] loanIdxsWhereSharesChanged: [131, 281]
    **/

    const thirdLp2NumShares = await poolWethUsdc.getLpArrayInfo(lp2.address);
    const thirdLp4NumShares = await poolWethUsdc.getLpArrayInfo(lp4.address);
    await expect(thirdLp2NumShares.sharesOverTime.length).to.be.equal(3);
    await expect(thirdLp2NumShares.loanIdxsWhereSharesChanged.length).to.be.equal(2);
    await expect(thirdLp2NumShares.sharesOverTime[1]).to.be.equal(0);
    await expect(thirdLp2NumShares.loanIdxsWhereSharesChanged[0]).to.be.equal(131);
    await expect(thirdLp2NumShares.loanIdxsWhereSharesChanged[1]).to.be.equal(281);

    for (let i = 0; i < 100; i++) {
      try {
        await poolWethUsdc.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp+1000000000, 0);
        loanInfo = await poolWethUsdc.loanIdxToLoanInfo(i+281);
        totalLeftColl = totalLeftColl.add(loanInfo[1]);
      } catch(error) {
        console.log(i, error)
      }
    }

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    await expect(lp1Info.currSharePtr).to.be.equal(0);
    await expect(lp1Info.fromLoanIdx).to.be.equal(1);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * fromIndex : 1 , currSharePtr : 0
    **/

    await poolWethUsdc.connect(lp1).claimFromAggregated(lp1.address, [0, 100], false, timestamp+9999999);

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    await expect(lp1Info.currSharePtr).to.be.equal(0);
    await expect(lp1Info.fromLoanIdx).to.be.equal(100);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * fromIndex : 100 , currSharePtr : 0
    **/

    await expect(poolWethUsdc.connect(lp1).claimFromAggregated(lp1.address, [100, 200], false, timestamp+9999999)).to.be.revertedWith("LoanIdxsWithChangingShares()");
    await expect(poolWethUsdc.connect(lp1).claim(lp1.address, [98, 101, 102], false, timestamp+9999999)).to.be.revertedWith("UnentitledFromLoanIdx()");
    await expect(poolWethUsdc.connect(lp1).claim(lp1.address, [100, 103, 102], false, timestamp+9999999)).to.be.revertedWith("NonAscendingLoanIdxs()");

    await poolWethUsdc.connect(lp1).claim(lp1.address, [100, 103, 104, 105, 108, 112, 120], false, timestamp+9999999);

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    await expect(lp1Info.currSharePtr).to.be.equal(0);
    await expect(lp1Info.fromLoanIdx).to.be.equal(121);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * fromIndex : 121 , currSharePtr : 0
    **/

    await expect(poolWethUsdc.connect(lp1).claim(lp1.address, [122, 125, 126, 129, 130, 131], false, timestamp+9999999)).to.be.revertedWith("LoanIdxsWithChangingShares()");
    await poolWethUsdc.connect(lp1).claim(lp1.address, [122, 125, 126, 129, 130], false, timestamp+9999999);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * fromIndex : 131 , currSharePtr : 1
    **/

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    await expect(lp1Info.currSharePtr).to.be.equal(1);
    await expect(lp1Info.fromLoanIdx).to.be.equal(131);

    await expect(poolWethUsdc.connect(lp1).claimFromAggregated(lp1.address, [131, 200], false, timestamp+9999999)).to.be.revertedWith("InvalidSubAggregation()");
    await poolWethUsdc.connect(lp1).claim(lp1.address, [131, 135, 160, 189, 190, 199], false, timestamp+9999999);

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    await expect(lp1Info.currSharePtr).to.be.equal(1);
    await expect(lp1Info.fromLoanIdx).to.be.equal(200);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * fromIndex : 200 , currSharePtr : 1
    **/

    await poolWethUsdc.connect(lp1).claimFromAggregated(lp1.address, [200, 300], false, timestamp+9999999);

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    await expect(lp1Info.currSharePtr).to.be.equal(1);
    await expect(lp1Info.fromLoanIdx).to.be.equal(300);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * fromIndex : 300 , currSharePtr : 1
    **/

    const currLoanIdx = await poolWethUsdc.loanIdx();

    await expect(poolWethUsdc.connect(lp2).claim(lp1.address, [300, 310], false, timestamp+9999999)).to.be.revertedWith("InvalidSender()");
    await expect(poolWethUsdc.connect(lp1).claim(lp1.address, [300, 310, 330, 340, currLoanIdx], false, timestamp+9999999)).to.be.revertedWith("LoanIdxsWithChangingShares()");
    
    await poolWethUsdc.connect(lp1).claim(lp1.address, [300, 310, 330, 340, currLoanIdx - 1], false, timestamp+9999999);

    /*
    * global loanIdx = 381
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * fromIndex : 381 , currSharePtr : 1
    **/

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    await expect(lp1Info.currSharePtr).to.be.equal(1);
    await expect(lp1Info.fromLoanIdx).to.be.equal(currLoanIdx);

    await poolWethUsdc.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(40000000), timestamp + 60*60*24*365 + 900, 0);

    /*
    * global loanIdx = 381
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000, 90094550406881] loanIdxsWhereSharesChanged: [131, 381]
    * fromIndex : 381 , currSharePtr : 2
    **/

    lp1Info = await poolWethUsdc.addrToLpInfo(lp1.address);
    const thirdLp1NumShares = await poolWethUsdc.getLpArrayInfo(lp1.address);
    await expect(thirdLp1NumShares.loanIdxsWhereSharesChanged[1]).to.be.equal(currLoanIdx)
    await expect(lp1Info.currSharePtr).to.be.equal(2);
    await expect(lp1Info.fromLoanIdx).to.be.equal(currLoanIdx);

    //Now let lp2 go since he went down to 0

    await poolWethUsdc.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp+9999999);

    let lp2Info = await poolWethUsdc.addrToLpInfo(lp2.address);
    await expect(lp2Info.currSharePtr).to.be.equal(0);
    await expect(lp2Info.fromLoanIdx).to.be.equal(100);

    await poolWethUsdc.connect(lp2).claim(lp2.address, [102, 122, 125, 126, 129, 130], false, timestamp+9999999);

    lp2Info = await poolWethUsdc.addrToLpInfo(lp2.address);
    await expect(lp2Info.currSharePtr).to.be.equal(1);
    await expect(lp2Info.fromLoanIdx).to.be.equal(131);

    /*
    * lp_2 : sharesOverTime: [60000000000000, 0, 50079450445941] loanIdxsWhereSharesChanged: [131, 281]
    * fromIndex : 131 , currSharePtr : 1
    **/

    //should not allow claiming at 0, since will try to pop share pointer forward
    await expect(poolWethUsdc.connect(lp2).claim(lp2.address, [131, 140, 250], false, timestamp+9999999)).to.be.revertedWith("UnentitledFromLoanIdx()");

    //should be able to claim starting at the loan indices after the 0 position
    await poolWethUsdc.connect(lp2).claim(lp2.address, [281, 290, currLoanIdx - 1], false, timestamp+9999999);
    
    lp2Info = await poolWethUsdc.addrToLpInfo(lp2.address);
    await expect(lp2Info.currSharePtr).to.be.equal(2);
    await expect(lp2Info.fromLoanIdx).to.be.equal(currLoanIdx);

    /*
    * lp_1 : sharesOverTime: [100000000000000, 50000000000000] loanIdxsWhereSharesChanged: [131]
    * lp_2 : sharesOverTime: [60000000000000, 0, 50079450445941] loanIdxsWhereSharesChanged: [131, 281]
    * lp_3 : sharesOverTime: [40000000000000, 80025992304529] loanIdxsWhereSharesChanged: [131]
    * lp_4 : sharesOverTime: [60000000000000, 0, 100158900891883, 0] loanIdxsWhereSharesChanged: [131, 281, 381]
    **/


    await poolWethUsdc.connect(lp4).removeLiquidity(lp4.address, thirdLp4NumShares.sharesOverTime[2]);

    const fourthLp4NumShares = await poolWethUsdc.getLpArrayInfo(lp4.address);
    let lp4Info = await poolWethUsdc.addrToLpInfo(lp4.address);
    await expect(lp4Info.currSharePtr).to.be.equal(0);
    await expect(lp4Info.fromLoanIdx).to.be.equal(1);
    await expect(fourthLp4NumShares.sharesOverTime.length).to.be.equal(4);

    //Now let lp4 go since he went down to 0 and then back up again and down

    await expect(poolWethUsdc.connect(lp4).claim(lp4.address, [0, 130], false, timestamp+9999999)).to.be.revertedWith("InvalidLoanIdx()");

    await poolWethUsdc.connect(lp4).claim(lp4.address, [1, 130], false, timestamp+9999999);
    lp4Info = await poolWethUsdc.addrToLpInfo(lp4.address);
    await expect(lp4Info.currSharePtr).to.be.equal(1);
    await expect(lp4Info.fromLoanIdx).to.be.equal(131);

    /*
    * lp_4 : sharesOverTime: [60000000000000, 0, 100158900891883, 0] loanIdxsWhereSharesChanged: [131, 281, 381]
    * fromIndex : 131 , currSharePtr : 1
    **/

    //should be able to claim starting at the loan indices after the 0 position and then should increment share pointer again
    await poolWethUsdc.connect(lp4).claim(lp4.address, [281, 290, currLoanIdx - 1], false, timestamp+9999999);

    lp4Info = await poolWethUsdc.addrToLpInfo(lp4.address);
    await expect(lp4Info.currSharePtr).to.be.equal(3);
    await expect(lp4Info.fromLoanIdx).to.be.equal(currLoanIdx);

  })
});
