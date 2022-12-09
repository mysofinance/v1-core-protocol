const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Testing Claiming", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(1000)
  const _liquidityBnd1 = ONE_USDC.mul(100000);
  const _liquidityBnd2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.div(10);
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();
    console.log("Need to update hardhat.config.js for local testing!");

    // deploy & mint test tokens
    MyERC20 = await ethers.getContractFactory("MyERC20");
    MyERC20 = await MyERC20.connect(deployer);
    loanToken = await MyERC20.deploy("loanCcy", "loanCcy", 6);
    await loanToken.deployed();
    collToken = await MyERC20.deploy("collCcy", "collCcy", 18);
    await collToken.deployed();

    // mint loan tokens
    loanToken.connect(deployer).mint(lp1.address, MAX_UINT128);
    loanToken.connect(deployer).mint(lp2.address, MAX_UINT128);
    loanToken.connect(deployer).mint(lp3.address, MAX_UINT128);
    loanToken.connect(deployer).mint(lp4.address, MAX_UINT128);
    loanToken.connect(deployer).mint(lp5.address, MAX_UINT128);
    loanToken.connect(deployer).mint(borrower.address, MAX_UINT128);

    // mint coll tokens
    collToken.connect(deployer).mint(lp1.address, MAX_UINT128);
    collToken.connect(deployer).mint(lp2.address, MAX_UINT128);
    collToken.connect(deployer).mint(lp3.address, MAX_UINT128);
    collToken.connect(deployer).mint(lp4.address, MAX_UINT128);
    collToken.connect(deployer).mint(lp5.address, MAX_UINT128);
    collToken.connect(deployer).mint(borrower.address, MAX_UINT128);

    // deploy pool
    StandardZLLPool = await ethers.getContractFactory("StandardZLLPool");
    StandardZLLPool = await StandardZLLPool.connect(deployer);
    pool = await StandardZLLPool.deploy(loanToken.address, collToken.address, _loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0);
    await pool.deployed();

    // approve USDC and WETH balances
    loanToken.connect(lp1).approve(pool.address, MAX_UINT128);
    loanToken.connect(lp2).approve(pool.address, MAX_UINT128);
    loanToken.connect(lp3).approve(pool.address, MAX_UINT128);
    loanToken.connect(lp4).approve(pool.address, MAX_UINT128);
    loanToken.connect(lp5).approve(pool.address, MAX_UINT128);
    loanToken.connect(borrower).approve(pool.address, MAX_UINT128);
    collToken.connect(lp1).approve(pool.address, MAX_UINT128);
    collToken.connect(lp2).approve(pool.address, MAX_UINT128);
    collToken.connect(lp3).approve(pool.address, MAX_UINT128);
    collToken.connect(lp4).approve(pool.address, MAX_UINT128);
    collToken.connect(lp5).approve(pool.address, MAX_UINT128);
    collToken.connect(borrower).approve(pool.address, MAX_UINT128);
  });

  it("Should handle claiming correctly", async function () {
    // 1st add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);

    // borrow & repay
    console.log("Running borrows...");
    const totalNumLoans1 = 899;
    // borrow loans 1,...,899
    for (let i = 1; i <= totalNumLoans1; i++) {
      if (i % 100 == 0) {
        console.log(i + ' of ' + totalNumLoans1)
      }
      loanTerms = await pool.loanTerms(ONE_ETH);
      minLoanLimit = loanTerms[0];
      maxRepayLimit = loanTerms[1];
      await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
      await pool.connect(borrower).repay(i, borrower.address, loanTerms.repaymentAmount);
    }

    // move forward to loan expiry to allow aggregate claim
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + _loanTenor])
    await ethers.provider.send("evm_mine");

    // 1st claim
    loanIdxs = Array.from({length: 99}, (_, i) => i + 1); // 1,...,99
    console.log("claiming: ", loanIdxs);
    await pool.connect(lp1).claim(lp1.address, loanIdxs, false, timestamp+9999999);
    loanIdxs = [100,200,300,400,500,600,700,800,900];
    console.log("claiming: ", loanIdxs);
    await pool.connect(lp1).claimFromAggregated(lp1.address, loanIdxs, false, timestamp+9999999);

    // 2nd add liquidity
    // i.e., change position at next incoming loan idx 900 
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);
    
    // borrow & repay
    const totalNumLoans2 = 1999;
    for (let i = totalNumLoans1+1; i <= totalNumLoans2; i++) {
      if (i % 100 == 0) {
        console.log(i + ' of ' + totalNumLoans2)
      }
      loanTerms = await pool.loanTerms(ONE_ETH);
      minLoanLimit = loanTerms[0];
      maxRepayLimit = loanTerms[1];
      await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
      await pool.connect(borrower).repay(i, borrower.address, loanTerms.repaymentAmount);
    }

    // move forward to loan expiry to allow aggregate claim
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + _loanTenor])
    await ethers.provider.send("evm_mine");

    // 2nd claim
    loanIdxs = [900,1000,2000];
    console.log("claiming: ", loanIdxs);
    await pool.connect(lp1).claimFromAggregated(lp1.address, loanIdxs, false, timestamp+9999999);
  });

  it("Check gas cost for individual claiming", async function () {
    // 1st add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);

    // do 3 borrows/repays
    loanTerms = await pool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0];
    maxRepayLimit = loanTerms[1];
    await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await pool.connect(borrower).repay(1, borrower.address, loanTerms.repaymentAmount);

    loanTerms = await pool.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0];
    maxRepayLimit = loanTerms[1];
    await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
    await pool.connect(borrower).repay(2, borrower.address, loanTerms.repaymentAmount);

    // move forward to loan expiry to allow aggregate claim
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + _loanTenor])
    await ethers.provider.send("evm_mine");

    // check gas for one claim
    let gasFor1LoopClaim = await pool.connect(lp1).estimateGas.claim(lp1.address, [1], false, timestamp+9999999);

    // check gas for two claims
    let gasFor2LoopClaim = await pool.connect(lp1).estimateGas.claim(lp1.address, [1,2], false, timestamp+9999999);

    let perLoopCost = gasFor2LoopClaim - gasFor1LoopClaim;
    let constCost = gasFor1LoopClaim - perLoopCost
    console.log("Gas costs for individual claiming:");
    console.log("> perLoopCost: " + perLoopCost);
    console.log("> constCost: " + constCost);
  })

  it("Check gas cost for aggregate claiming", async function () {
    // 1st add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);

    // do 300 borrows/repays
    for (let i = 1; i <= 300; i++) {
      loanTerms = await pool.loanTerms(ONE_ETH);
      minLoanLimit = loanTerms[0];
      maxRepayLimit = loanTerms[1];
      await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
      await pool.connect(borrower).repay(i, borrower.address, loanTerms.repaymentAmount);
    }

    // move forward to loan expiry to allow aggregate claim
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + _loanTenor])
    await ethers.provider.send("evm_mine");

    // check gas for one claim
    let gasFor1LoopClaim = await pool.connect(lp1).estimateGas.claimFromAggregated(lp1.address, [100,200], false, timestamp+9999999);

    // check gas for two claims
    let gasFor2LoopClaim = await pool.connect(lp1).estimateGas.claimFromAggregated(lp1.address, [100,200,300], false, timestamp+9999999);

    let perLoopCost = gasFor2LoopClaim - gasFor1LoopClaim;
    let constCost = gasFor1LoopClaim - perLoopCost
    console.log("Gas costs for aggregate claiming:");
    console.log("> perLoopCost: " + perLoopCost);
    console.log("> constCost: " + constCost);
  })

  it("Check aggregate claiming starting from 1,... (1/3)", async function () {
    // 1st add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);

    // do 200 borrows/repays
    for (let i = 1; i <= 99; i++) {
      loanTerms = await pool.loanTerms(ONE_ETH);
      minLoanLimit = loanTerms[0];
      maxRepayLimit = loanTerms[1];
      await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
      await pool.connect(borrower).repay(i, borrower.address, loanTerms.repaymentAmount);
    }

    // move forward to loan expiry to allow aggregate claim
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + _loanTenor])
    await ethers.provider.send("evm_mine");

    // check claiming by aggregate for closed interval [1,99]
    await pool.connect(lp1).claimFromAggregated(lp1.address, [0,100], false, timestamp+9999999);
  })

  it("Check aggregate claiming starting from 1,... (2/3)", async function () {
    // 1st add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);

    // do 200 borrows/repays
    for (let i = 1; i <= 300; i++) {
      loanTerms = await pool.loanTerms(ONE_ETH);
      minLoanLimit = loanTerms[0];
      maxRepayLimit = loanTerms[1];
      await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
      await pool.connect(borrower).repay(i, borrower.address, loanTerms.repaymentAmount);
    }

    // move forward to loan expiry to allow aggregate claim
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + _loanTenor])
    await ethers.provider.send("evm_mine");

    // check claiming by aggregate for closed interval [1,99]
    await pool.connect(lp1).claimFromAggregated(lp1.address, [0,100], false, timestamp+9999999);

    // check claiming by aggregate for closed interval [100,199]
    await pool.connect(lp1).estimateGas.claimFromAggregated(lp1.address, [100,200], false, timestamp+9999999);
  })

  it("Check aggregate claiming starting from 1,... (3/3)", async function () {
    // 1st add liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, ONE_USDC.mul(100000000), timestamp+60, 0);

    // do 200 borrows/repays
    for (let i = 1; i <= 300; i++) {
      loanTerms = await pool.loanTerms(ONE_ETH);
      minLoanLimit = loanTerms[0];
      maxRepayLimit = loanTerms[1];
      await pool.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);
      await pool.connect(borrower).repay(i, borrower.address, loanTerms.repaymentAmount);
    }

    // move forward to loan expiry to allow aggregate claim
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + _loanTenor])
    await ethers.provider.send("evm_mine");

    // check claiming by aggregate for closed interval [1,199]
    await pool.connect(lp1).claimFromAggregated(lp1.address, [0,100,200], false, timestamp+9999999);
  })
});
