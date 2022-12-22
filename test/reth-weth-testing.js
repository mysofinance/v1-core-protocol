const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RETH-WETH Pool Testing", function () {

  const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_ETH = MONE;
  const _collCcyToken = "0xae78736Cd615f374D3085123A210448E74Fc6393";
  const _loanCcyToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const _loanTenor = 86400;
  const _maxLoanPerColl = MONE;
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _liquidityBnd1 = ONE_ETH.mul(1);
  const _liquidityBnd2 = ONE_ETH.mul(1000);
  const _minLoan = ONE_ETH.div(10);
  const minLiquidity = ONE_ETH.div(10);
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");
  const RETH_HOLDER = "0xba12222222228d8ba445958a75a0704d566bf2c8"

  beforeEach( async () => {
    [deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners();

    // prepare RETH balances
    RETH = await ethers.getContractAt(IERC20_SOURCE, _collCcyToken);
    
    /*
    await ethers.provider.send("hardhat_setBalance", [
      RETH_HOLDER,
      "0x56BC75E2D63100000",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [RETH_HOLDER],
    });
    rethHolder = await ethers.getSigner(RETH_HOLDER);
    bal = await RETH.balanceOf(RETH_HOLDER);

    // transfer RETH to test account
    await RETH.connect(rethHolder).transfer(borrower.address, bal);
    */
   
    // prepare WETH balance
    WETH = await ethers.getContractAt("IWETH", _loanCcyToken);
    users = [lp1, lp2, lp3, lp4, lp5];
    for (const user of users) {
      await ethers.provider.send("hardhat_setBalance", [
        user.address,
        MONE.mul(100000).toHexString(),
      ]);
      balance = await ethers.provider.getBalance(user.address);
      await WETH.connect(user).deposit({value: balance.sub(ONE_ETH.mul(10))});
    }

    // deploy pool
    PoolRethWeth = await ethers.getContractFactory("PoolRethWeth");
    PoolRethWeth = await PoolRethWeth.connect(deployer);
    poolRethWeth = await PoolRethWeth.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 100, 0);
    await poolRethWeth.deployed();

    // approve WETH and RETH
    WETH.connect(lp1).approve(poolRethWeth.address, MAX_UINT128);
    WETH.connect(lp2).approve(poolRethWeth.address, MAX_UINT128);
    WETH.connect(lp3).approve(poolRethWeth.address, MAX_UINT128);
    WETH.connect(lp4).approve(poolRethWeth.address, MAX_UINT128);
    WETH.connect(lp5).approve(poolRethWeth.address, MAX_UINT128);
    WETH.connect(borrower).approve(poolRethWeth.address, MAX_UINT128);
    RETH.connect(borrower).approve(poolRethWeth.address, MAX_UINT128);

    // add some liquidity
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await poolRethWeth.connect(lp1).addLiquidity(lp1.address, ONE_ETH.mul(1), timestamp+60, 0);
    await poolRethWeth.connect(lp2).addLiquidity(lp2.address, ONE_ETH.mul(10), timestamp+60, 0);
    await poolRethWeth.connect(lp3).addLiquidity(lp3.address, ONE_ETH.mul(10000), timestamp+60, 0);
  });

  it("Should allow borrowing with rETH", async function () {
    /*
    loanTerms = await poolRethWeth.loanTerms(ONE_ETH);
    minLoanLimit = loanTerms[0]
    maxRepayLimit = loanTerms[1]
    console.log(loanTerms);
    console.log(minLoanLimit, maxRepayLimit);
    currBlock = await ethers.provider.getBlockNumber();
    await poolRethWeth.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp+60, 0);
    */
  });


  it("Simple Balancer Swap Test", async function () {
    const balancerVault = await ethers.getContractAt("IBalancerVault", "0xBA12222222228d8Ba445958a75a0704d566BF2C8");
    await WETH.connect(lp1).approve(balancerVault.address, MAX_UINT128);
    console.log("pre bal weth", await WETH.balanceOf(lp1.address))
    console.log("pre bal reth", await RETH.balanceOf(lp1.address))

    const singleSwap = {
      poolId: "0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112",
      kind: 0,
      assetIn: WETH.address,
      assetOut: RETH.address,
      amount: MONE,
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
    // deploy pool
    HyperStakingBorrow = await ethers.getContractFactory("HyperStakingBorrow");
    HyperStakingBorrow = await HyperStakingBorrow.connect(deployer);
    hyperStakingBorrow = await HyperStakingBorrow.deploy();
    await hyperStakingBorrow.deployed();

    // transfer some reth to borrower
    await ethers.provider.send("hardhat_setBalance", [
      RETH_HOLDER,
      "0x56BC75E2D63100000",
    ]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [RETH_HOLDER],
    });
    rethHolder = await ethers.getSigner(RETH_HOLDER);
    await RETH.connect(rethHolder).transfer(borrower.address, MONE);

    // approve and hyperstake
    await RETH.connect(borrower).approve(hyperStakingBorrow.address, MAX_UINT128);
    const flashBorrowPayload = {
      _mysoPoolRethWeth: poolRethWeth.address,
      _onBehalf: borrower.address,
      _minRethSwapReceive: 0,
      _rethPledge: MONE,
      _minWethLoanReceive: 0,
      _maxRethRepay: MONE.mul(9),
      _deadline: ethers.constants.MaxUint256
    }
    await hyperStakingBorrow.connect(borrower).borrow(flashBorrowPayload, MONE.mul(8))

    // check loan
    const loan = await poolRethWeth.loanIdxToLoanInfo(1);
    console.log(loan)
  })
});
