const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ImmunefiPoCPoolWethUsdc_v_1_1", function () {

  const MONE = ethers.BigNumber.from("1000000000000000000"); //10**18
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_ETH = MONE;
  const _loanCcyToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const _collCcyToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const _loanTenor = 86400;
  const _maxLoanPerColl = ONE_USDC.mul(1000);
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _liquidityBnd1 = ONE_USDC.mul(100000);
  const _liquidityBnd2 = ONE_USDC.mul(1000000);
  const _minLoan = ONE_USDC.mul(100);
  const USDC_MASTER_MINTER = "0xe982615d461dd5cd06575bbea87624fda4e3de17";
  const MAX_UINT128 = ethers.BigNumber.from("340282366920938463463374607431768211455");

  beforeEach( async () => {
    [deployer, lp, borrower, ...addrs] = await ethers.getSigners();

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
    await USDC.connect(masterMinter).mint(lp.address, MAX_UINT128);

    WETH = await ethers.getContractAt("IWETH", _collCcyToken);
    await ethers.provider.send("hardhat_setBalance", [
      borrower.address,
      "0x204FCE5E3E25026110000000",
    ]);
    balance = await ethers.provider.getBalance(borrower.address);
    await WETH.connect(borrower).deposit({value: balance.sub(ONE_ETH.mul(10))});

    // deploy pool
    PoolWethUsdc = await ethers.getContractFactory("ImmunefiPoCPoolWethUsdc_v_1_1");
    PoolWethUsdc = await PoolWethUsdc.connect(deployer);
    poolWethUsdc = await PoolWethUsdc.deploy(_loanTenor, _maxLoanPerColl, _r1, _r2, _liquidityBnd1, _liquidityBnd2, _minLoan, 10, 0);
    await poolWethUsdc.deployed();

    // approve
    await poolWethUsdc.connect(deployer).toggleLpWhitelist(lp.address);
    USDC.connect(lp).approve(poolWethUsdc.address, MAX_UINT128);
    USDC.connect(borrower).approve(poolWethUsdc.address, MAX_UINT128);
    WETH.connect(borrower).approve(poolWethUsdc.address, MAX_UINT128);
  });

  it("Should not allow adding less than min. liquidity / 1000", async function () {
    blocknum = await ethers.provider.getBlockNumber();
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    minLiquidity = await poolWethUsdc.getMinLiquidity()
    console.log("minLiquidity:", minLiquidity)
    for (let i=0; i<Number(minLiquidity.toString())/1000; i++) {
      console.log("testing i:", i)
      await expect(poolWethUsdc.connect(lp).addLiquidity(lp.address, i, timestamp+MAX_UINT128, 0)).to.be.revertedWithCustomError(poolWethUsdc, "InvalidAddAmount");
    }
  });

});
