const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RETH-WETH Pool Testing", function () {

  const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
  const ONE_ETH = ethers.BigNumber.from("1000000000000000000");
  const ONE_RETH = ONE_ETH
  const BASE = ONE_ETH
  const ONE_YEAR = ethers.BigNumber.from("31536000");
  const ONE_DAY = ethers.BigNumber.from("86400");
  const COLL_TOKEN_ADDR = "0xae78736Cd615f374D3085123A210448E74Fc6393";
  const LOAN_TOKEN_ADDR = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);
  const MAX_UINT256 = ethers.BigNumber.from(2).pow(256).sub(1);

  async function setupTestingAccounts() {
    const [ deployer, lp1, lp2, lp3, borrower1, borrower2 ] = await ethers.getSigners()

    // mimic rocket minter contract
    const RETH_DEPOSIT_CONTRACT_ADDR = "0x2cac916b2A963Bf162f076C0a8a4a8200BCFBfb4"
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [RETH_DEPOSIT_CONTRACT_ADDR],
    });
    const minter = await ethers.getSigner(RETH_DEPOSIT_CONTRACT_ADDR);

    // give minter eth to pay for gas
    await ethers.provider.send("hardhat_setBalance", [
      minter.address,
      "0x56BC75E2D63100000",
    ]);

    // get RETH contract
    const RETH = await ethers.getContractAt("RocketTokenRETHInterface", COLL_TOKEN_ADDR);

    // mint RETH to borrowers
    await RETH.connect(minter).mint(ONE_ETH.mul(1000), borrower1.address)
    await RETH.connect(minter).mint(ONE_ETH.mul(1000), borrower2.address)

    // mint weth to lp accounts
    WETH = await ethers.getContractAt("IWETH", LOAN_TOKEN_ADDR);
    users = [lp1, lp2, lp3];
    for (const user of users) {
      await ethers.provider.send("hardhat_setBalance", [
        user.address,
        MAX_UINT128.toHexString(),
      ]);
      balance = await ethers.provider.getBalance(user.address);
      await WETH.connect(user).deposit({value: balance.sub(ONE_ETH.mul(10))});
    }

    return [ deployer, lp1, lp2, lp3, borrower1, borrower2 ]
  }

  async function setupPublicTestnetPools() {
    const [ deployer ] = await ethers.getSigners()

    // pool #1 parameters
    const pool1Tenor = ONE_DAY
    const pool1DeployConfig = {
      tenor: pool1Tenor,
      maxLoanPerColl: ONE_ETH,
      r1: BASE.mul(4).div(100).mul(pool1Tenor).div(ONE_YEAR),
      r2: BASE.mul(2).div(100).mul(pool1Tenor).div(ONE_YEAR),
      liquidityBnd1: ONE_ETH,
      liquidityBnd2: ONE_ETH.mul(50),
      minLoan: ONE_ETH.div(10),
      baseAggrBucketSize: 100,
      creatorFee: 0
    }

    // pool #2 parameters
    const pool2Tenor = ONE_DAY.mul(3).div(2)
    const pool2DeployConfig = {
      tenor: pool2Tenor,
      maxLoanPerColl: ONE_ETH,
      r1: BASE.mul(4).div(100).mul(pool2Tenor).div(ONE_YEAR),
      r2: BASE.mul(2).div(100).mul(pool2Tenor).div(ONE_YEAR),
      liquidityBnd1: ONE_ETH,
      liquidityBnd2: ONE_ETH.mul(50),
      minLoan: ONE_ETH.div(10),
      baseAggrBucketSize: 100,
      creatorFee: 0
    }
    
    // get contract
    const PoolRethWeth = await ethers.getContractFactory("PoolRethWeth");

    // deploy 1st pool
    const pool1RethWeth = await PoolRethWeth.connect(deployer).deploy(
      pool1DeployConfig.tenor,
      pool1DeployConfig.maxLoanPerColl,
      pool1DeployConfig.r1,
      pool1DeployConfig.r2,
      pool1DeployConfig.liquidityBnd1,
      pool1DeployConfig.liquidityBnd2,
      pool1DeployConfig.minLoan,
      pool1DeployConfig.baseAggrBucketSize,
      pool1DeployConfig.creatorFee
    );
    await pool1RethWeth.deployed();
    
    // deploy 2nd pool
    const pool2RethWeth = await PoolRethWeth.connect(deployer).deploy(
      pool2DeployConfig.tenor,
      pool2DeployConfig.maxLoanPerColl,
      pool2DeployConfig.r1,
      pool2DeployConfig.r2,
      pool2DeployConfig.liquidityBnd1,
      pool2DeployConfig.liquidityBnd2,
      pool2DeployConfig.minLoan,
      pool2DeployConfig.baseAggrBucketSize,
      pool2DeployConfig.creatorFee
    );
    await pool2RethWeth.deployed();

    return [ pool1RethWeth, pool2RethWeth ];
  }

  async function setupApprovals(token, accs, pool) {
    for (const acc of accs) {
      await token.connect(acc).approve(pool.address, MAX_UINT128)
    }
  }

  async function setupTokens() {
    const RETH = await ethers.getContractAt("RocketTokenRETHInterface", COLL_TOKEN_ADDR);
    const WETH = await ethers.getContractAt(IERC20_SOURCE, LOAN_TOKEN_ADDR);
    return [ RETH, WETH]
  }

  async function addLiquidity(pool, acc, amount) {
    // lp add liquidity
    const blocknum = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(acc).addLiquidity(acc.address, amount, timestamp+60, 0);
  }

  async function setupForTestCase(amount) {
    // get tokens
    const [RETH, WETH] = await setupTokens()

    // setup and fund accounts
    const [deployer, lp1, lp2, lp3, borrower1, borrower2] = await setupTestingAccounts()

    // deploy pools
    const [pool1, pool2] = await setupPublicTestnetPools()

    // set "standard" approvals
    await setupApprovals(WETH, [lp1, lp2, lp3], pool1)
    await setupApprovals(RETH, [borrower1, borrower2], pool1)

    // add liquidity
    await addLiquidity(pool1, lp1, amount)
    
    return [RETH, WETH, pool1, pool2, lp1, lp2, lp3, borrower1, borrower2]
  }

  it("Test borrowing", async function () {
    const [RETH, WETH, pool1, pool2, deployer, lp1, lp2, lp3, borrower1, borrower2] = await setupForTestCase(ONE_ETH.mul(50))

    // get loan terms
    const loanTerms = await pool1.loanTerms(ONE_RETH);
    const minLoanLimit = loanTerms.loanAmount
    const maxRepayLimit = loanTerms.repaymentAmount

    // check balances pre
    const rethBalPre = await RETH.balanceOf(borrower1.address)
    const wethBalPre = await WETH.balanceOf(borrower1.address)
    
    // borrow
    const currBlock = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(currBlock)).timestamp;
    await pool1.connect(borrower1).borrow(borrower1.address, ONE_RETH, minLoanLimit, maxRepayLimit, timestamp+60, 0);

    // check balances post
    const rethBalPost = await RETH.balanceOf(borrower1.address)
    const wethBalPost = await WETH.balanceOf(borrower1.address)

    expect(rethBalPre.sub(rethBalPost)).to.be.equal(loanTerms.pledgeAmount)
    expect(wethBalPost.sub(wethBalPre)).to.be.equal(loanTerms.loanAmount)
  });

  it("Test for overflow", async function () {
    const [RETH, WETH, pool1, pool2, deployer, lp1, lp2, lp3, borrower1, borrower2] = await setupForTestCase(ONE_ETH.mul(50))

    // get loan terms
    const pledgeAmount = ONE_RETH.mul(1000)
    const loanTerms = await pool1.loanTerms(pledgeAmount)
    const minLoanLimit = loanTerms.loanAmount
    const maxRepayLimit = loanTerms.repaymentAmount

    // check pool balance pre
    const wethPoolBalPre = await WETH.balanceOf(pool1.address)
    expect(wethPoolBalPre).to.be.equal(ONE_ETH.mul(50))

    // borrow
    const currBlock = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(currBlock)).timestamp;
    await pool1.connect(borrower1).borrow(borrower1.address, pledgeAmount, minLoanLimit, maxRepayLimit, timestamp+60, 0);

    // check pool balance post
    const wethPoolBalPost = await WETH.balanceOf(pool1.address)
    expect(wethPoolBalPre.sub(wethPoolBalPost)).to.be.equal(minLoanLimit)

    // get pool info
    const poolInfo = await pool1.getPoolInfo()
    const totalLpShares = poolInfo._totalLpShares
    const totalLiquidity = poolInfo._totalLiquidity

    // get distance to overflow
    const addToOverflow = MAX_UINT128.mul(totalLiquidity).div(totalLpShares)

    // check for revert
    // try adding liquidity
    //const blocknum2 = await ethers.provider.getBlockNumber();
    //const timestamp2 = (await ethers.provider.getBlock(blocknum2)).timestamp;
    //await pool1.connect(lp2).addLiquidity(lp2.address, addToOverflow, timestamp2+60, 0)
    expect(addToOverflow).to.be.greaterThan(MAX_UINT128)
  });

  it("Simple Balancer Swap Test", async function () {
    const [RETH, WETH, pool1, pool2, deployer, lp1, lp2, lp3, borrower1, borrower2] = await setupForTestCase(ONE_ETH.mul(50))

    const balancerVault = await ethers.getContractAt("IBalancerVault", "0xBA12222222228d8Ba445958a75a0704d566BF2C8");
    await WETH.connect(lp1).approve(balancerVault.address, MAX_UINT128);
    console.log("pre bal weth", await WETH.balanceOf(lp1.address))
    console.log("pre bal reth", await RETH.balanceOf(lp1.address))

    const singleSwap = {
      poolId: "0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112",
      kind: 0,
      assetIn: WETH.address,
      assetOut: RETH.address,
      amount: ONE_ETH,
      userData: "0x"
    }
    const fundManagement = {
      sender: lp1.address,
      fromInternalBalance: false,
      recipient: lp1.address,
      toInternalBalance: false
    } 
    await balancerVault.connect(lp1).swap(singleSwap, fundManagement, 0, MAX_UINT128);
    console.log("post bal weth", await WETH.balanceOf(lp1.address))
    console.log("post bal reth", await RETH.balanceOf(lp1.address))
  });

  it("Hyperstake Test", async function () {
    const [RETH, WETH, pool1, pool2, deployer, lp1, lp2, lp3, borrower1, borrower2] = await setupForTestCase(ONE_ETH.mul(50))

    // deploy pool
    HyperStakingBorrow = await ethers.getContractFactory("HyperStakingBorrow");
    HyperStakingBorrow = await HyperStakingBorrow.connect(deployer);
    hyperStakingBorrow = await HyperStakingBorrow.deploy();
    await hyperStakingBorrow.deployed();

    // approve hyperstaking contract
    await RETH.connect(borrower1).approve(hyperStakingBorrow.address, MAX_UINT128);

    // hyperstake
    const flashBorrowPayload = {
      _mysoPoolRethWeth: pool1.address,
      _onBehalf: borrower1.address,
      _wethFlashBorrow: ONE_ETH.mul(2),
      _minRethSwapReceive: 0,
      _rethPledgeTopup: ONE_RETH,
      _minWethLoanReceive: 0,
      _maxRethRepay: ONE_ETH.mul(9),
      _deadline: ethers.constants.MaxUint256
    }
    await hyperStakingBorrow.connect(borrower1).borrow(flashBorrowPayload)

    // check loan
    const loan = await pool1.loanIdxToLoanInfo(1);
    console.log(loan)
  })
});
