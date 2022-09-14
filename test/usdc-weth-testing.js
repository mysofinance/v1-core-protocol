const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("USDC-WETH Pool Testing", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;
  const _loanCcyToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const _collCcyToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_ETH.div(1500).div(2);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(1000)
  const _liquidityBnd1 = ONE_ETH.mul(1000);
  const _liquidityBnd2 = ONE_ETH.mul(10000);
  const _minLoan = ONE_ETH.div(10);
  const USDC_MASTER_MINTER = "0xe982615d461dd5cd06575bbea87624fda4e3de17";
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();

    // prepare USDC balances
    USDC = await ethers.getContractAt("IUSDC", _collCcyToken);
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

    // get WETH contract
    WETH = await ethers.getContractAt("IWETH", _loanCcyToken);

    // prepare lp1 WETH balance
    await ethers.provider.send("hardhat_setBalance", [
      lp1.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(lp1.address);
    await WETH.connect(lp1).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // prepare lp2 WETH balance
    await ethers.provider.send("hardhat_setBalance", [
      lp2.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(lp2.address);
    await WETH.connect(lp2).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // prepare lp3 WETH balance
    await ethers.provider.send("hardhat_setBalance", [
      lp3.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(lp3.address);
    await WETH.connect(lp3).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // prepare lp4 WETH balance
    await ethers.provider.send("hardhat_setBalance", [
      lp4.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(lp4.address);
    await WETH.connect(lp4).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // prepare lp5 WETH balance
    await ethers.provider.send("hardhat_setBalance", [
      lp5.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(lp5.address);
    await WETH.connect(lp5).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // prepare borrower WETH balance
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(borrower.address);
    await WETH.connect(borrower).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // deploy pool
    PoolUsdcWeth = await ethers.getContractFactory("PoolUsdcWeth");
    PoolUsdcWeth = await PoolUsdcWeth.connect(deployer);
    poolUsdcWeth = await PoolUsdcWeth.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0);
    await poolUsdcWeth.deployed();

    // approve USDC and WETH balances
    USDC.connect(lp1).approve(poolUsdcWeth.address, MAX_UINT128);
    USDC.connect(lp2).approve(poolUsdcWeth.address, MAX_UINT128);
    USDC.connect(lp3).approve(poolUsdcWeth.address, MAX_UINT128);
    USDC.connect(lp4).approve(poolUsdcWeth.address, MAX_UINT128);
    USDC.connect(lp5).approve(poolUsdcWeth.address, MAX_UINT128);
    USDC.connect(borrower).approve(poolUsdcWeth.address, MAX_UINT128);
    WETH.connect(lp1).approve(poolUsdcWeth.address, MAX_UINT128);
    WETH.connect(lp2).approve(poolUsdcWeth.address, MAX_UINT128);
    WETH.connect(lp3).approve(poolUsdcWeth.address, MAX_UINT128);
    WETH.connect(lp4).approve(poolUsdcWeth.address, MAX_UINT128);
    WETH.connect(lp5).approve(poolUsdcWeth.address, MAX_UINT128);
    WETH.connect(borrower).approve(poolUsdcWeth.address, MAX_UINT128);
  });
  
  it("Should have correct initial values", async function () {
    poolInfo = await poolUsdcWeth.getPoolInfo();
    expect(poolInfo._totalLiquidity).to.be.equal(0);
    expect(poolInfo._loanIdx).to.be.equal(1);
  });

  it("Should fail on loan terms without LPs", async function () {
    await expect(poolUsdcWeth.loanTerms(ONE_ETH)).to.be.revertedWithCustomError(poolUsdcWeth, "InsufficientLiquidity");
  });

  it("Should allow LPs to add liquidity", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(10), timestamp+60, 0);
    await poolUsdcWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(100), timestamp+60, 0);
    await poolUsdcWeth.connect(lp3).addLiquidity(lp3.address, ONE_ETH.mul(1000), timestamp+60, 0);
    poolInfo = await poolUsdcWeth.getPoolInfo();
    expect(poolInfo._totalLiquidity).to.be.equal(ONE_ETH.mul(1110));
  });

  it("Should allow borrowing with USDC", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(1000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(10000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp3).addLiquidity(lp3.address, ONE_ETH.mul(100000), timestamp+60, 0);

    loanTerms = await poolUsdcWeth.loanTerms(ONE_USDC.mul(1000));
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), minLoanLimit, maxRepayLimit, timestamp+60, 0);
  });
  
  it("Should not allow new LPs to claim on unentitled previous loans", async function () {
    // add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(30000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(20000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp3).addLiquidity(lp3.address, ONE_ETH.mul(10000), timestamp+60, 0);

    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;

    // borrow & repay
    loanTerms = await poolUsdcWeth.loanTerms(ONE_USDC.mul(1500));
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1500), minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await poolUsdcWeth.connect(borrower).repay(1, borrower.address, loanTerms.repaymentAmount);

    // borrow & repay
    loanTerms = await poolUsdcWeth.loanTerms(ONE_USDC.mul(1500));
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1500), minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await poolUsdcWeth.connect(borrower).repay(2, borrower.address, loanTerms.repaymentAmount);

    // borrow & default
    loanTerms = await poolUsdcWeth.loanTerms(ONE_USDC.mul(1500));
    minLoanLimit = loanTerms[0].mul(98).div(100);
    maxRepayLimit = loanTerms[1].mul(102).div(100);
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1500), minLoanLimit, maxRepayLimit, timestamp+9999999, 0);

    // move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    // claim
    await poolUsdcWeth.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999);
    // cannot claim twice
    await expect(poolUsdcWeth.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");

    // remove liquidity
    let lp1NumSharesPre = await poolUsdcWeth.getLpInfo(lp1.address);
    await poolUsdcWeth.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre.sharesOverTime[0]);

    // cannot remove twice
    await expect(poolUsdcWeth.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre.sharesOverTime[0])).to.be.revertedWithCustomError(poolUsdcWeth, "InvalidRemove");

    lp1NumSharesPost = await poolUsdcWeth.getLpInfo(lp1.address);
    await expect(lp1NumSharesPost.sharesOverTime[0]).to.be.equal(0); // shares get overwritten to zero because LP claimed up until curr loan idx

    // ensure new lp cannot claim on previous loan
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp4).addLiquidity(lp4.address, ONE_ETH.mul(1000), timestamp+60, 0);
    await expect(poolUsdcWeth.connect(lp4).claim(lp4.address, [1], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
    await expect(poolUsdcWeth.connect(lp4).claim(lp4.address, [2], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
    await expect(poolUsdcWeth.connect(lp4).claim(lp4.address, [3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
    await expect(poolUsdcWeth.connect(lp4).claim(lp4.address, [1,2], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
    await expect(poolUsdcWeth.connect(lp4).claim(lp4.address, [2,3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
    await expect(poolUsdcWeth.connect(lp4).claim(lp4.address, [1,3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
    await expect(poolUsdcWeth.connect(lp4).claim(lp4.address, [1,2,3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
  });
  
  it("Should be possible to borrow when there's sufficient liquidity, and allow new LPs to add liquidity to make borrowing possible again", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(2), timestamp+60, 0);

    // iteratively take out borrows until until liquidity so low that loan amount below min. loan
    numBorrows = 0;
    tooSmallLoans = false;
    for (let i = 0; i < 100; i++) {
      try {
        loanTerms = await poolUsdcWeth.loanTerms(ONE_USDC.mul(1000));
        await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), 0, MAX_UINT128, timestamp+1000000000, 0);
        numBorrows += 1;
        console.log("loanTerms: ", loanTerms);
      } catch(error) {
        console.log("loanTerms error: ", error);
        await expect(poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), 0, MAX_UINT128, timestamp+1000000000, 0)).to.be.revertedWithCustomError(poolUsdcWeth, 'LoanTooSmall');
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
    await poolUsdcWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(1000), timestamp+60, 0);

    // take out a loan should be possible again without revert after liquidity add
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), 0, MAX_UINT128, timestamp+1000000000, 0);
  });

  it("Should allow LPs to claim individually", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(100000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(100000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp3).addLiquidity(lp3.address, ONE_ETH.mul(100000), timestamp+60, 0);

    for (let i = 0; i < 100; i++) {
      loanTerms = await poolUsdcWeth.loanTerms(ONE_USDC.mul(1000));
      await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), 0, MAX_UINT128, timestamp+1000000000, 0);
      await poolUsdcWeth.connect(borrower).repay(i+1, borrower.address, loanTerms.repaymentAmount);
    }
    loanIds = Array.from(Array(100), (_, index) => index + 1);

    await poolUsdcWeth.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999);
    // cannot claim twice
    await expect(poolUsdcWeth.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");

    await poolUsdcWeth.connect(lp2).claim(lp2.address, loanIds, false, timestamp+9999999);
    await poolUsdcWeth.connect(lp3).claim(lp3.address, loanIds, false, timestamp+9999999);
  });
  
  it("Should handle aggregate claims correctly (1/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(5000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(5000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp3).addLiquidity(lp3.address, ONE_ETH.mul(3000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp4).addLiquidity(lp4.address, ONE_ETH.mul(2000), timestamp+60, 0);

    totalRepaymentsIndicative = ethers.BigNumber.from(0);
    totalRepayments = ethers.BigNumber.from(0);
    totalInterestCosts = ethers.BigNumber.from(0);
    preBorrBal = await WETH.balanceOf(borrower.address);
    pledgeAmount = ONE_USDC.mul(10000);
    for (let i = 0; i < 99; i++) {
      // indicative repayment
      loanTerms = await poolUsdcWeth.loanTerms(pledgeAmount);
      totalRepaymentsIndicative = totalRepaymentsIndicative.add(loanTerms[1]);
      // borrow
      await poolUsdcWeth.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp+1000000000, 0);
      // actual repayment
      loanInfo = await poolUsdcWeth.loanIdxToLoanInfo(i+1);
      totalRepayments = totalRepayments.add(loanInfo[0]);
      // interest costs
      totalInterestCosts = totalInterestCosts.add(loanTerms[1].sub(loanTerms[0]));
      // repay
      await poolUsdcWeth.connect(borrower).repay(i+1, borrower.address, loanInfo.repayment);
    }
    await expect(totalRepaymentsIndicative).to.be.equal(totalRepayments);
    console.log("totalRepayments", totalRepayments)
    // total interest cost
    postBorrBal = await WETH.balanceOf(borrower.address);
    await expect(preBorrBal.sub(postBorrBal)).to.be.equal(totalInterestCosts);

    // lp1 claims individually
    preClaimBal = await WETH.balanceOf(lp1.address);
    loanIds = Array.from(Array(99), (_, index) => index + 1);
    await poolUsdcWeth.connect(lp1).claim(lp1.address, loanIds, false, timestamp+9999999);
    postClaimBal = await WETH.balanceOf(lp1.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    // move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    // cannot claim twice
    await expect(poolUsdcWeth.connect(lp1).claimFromAggregated(lp1.address, [1, 100], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");
    
    // lp2 claims via aggregate
    benchmarkDiff = postClaimBal.sub(preClaimBal)
    preClaimBal = await WETH.balanceOf(lp2.address);
    await poolUsdcWeth.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await WETH.balanceOf(lp2.address);
    diff = postClaimBal.sub(preClaimBal)
    await expect(benchmarkDiff).to.be.equal(diff);

    // cannot claim twice
    await expect(poolUsdcWeth.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "UnentitledFromLoanIdx");

    // lp3 claims
    preClaimBal = await WETH.balanceOf(lp3.address);
    await poolUsdcWeth.connect(lp3).claimFromAggregated(lp3.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await WETH.balanceOf(lp3.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;

    // lp4 claims
    preClaimBal = await WETH.balanceOf(lp4.address);
    await poolUsdcWeth.connect(lp4).claimFromAggregated(lp4.address, [0, 100], false, timestamp+9999999);
    postClaimBal = await WETH.balanceOf(lp4.address);
    expClaim = totalRepayments.mul(5).div(15);
    actClaim = postClaimBal.sub(preClaimBal);
    pct = actClaim.mul(9900).div(actClaim)
    await expect((9900 <= pct) && (pct <= 10010)).to.be.true;
  });
  
  it("Should handle aggregate claims correctly (2/2)", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolUsdcWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(5000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(3000), timestamp+60, 0);
    await poolUsdcWeth.connect(lp3).addLiquidity(lp3.address, ONE_ETH.mul(2000), timestamp+60, 0);

    totalRepayments = ethers.BigNumber.from(0);
    totalLeftColl = ethers.BigNumber.from(0);

    // 1st borrow & repay
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolUsdcWeth.loanIdxToLoanInfo(1);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await poolUsdcWeth.connect(borrower).repay(1, borrower.address, loanInfo.repayment);

    // 2nd borrow & repay
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), 0, MAX_UINT128, timestamp+1000000000, 0);
    loanInfo = await poolUsdcWeth.loanIdxToLoanInfo(2);
    totalRepayments = totalRepayments.add(loanInfo[0]);
    await poolUsdcWeth.connect(borrower).repay(2, borrower.address, loanInfo.repayment);

    // 3rd borrow & default
    await poolUsdcWeth.connect(borrower).borrow(borrower.address, ONE_USDC.mul(1000), 0, MAX_UINT128, timestamp+1000000000, 0);
    totalLeftColl = totalLeftColl.add(ONE_USDC.mul(1000));

    // move forward to loan expiry
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    // lp1 claims
    console.log("totalRepayments", totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp1.address); //await ethers.provider.getBalance(lp1.address);
    preClaimTokenBal = await USDC.balanceOf(lp1.address);
    await expect(poolUsdcWeth.connect(lp1).claimFromAggregated(lp1.address, [1, 3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "InvalidSubAggregation");
    await poolUsdcWeth.connect(lp1).claim(lp1.address, [1,2,3], false, timestamp+9999999);
    postClaimEthBal = await WETH.balanceOf(lp1.address); //ethers.provider.getBalance(lp1.address);
    postClaimTokenBal = await USDC.balanceOf(lp1.address);

    // WETH diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal);
    expEthDiff = totalRepayments.mul(5).div(10);
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;

    // token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal);
    expTokenDiff = totalLeftColl.mul(5).div(10);
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;


    // lp2 claims
    console.log("totalRepayments", totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    preClaimTokenBal = await USDC.balanceOf(lp2.address);
    await expect(poolUsdcWeth.connect(lp2).claimFromAggregated(lp2.address, [1, 3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "InvalidSubAggregation");
    await poolUsdcWeth.connect(lp2).claim(lp2.address, [1,2,3], false, timestamp+9999999);
    postClaimEthBal = await WETH.balanceOf(lp2.address); //await ethers.provider.getBalance(lp2.address);
    postClaimTokenBal = await USDC.balanceOf(lp2.address);

    // ETH diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal);
    expEthDiff = totalRepayments.mul(3).div(10);
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;

    // token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal);
    expTokenDiff = totalLeftColl.mul(3).div(10);
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;


    // lp3 claims
    console.log("totalRepayments", totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    preClaimTokenBal = await USDC.balanceOf(lp3.address);
    await expect(poolUsdcWeth.connect(lp3).claimFromAggregated(lp3.address, [1, 3], false, timestamp+9999999)).to.be.revertedWithCustomError(poolUsdcWeth, "InvalidSubAggregation");
    await poolUsdcWeth.connect(lp3).claim(lp3.address, [1,2,3], false, timestamp+9999999);
    postClaimEthBal = await WETH.balanceOf(lp3.address); //await ethers.provider.getBalance(lp3.address);
    postClaimTokenBal = await USDC.balanceOf(lp3.address);

    // ETH diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal);
    expEthDiff = totalRepayments.mul(2).div(10);
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;

    // token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal);
    expTokenDiff = totalLeftColl.mul(2).div(10);
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect((10000 <= pctEthDiff) && (pctEthDiff <= 10010)).to.be.true;
  });
});
