require("dotenv").config();
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PAXG-AUSDC Pool Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_PAXG = MONE;
  const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const USDC_WHALE = "0x0a59649758aa4d66e25f08dd01271e891fe52199";
  const AAVE_POOL_ADDR = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
  const AUSDC_ADDR = "0xBcca60bB61934080951369a648Fb03DF4F96263C";
  const PAXG_ADDR = "0x45804880De22913dAFE09f4980848ECE6EcbAf78";
  const PAXG_SUPPLY_CONTROLLER = "0xE25a329d385f77df5D4eD56265babe2b99A5436e";

  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _tvl1 = ONE_USDC.mul(100000);
  const _tvl2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.mul(300);
  const MIN_LIQUIDITY = ONE_USDC.mul(100);
  const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";

  beforeEach( async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
          },
        },
      ],
    });
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();

    USDC = await ethers.getContractAt(IERC20_SOURCE, USDC_ADDR);
    await ethers.provider.send("hardhat_setBalance", [
      USDC_WHALE,
      "0x56BC75E2D63100000",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_WHALE],
    });
    usdcWhale = await ethers.getSigner(USDC_WHALE);
    whaleUsdcBalance = await USDC.balanceOf(usdcWhale.address);
    if(whaleUsdcBalance.toString() != "0") 
    console.log("whaleUsdcBalance:", whaleUsdcBalance);

    AAVE_POOL = await ethers.getContractAt("ILendingPool", AAVE_POOL_ADDR);
    await USDC.connect(usdcWhale).approve(AAVE_POOL_ADDR, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    await AAVE_POOL.connect(usdcWhale).deposit(USDC_ADDR, whaleUsdcBalance, usdcWhale.address, 0);

    AUSDC = await ethers.getContractAt("IAToken", AUSDC_ADDR);
    whaleUsdcBalance = await USDC.balanceOf(usdcWhale.address);
    whaleAusdcBalance = await AUSDC.balanceOf(usdcWhale.address);
    console.log("whaleUsdcBalance:", whaleUsdcBalance);
    console.log("whaleAusdcBalance:", whaleAusdcBalance);
    await AUSDC.connect(usdcWhale).transfer(lp1.address, whaleAusdcBalance.div(6));
    await AUSDC.connect(usdcWhale).transfer(lp2.address, whaleAusdcBalance.div(6));
    await AUSDC.connect(usdcWhale).transfer(lp3.address, whaleAusdcBalance.div(6));
    await AUSDC.connect(usdcWhale).transfer(lp4.address, whaleAusdcBalance.div(6));
    await AUSDC.connect(usdcWhale).transfer(lp5.address, whaleAusdcBalance.div(6));
    await AUSDC.connect(usdcWhale).transfer(borrower.address, whaleAusdcBalance.div(6));

    PAXG = await ethers.getContractAt("IPAXG", PAXG_ADDR);
    await ethers.provider.send("hardhat_setBalance", [
      PAXG_SUPPLY_CONTROLLER,
      "0x56BC75E2D63100000",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [PAXG_SUPPLY_CONTROLLER],
    });
    paxgSupplyController = await ethers.getSigner(PAXG_SUPPLY_CONTROLLER);

    await PAXG.connect(paxgSupplyController).increaseSupply("800000000000000000000000000");
    await PAXG.connect(paxgSupplyController).transfer(borrower.address, "800000000000000000000000000");

    PoolPaxg = await ethers.getContractFactory("PoolPaxgAusdc");
    PoolPaxg = await PoolPaxg.connect(deployer);

    paxgPool = await PoolPaxg.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2, _tvl1, _tvl2, _minLoan, 100);
    await paxgPool.deployed();

    PAXG.connect(borrower).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    AUSDC.connect(lp1).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    AUSDC.connect(lp2).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    AUSDC.connect(lp3).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    AUSDC.connect(lp4).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    AUSDC.connect(lp5).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    AUSDC.connect(borrower).approve(paxgPool.address, "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

    scaledBalanceOf = await AUSDC.connect(lp1).scaledBalanceOf(lp1.address);
    console.log("scaledBalanceOf lp1: ", scaledBalanceOf)
  });
  /*
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
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(1111), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(10111), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(130111), timestamp+60, 0);
    totalLiquidity = await paxgPool.getTotalLiquidity();
    console.log("totalLiquidity: ", totalLiquidity)
    await expect(totalLiquidity).to.be.equal(ONE_USDC.mul(141333));
  });
  
  it("Should allow borrowing with PAXG", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(10000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);

    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await paxgPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+60, 0);
  });
  
  it("Should not allow new LPs to claim on unentitled previous loans", async function () {
    //add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(30000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(20000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(10000), timestamp+60, 0);

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
    await paxgPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await paxgPool.connect(borrower).repay(1);

    //borrow & repay
    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await paxgPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await paxgPool.connect(borrower).repay(2);

    //borrow & default
    loanTerms = await paxgPool.loanTerms(ONE_PAXG);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await paxgPool.connect(borrower).borrow(ONE_PAXG, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //claim
    await paxgPool.connect(lp1).claim([1,2,3], false, timestamp+9999999);
    //cannot claim twice
    await expect(paxgPool.connect(lp1).claim([1,2,3], false, timestamp+9999999)).to.be.reverted;

    //remove liquidity
    let lp1NumSharesPre = await paxgPool.getNumShares(lp1.address);
    await paxgPool.connect(lp1).removeLiquidity(lp1NumSharesPre);
    
    //cannot remove twice
    await expect(paxgPool.connect(lp1).removeLiquidity(lp1NumSharesPre)).to.be.reverted;

    lp1NumSharesPost = await paxgPool.getNumShares(lp1.address);
    await expect(lp1NumSharesPost).to.be.equal(0);

    //ensure new lp cannot claim on previous loan
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp4).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);
    await expect(paxgPool.connect(lp4).claim([1], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim([2], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim([3], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim([1,2], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim([2,3], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim([1,3], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp4).claim([1,2,3], false, timestamp+9999999)).to.be.reverted;
  });
  
  it("Should be possible to borrow when there's sufficient liquidity, and allow new LPs to add liquidity to make borrowing possible again", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);

    // iteratively take out borrows until until liquidity so low that loan amount below min. loan
    numBorrows = 0;
    tooSmallLoans = false;
    for (let i = 0; i < 100; i++) {
      try {
        loanTerms = await paxgPool.loanTerms(ONE_PAXG);
        await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
        numBorrows += 1;
        console.log("loanTerms: ", loanTerms);
      } catch(error) {
        console.log("loanTerms error: ", error);
        await expect(paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0)).to.be.revertedWith('TooSmallLoan');
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
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(1000), timestamp+60, 0);

    // take out a loan should be possible again without revert after liquidity add
    await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
  });
  
  it("Should allow LPs to claim individually test", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);

    for (let i = 0; i < 100; i++) {
      totalLiquidity = await paxgPool.getTotalLiquidity();
      loanTerms = await paxgPool.loanTerms(ONE_PAXG);
      await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      await paxgPool.connect(borrower).repay(i+1);
    }
    loanIds = Array.from(Array(100), (_, index) => index + 1);

    await paxgPool.connect(lp1).claim(loanIds, false, timestamp+9999999);
    //cannot claim twice
    await expect(paxgPool.connect(lp1).claim(loanIds, false, timestamp+9999999)).to.be.reverted;

    await paxgPool.connect(lp2).claim(loanIds, false, timestamp+9999999);
    await paxgPool.connect(lp3).claim(loanIds, false, timestamp+9999999);
  });

  it("Should handle aggregate claims correctly (1/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp4).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepaymentsIndicative = ethers.BigNumber.from(0);
    totalRepayments = ethers.BigNumber.from(0);
    totalInterestCosts = ethers.BigNumber.from(0);

    //get LP bal for aToken yield reference
    preLpBal = await AUSDC.balanceOf(lp5.address);

    preBorrBal = await usdc.balanceOf(borrower.address);
    sendAmount = ONE_PAXG.mul(2);
    for (let i = 0; i < 99; i++) {
      totalLiquidity = await paxgPool.getTotalLiquidity();
      //indicative repayment
      transferFee = await PAXG.getFeeFor(sendAmount);
      inAmount = sendAmount.sub(transferFee);
      loanTerms = await paxgPool.loanTerms(inAmount);
      totalRepaymentsIndicative = totalRepaymentsIndicative.add(loanTerms[1]);
      //borrow
      await paxgPool.connect(borrower).borrow(sendAmount, 0, MONE, timestamp+1000000000, 0);
      //actual repayment
      loanInfo = await paxgPool.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      //interest costs
      totalInterestCosts = totalInterestCosts.add(loanTerms[1].sub(loanTerms[0]));
      //repay
      await paxgPool.connect(borrower).repay(i+1);
    }
    //get LP bal for aToken yield reference
    postLpBal = await AUSDC.balanceOf(lp5.address);

    postBorrBal = await AUSDC.balanceOf(borrower.address);

    //check indicative total repayments close to actual repayments
    await expect(totalRepaymentsIndicative).to.be.equal(totalRepayments);

    //check total interest cost
    balDiff = preBorrBal.sub(postBorrBal);
    balDiffAdj = preBorrBal.sub(postBorrBal.mul(preLpBal).div(postLpBal));
    console.log("totalInterestCosts", totalInterestCosts)
    console.log("balDiff", balDiff)
    console.log("balDiffAdj", balDiffAdj)
    pct = balDiffAdj.mul(10000).div(totalInterestCosts)
    console.log(pct)
    await expect((9990 <= pct) && (pct <= 10010)).to.be.true;

    //lp1 claims individually
    preClaimBal = await AUSDC.balanceOf(lp1.address);
    loanIds = Array.from(Array(99), (_, index) => index + 1);
    await paxgPool.connect(lp1).claim(loanIds, false, timestamp+9999999);
    postClaimBal = await AUSDC.balanceOf(lp1.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    //cannot claim twice
    await expect(paxgPool.connect(lp1).claimFromAggregated([0, 99], false, timestamp+9999999)).to.be.reverted;

    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //lp2 claims via aggregate
    benchmarkDiff = postClaimBal.sub(preClaimBal)
    preClaimBal = await AUSDC.balanceOf(lp2.address);
    await expect(paxgPool.connect(lp2).claimFromAggregated([1, 99], false, timestamp+9999999)).to.be.reverted;
    await paxgPool.connect(lp2).claimFromAggregated([0, 99], false, timestamp+9999999);
    postClaimBal = await AUSDC.balanceOf(lp2.address);
    diff = postClaimBal.sub(preClaimBal)
    pct = benchmarkDiff.mul(10000).div(diff)
    await expect(9999 <= pct && pct <= 10001).to.be.true;

    //cannot claim twice
    await expect(paxgPool.connect(lp2).claimFromAggregated([0, 99], false, timestamp+9999999)).to.be.reverted;

    //lp3 claims
    preClaimBal = await AUSDC.balanceOf(lp3.address);
    await paxgPool.connect(lp3).claimFromAggregated([0, 99], false, timestamp+9999999);
    postClaimBal = await AUSDC.balanceOf(lp3.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    //lp4 claims
    preClaimBal = await AUSDC.balanceOf(lp4.address);
    await paxgPool.connect(lp4).claimFromAggregated([0, 99], false, timestamp+9999999);
    postClaimBal = await AUSDC.balanceOf(lp4.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;
  });

  it("Should handle aggregate claims correctly (2/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(1);

    //2nd borrow & repay
    await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(2);

    //3rd borrow & default
    await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_PAXG);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //lp1 claims
    preClaimEthBal = await PAXG.balanceOf(lp1.address); //await ethers.provider.getBalance(lp1.address);
    preClaimTokenBal = await AUSDC.balanceOf(lp1.address);
    await expect(paxgPool.connect(lp1).claimFromAggregated([1, 3], false, timestamp+9999999)).to.be.reverted;
    await paxgPool.connect(lp1).claim([1,2,3], false, timestamp+9999999);
    postClaimEthBal = await PAXG.balanceOf(lp1.address); //ethers.provider.getBalance(lp1.address);
    postClaimTokenBal = await AUSDC.balanceOf(lp1.address);

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
    preClaimTokenBal = await AUSDC.balanceOf(lp2.address);
    await paxgPool.connect(lp2).claim([1, 2, 3], false, timestamp+9999999);
    postClaimEthBal = await PAXG.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    postClaimTokenBal = await AUSDC.balanceOf(lp2.address);

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
    preClaimTokenBal = await AUSDC.balanceOf(lp3.address);
    await expect(paxgPool.connect(lp3).claimFromAggregated([1, 3], false, timestamp+9999999)).to.be.reverted;
    await paxgPool.connect(lp3).claim([1, 2, 3], false, timestamp+9999999);
    postClaimEthBal = await PAXG.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    postClaimTokenBal = await AUSDC.balanceOf(lp3.address);

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
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    for (let i = 0; i < 100; i++) {
      await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      loanInfo = await paxgPool.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      await paxgPool.connect(borrower).repay(i+1);
    }

    for (let i = 0; i < 99; i++) {
      await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
      loanInfo = await paxgPool.loanIdxToLoanInfo(i+101);
      totalRepayments = totalRepayments.add(loanInfo[0]);
    }

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //aggregate only allowed per 100 loans or multiples of 1000 not per 200
    await expect(paxgPool.connect(lp1).claimFromAggregated([0, 199], false, timestamp+9999999)).to.be.reverted;
    await expect(paxgPool.connect(lp2).claimFromAggregated([1, 99, 199], false, timestamp+9999999)).to.be.reverted;

    //claim
    await paxgPool.connect(lp1).claimFromAggregated([0, 99, 199], false, timestamp+9999999);
    await paxgPool.connect(lp2).claimFromAggregated([0, 99, 199], false, timestamp+9999999);

    //remove liquidity
    const lp1NumShares = await paxgPool.getNumShares(lp1.address);
    const lp2NumShares = await paxgPool.getNumShares(lp2.address);
    const lp3NumShares = await paxgPool.getNumShares(lp3.address);

    await paxgPool.connect(lp1).removeLiquidity(lp1NumShares);
    await paxgPool.connect(lp2).removeLiquidity(lp2NumShares);
    await paxgPool.connect(lp3).removeLiquidity(lp3NumShares);

    balEth = await PAXG.balanceOf(paxgPool.address); //await ethers.provider.getBalance(paxgPool.address);
    balTestToken = await AUSDC.balanceOf(paxgPool.address);
    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();

    pct = totalLiquidity.mul(10000).div(MIN_LIQUIDITY);
    await expect(9999 <= pct && pct <= 10001).to.be.true;
    await expect(totalLpShares).to.be.equal(0);
    console.log("(2/2) balEth:", balEth);
    console.log("(2/2) balTestToken:", balTestToken);
    console.log("(2/2) totalLiquidity:", totalLiquidity);
    console.log("(2/2) totalLpShares:", totalLpShares);
  })

  it("Should allow large aggregations of claiming and removing", async function (){
      blocknum = await ethers.provider.getBlockNumber();
      timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
      await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(10000000), timestamp+60, 0);
      await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(6000000), timestamp+60, 0);
      await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(4000000), timestamp+60, 0);
  
      totalRepayments = ethers.BigNumber.from(0);
      totalLeftColl = ethers.BigNumber.from(0);
  
      for (let i = 0; i < 2000; i++) {
        await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
        loanInfo = await paxgPool.loanIdxToLoanInfo(i+1);
        totalRepayments = totalRepayments.add(loanInfo[0]);
        await paxgPool.connect(borrower).repay(i+1);
      }
  
      for (let i = 0; i < 1999; i++) {
        await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
        loanInfo = await paxgPool.loanIdxToLoanInfo(i+2001);
        totalRepayments = totalRepayments.add(loanInfo[0]);
      }
  
      //move forward to loan expiry
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
      await ethers.provider.send("evm_mine");

      //cannot claim on unless proper starting and ending values
      await expect(paxgPool.connect(lp1).claimFromAggregated([0, 99, 1099], false, timestamp+9999999)).to.be.reverted;
      await expect(paxgPool.connect(lp1).claimFromAggregated([0, 999, 1099, 1199, 1299, 2299], false, timestamp+9999999)).to.be.reverted;
      await expect(paxgPool.connect(lp1).claimFromAggregated([0, 9999], false, timestamp+9999999)).to.be.reverted;

      //claim
      await paxgPool.connect(lp1).claimFromAggregated([0, 999, 1999], false, timestamp+9999999);
      //await paxgPool.connect(lp2).claimFromAggregated([0, 99,199, 299, 399, 499, 599, 699, 799, 899, 999], false, timestamp+9999999);
      await paxgPool.connect(lp2).claimFromAggregated([0, 99, 199, 299, 399, 499, 599, 699, 799, 899, 999, 1999, 2999, 3999], false, timestamp+9999999);
      await paxgPool.connect(lp3).claimFromAggregated([0, 999, 1099, 1199, 1299, 1399, 1499, 1599, 1699, 1799, 1899, 1999, 2999, 3999], false, timestamp+9999999);
  })

  it("Should allow adding liquidity again after removing and claiming", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+60, 0);
    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(300000), timestamp+60, 0);
    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(1);

    //2nd borrow & repay
    await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await paxgPool.connect(borrower).repay(2);

    //3rd borrow & default
    await paxgPool.connect(borrower).borrow(ONE_PAXG, 0, MONE, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_PAXG);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //claim
    await paxgPool.connect(lp1).claim([1, 2, 3], false, timestamp+9999999);
    await paxgPool.connect(lp2).claim([1, 2, 3], false, timestamp+9999999);
    await paxgPool.connect(lp3).claim([1, 2, 3], false, timestamp+9999999);

    //remove liquidity
    const lp1NumShares = await paxgPool.getNumShares(lp1.address);
    const lp2NumShares = await paxgPool.getNumShares(lp2.address);
    const lp3NumShares = await paxgPool.getNumShares(lp3.address);

    await paxgPool.connect(lp1).removeLiquidity(lp1NumShares);
    await paxgPool.connect(lp2).removeLiquidity(lp2NumShares);
    await paxgPool.connect(lp3).removeLiquidity(lp3NumShares);

    balEth = await PAXG.balanceOf(paxgPool.address); //await ethers.provider.getBalance(paxgPool.address);
    balTestToken = await AUSDC.balanceOf(paxgPool.address);
    console.log("balEth:", balEth);
    console.log("balTestToken:", balTestToken);

    //add liquidity with dust should automatically transfer
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(500000), timestamp+1000, 0);

    //check dust was transferred to treasury
    balTreasury = await AUSDC.balanceOf("0x1234567890000000000000000000000000000001");
    pct = balTreasury.mul(10000).div(MIN_LIQUIDITY);
    await expect(9999 <= pct && pct <= 10001).to.be.true;

    //check lp shares
    totalLpShares = await paxgPool.totalLpShares();
    await expect(totalLpShares).to.be.equal(ONE_USDC.mul(500000));
  })

  it("Should never fall below MIN_LIQUIDITY", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(1001), timestamp+60, 0);

    await paxgPool.connect(borrower).borrow(ONE_PAXG.mul(10000), 0, MONE, timestamp+1000000000, 0);
    
    //check total liquidity & balance
    totalLiquidity = await paxgPool.getTotalLiquidity();
    balance = await AUSDC.balanceOf(paxgPool.address);
    console.log("totalLiquidity:", totalLiquidity);
    console.log("balance:", balance)
    expect(totalLiquidity).to.be.equal(balance);
    expect(totalLiquidity).to.be.gte(MIN_LIQUIDITY);
  })

  it("Should allow rolling over loan", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000), timestamp+60, 0);

    pledgeAmount = ONE_PAXG;
    await paxgPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);

    loanTerms = await paxgPool.loanTerms(loanInfo.collateral);
    balTestTokenPre = await AUSDC.balanceOf(borrower.address);
    await paxgPool.connect(borrower).rollOver(1, 0, MONE, timestamp+1000000000, 0);
    balTestTokenPost = await AUSDC.balanceOf(borrower.address);

    expRollCost = loanInfo.repayment.sub(loanTerms[0]);
    actRollCost = balTestTokenPre.sub(balTestTokenPost);
    pct = expRollCost.mul(10000).div(actRollCost)
    expect(9999 <= pct && pct <= 10001).to.be.true;
  })

  it("Shouldn't overflow even after 5x rounds of LPing USDC 100mn and borrowing against 100,000,000 PAXG", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    pledgeAmount = ONE_PAXG.mul(100000000);

    await paxgPool.connect(lp1).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(1);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await paxgPool.connect(lp2).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(2);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await paxgPool.connect(lp3).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(3);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await paxgPool.connect(lp4).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(4);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)


    await paxgPool.connect(lp5).addLiquidity(ONE_USDC.mul(100000000), timestamp+1000000000, 0);
    loanTerms = await paxgPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await paxgPool.connect(borrower).borrow(pledgeAmount, 0, MONE, timestamp+1000000000, 0);
    loanInfo = await paxgPool.loanIdxToLoanInfo(5);

    totalLiquidity = await paxgPool.getTotalLiquidity();
    totalLpShares = await paxgPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)
  })*/
});
