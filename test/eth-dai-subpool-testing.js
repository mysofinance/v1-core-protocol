const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ETH-DAI SubPool Testing", function () {

  const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_DAI = MONE;
  const ONE_ETH = MONE;
  const _loanCcyToken = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const _collCcyToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_DAI.mul(500);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _tvl1 = ONE_DAI.mul(100000);
  const _tvl2 = ONE_DAI.mul(1000000);
  const _minLoan = ONE_DAI.mul(300);
  const MIN_LIQUIDITY = ethers.BigNumber.from("100000000"); //100*10**6
  const DAI_HOLDER = "0x6c6bc977e13df9b0de53b251522280bb72383700";
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();

    DAI = await ethers.getContractAt(IERC20_SOURCE, _loanCcyToken);
    await ethers.provider.send("hardhat_setBalance", [
      DAI_HOLDER,
      "0x56BC75E2D63100000",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_HOLDER],
    });
    daiHolder = await ethers.getSigner(DAI_HOLDER);
    bal = await DAI.balanceOf(DAI_HOLDER);
    await DAI.connect(daiHolder).transfer(lp1.address, bal.div(6));
    await DAI.connect(daiHolder).transfer(lp2.address, bal.div(6));
    await DAI.connect(daiHolder).transfer(lp3.address, bal.div(6));
    await DAI.connect(daiHolder).transfer(lp4.address, bal.div(6));
    await DAI.connect(daiHolder).transfer(lp5.address, bal.div(6));
    await DAI.connect(daiHolder).transfer(borrower.address, bal.div(6));

    WETH = await ethers.getContractAt("IWETH", _collCcyToken);

    SubPool = await ethers.getContractFactory("SubPoolV1");
    SubPool = await SubPool.connect(deployer);

    subPool = await SubPool.deploy(_loanCcyToken, _collCcyToken, _loanTenor, _maxLoanPerColl, _r1, _r2, _tvl1, _tvl2, _minLoan, 100);

    await subPool.deployed();

    DAI.connect(lp1).approve(subPool.address, MAX_UINT128);
    DAI.connect(lp2).approve(subPool.address, MAX_UINT128);
    DAI.connect(lp3).approve(subPool.address, MAX_UINT128);
    DAI.connect(lp4).approve(subPool.address, MAX_UINT128);
    DAI.connect(lp5).approve(subPool.address, MAX_UINT128);
    DAI.connect(borrower).approve(subPool.address, MAX_UINT128);
  });
  
  it("Should have sufficient DAI for testing", async function () {
    bal = await DAI.balanceOf(lp1.address);
    expect((await bal).gt(ONE_DAI.mul(80000000))).to.be.true; //make sure each lp account has at least 80mn for testing
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
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(1111), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(10111), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(130111), timestamp+60, 0);
    totalLiquidity = await subPool.totalLiquidity();
    expect(totalLiquidity).to.be.equal(ONE_DAI.mul(141333));
  });

  it("Should not allow adding liquidity if already active LP", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(1000), timestamp+60, 0);
    await expect(subPool.loanTerms(subPool.connect(lp1).addLiquidity(ONE_DAI.mul(1000), timestamp+60, 0))).to.be.reverted;
  });

  it("Should allow borrowing with ETH", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(1000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(10000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(100000), timestamp+60, 0);

    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await subPool.connect(borrower).borrow(0, minLoanLimit, maxRepayLimit, timestamp+60, 0, {value: ONE_ETH});
  });

  it("Should revert when borrowing with inconsistent ETH msg.value", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(1000), timestamp+60, 0);

    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    currBlock = await ethers.provider.getBlockNumber();
    await expect(subPool.connect(borrower).borrow(ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60, {value: ONE_ETH})).to.be.reverted;
    await expect(subPool.connect(borrower).borrow(0, minLoanLimit, maxRepayLimit, timestamp+60, {value: 0})).to.be.reverted;
  });
  
  it("Should not allow new LPs to claim on unentitled previous loans", async function () {
    //add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(30000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(20000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(10000), timestamp+60, 0);

    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;

    //borrow & repay
    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await subPool.connect(borrower).borrow(0, minLoanLimit, maxRepayLimit, timestamp+9999999, 0, {value: ONE_ETH});
    await subPool.connect(borrower).repay(1);

    //borrow & repay
    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await subPool.connect(borrower).borrow(0, minLoanLimit, maxRepayLimit, timestamp+9999999, 0, {value: ONE_ETH});
    await subPool.connect(borrower).repay(2);

    //borrow & default
    loanTerms = await subPool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await subPool.connect(borrower).borrow(0, minLoanLimit, maxRepayLimit, timestamp+9999999, 0, {value: ONE_ETH});

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
    await subPool.connect(lp4).addLiquidity(ONE_DAI.mul(1000), timestamp+60, 0);
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
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(1000), timestamp+60, 0);

    for (let i = 0; i < 7; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_ETH);
      if(loanTerms[0].sub(_minLoan).gte(MONE.mul(0))) {
        await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
      } else {
        await expect(subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH})).to.be.reverted;
        break;
      }
      console.log("totalLiquidity: ", totalLiquidity);
      console.log("loanTerms: ", loanTerms);
    }

    console.log("--------------------------------------------------------")
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(1000), timestamp+60, 0);
    for (let i = 0; i < 7; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_ETH);
      if(loanTerms[0].sub(_minLoan).gte(MONE.mul(0))) {
        await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
      } else {
        await expect(subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH})).to.be.reverted;
        break;
      }
      console.log("totalLiquidity: ", totalLiquidity);
      console.log("loanTerms: ", loanTerms);
    }
    await expect(subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH})).to.be.reverted;
  });

  it("Should allow LPs to claim individually", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(100000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(100000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(100000), timestamp+60, 0);

    for (let i = 0; i < 100; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      loanTerms = await subPool.loanTerms(ONE_ETH);
      await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
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
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(500000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(300000), timestamp+60, 0);
    await subPool.connect(lp4).addLiquidity(ONE_DAI.mul(200000), timestamp+60, 0);

    totalRepaymentsIndicative = ethers.BigNumber.from(0);
    totalRepayments = ethers.BigNumber.from(0);
    totalInterestCosts = ethers.BigNumber.from(0);
    preBorrBal = await DAI.balanceOf(borrower.address);
    pledgeAmount = ONE_ETH.mul(2);

    for (let i = 0; i < 99; i++) {
      totalLiquidity = await subPool.totalLiquidity();
      //indicative repayment
      loanTerms = await subPool.loanTerms(pledgeAmount);
      totalRepaymentsIndicative = totalRepaymentsIndicative.add(loanTerms[1]);
      //borrow
      await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: pledgeAmount});
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
    postBorrBal = await DAI.balanceOf(borrower.address);
    await expect(preBorrBal.sub(postBorrBal)).to.be.equal(totalInterestCosts);

    //lp1 claims individually
    preClaimBal = await DAI.balanceOf(lp1.address);
    loanIds = Array.from(Array(99), (_, index) => index + 1);

    await subPool.connect(lp1).claim(loanIds);
    postClaimBal = await DAI.balanceOf(lp1.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(10000).div(actClaim)
    await expect((10000 <= pct) && (pct <= 10010)).to.be.true;

    //cannot claim twice
    await expect(subPool.connect(lp1).claimFromAggregated(0, [99])).to.be.reverted;

    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //lp2 claims via aggregate
    benchmarkDiff = postClaimBal.sub(preClaimBal)
    preClaimBal = await DAI.balanceOf(lp2.address);
    await subPool.connect(lp2).claimFromAggregated(0, [99]);
    postClaimBal = await DAI.balanceOf(lp2.address);
    diff = postClaimBal.sub(preClaimBal)
    await expect(benchmarkDiff).to.be.equal(diff);

    //cannot claim twice
    await expect(subPool.connect(lp2).claimFromAggregated(0, [99])).to.be.reverted;

    //lp3 claims
    preClaimBal = await DAI.balanceOf(lp3.address);
    await subPool.connect(lp3).claimFromAggregated(0, [99]);
    postClaimBal = await DAI.balanceOf(lp3.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(10000).div(actClaim)
    await expect((10000 <= pct) && (pct <= 10010)).to.be.true;

    //lp4 claims
    preClaimBal = await DAI.balanceOf(lp4.address);
    await subPool.connect(lp4).claimFromAggregated(0, [99]);
    postClaimBal = await DAI.balanceOf(lp4.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(10000).div(actClaim)
    await expect((10000 <= pct) && (pct <= 10010)).to.be.true;
  });
  
  it("Should handle aggregate claims correctly (2/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(300000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
    loanInfo = await subPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(1);

    //2nd borrow & repay
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
    loanInfo = await subPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(2);

    //3rd borrow & default
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
    totalLeftColl = totalLeftColl.add(ONE_ETH);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    //lp1 claims
    console.log("totalRepayments", totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp1.address); //await ethers.provider.getBalance(lp1.address);
    preClaimTokenBal = await DAI.balanceOf(lp1.address);
    await expect(subPool.connect(lp1).claimFromAggregated(1, [3])).to.be.reverted;
    await subPool.connect(lp1).claim([1,2,3]);
    postClaimEthBal = await WETH.balanceOf(lp1.address); //ethers.provider.getBalance(lp1.address);
    postClaimTokenBal = await DAI.balanceOf(lp1.address);

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
    preClaimTokenBal = await DAI.balanceOf(lp2.address);
    await expect(subPool.connect(lp2).claimFromAggregated(1, [3])).to.be.reverted;
    await subPool.connect(lp2).claim([1,2,3]);
    postClaimEthBal = await WETH.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    postClaimTokenBal = await DAI.balanceOf(lp2.address);

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
    preClaimTokenBal = await DAI.balanceOf(lp3.address);
    await expect(subPool.connect(lp3).claimFromAggregated(1, [3])).to.be.reverted;
    await subPool.connect(lp3).claim([1,2,3]);
    postClaimEthBal = await WETH.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    postClaimTokenBal = await DAI.balanceOf(lp3.address);

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
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(300000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    for (let i = 0; i < 100; i++) {
      await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
      loanInfo = await subPool.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      await subPool.connect(borrower).repay(i+1);
    }

    for (let i = 0; i < 99; i++) {
      await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
      loanInfo = await subPool.loanIdxToLoanInfo(i+101);
      totalRepayments = totalRepayments.add(loanInfo[0]);
    }

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //claim
    await subPool.connect(lp1).claimFromAggregated(0, [99,199]);
    await subPool.connect(lp2).claimFromAggregated(0, [99,199]);

    //remove liquidity
    await subPool.connect(lp1).removeLiquidity();
    await subPool.connect(lp2).removeLiquidity();
    await subPool.connect(lp3).removeLiquidity();

    balEth = await WETH.balanceOf(subPool.address); //await ethers.provider.getBalance(subPool.address);
    balTestToken = await DAI.balanceOf(subPool.address);
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
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(500000), timestamp+60, 0);
    await subPool.connect(lp2).addLiquidity(ONE_DAI.mul(300000), timestamp+60, 0);
    await subPool.connect(lp3).addLiquidity(ONE_DAI.mul(200000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    //1st borrow & repay
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
    loanInfo = await subPool.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(1);

    //2nd borrow & repay
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
    loanInfo = await subPool.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await subPool.connect(borrower).repay(2);

    //3rd borrow & default
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH});
    totalLeftColl = totalLeftColl.add(ONE_ETH);

    //move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");
    
    //claim
    await subPool.connect(lp1).claim([1, 2, 3]);
    await subPool.connect(lp2).claim([1, 2, 3]);
    await subPool.connect(lp3).claim([1, 2, 3]);

    //remove liquidity
    await subPool.connect(lp1).removeLiquidity();
    await subPool.connect(lp2).removeLiquidity();
    await subPool.connect(lp3).removeLiquidity();

    balEth = await WETH.balanceOf(subPool.address); //await ethers.provider.getBalance(subPool.address);
    balTestToken = await DAI.balanceOf(subPool.address);
    console.log("balEth:", balEth);
    console.log("balTestToken:", balTestToken);

    //add liquidity with dust should automatically transfer
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(500000), timestamp+1000, 0);
    
    //check dust was transferred to treasury
    balTreasury = await DAI.balanceOf("0x1234567890000000000000000000000000000001");
    await expect(balTreasury).to.be.equal(MIN_LIQUIDITY);

    //check lp shares
    totalLpShares = await subPool.totalLpShares();
    await expect(totalLpShares).to.be.equal(ONE_DAI.mul(500000));
  })

  it("Should never fall below MIN_LIQUIDITY", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(1001), timestamp+60, 0);

    //large borrow
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x152D02C7E14AF6800000",
    ]);
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: ONE_ETH.mul(10000)});
    
    //check total liquidity & balance
    totalLiquidity = await subPool.totalLiquidity();
    balance = await DAI.balanceOf(subPool.address);
    console.log("totalLiquidity:", totalLiquidity);
    console.log("balance:", balance)
    expect(totalLiquidity).to.be.equal(balance);
    expect(totalLiquidity).to.be.gte(MIN_LIQUIDITY);
  })

  it("Should allow rolling over loan", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await subPool.connect(lp1).addLiquidity(ONE_DAI.mul(100000), timestamp+60, 0);

    pledgeAmount = ONE_ETH;
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: pledgeAmount});
    loanInfo = await subPool.loanIdxToLoanInfo(1);

    loanTerms = await subPool.loanTerms(loanInfo.collateral);
    balTestTokenPre = await DAI.balanceOf(borrower.address);
    await subPool.connect(borrower).rollOver(1, 0, MAX_UINT128, timestamp+1000000000, 0);
    balTestTokenPost = await DAI.balanceOf(borrower.address);

    expRollCost = loanInfo.repayment.sub(loanTerms[0]);
    actRollCost = balTestTokenPre.sub(balTestTokenPost);
    expect(expRollCost).to.be.equal(actRollCost);
  })
  
  it("Shouldn't overflow even after 4x rounds of consecutive LPing with DAI ≈80mn and borrowing against 120,000,000 ETH", async function () {
    //large borrow
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x204FCE5E3E25026110000000",
    ]);

    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    pledgeAmount = ONE_ETH.mul(120000000);

    bal = await DAI.balanceOf(lp1.address);

    await subPool.connect(lp1).addLiquidity(bal, timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: pledgeAmount});
    loanInfo = await subPool.loanIdxToLoanInfo(1);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await subPool.connect(lp2).addLiquidity(bal, timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: pledgeAmount});
    loanInfo = await subPool.loanIdxToLoanInfo(2);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await subPool.connect(lp3).addLiquidity(bal, timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: pledgeAmount});
    loanInfo = await subPool.loanIdxToLoanInfo(3);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)

    await subPool.connect(lp4).addLiquidity(bal, timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: pledgeAmount});
    loanInfo = await subPool.loanIdxToLoanInfo(4);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)


    /*await subPool.connect(lp5).addLiquidity(bal, timestamp+1000000000, 0);
    loanTerms = await subPool.loanTerms(pledgeAmount);
    console.log(loanTerms)
    await subPool.connect(borrower).borrow(0, 0, MAX_UINT128, timestamp+1000000000, 0, {value: pledgeAmount});
    loanInfo = await subPool.loanIdxToLoanInfo(5);

    totalLiquidity = await subPool.totalLiquidity();
    totalLpShares = await subPool.totalLpShares();
    console.log(loanInfo)
    console.log(totalLiquidity)
    console.log(totalLpShares)*/
  })
});
