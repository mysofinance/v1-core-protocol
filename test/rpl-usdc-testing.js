const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RPL-USDC Pool Testing", function () {

  const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
  const ONE_USDC = ethers.BigNumber.from("1000000");
  const ONE_RPL = ethers.BigNumber.from("1000000000000000000");
  const BASE = ethers.BigNumber.from("1000000000000000000");
  const ONE_YEAR = ethers.BigNumber.from("31536000");
  const ONE_DAY = ethers.BigNumber.from("86400");
  const COLL_TOKEN_ADDR = "0xD33526068D116cE69F19A9ee46F0bd304F21A51f";
  const LOAN_TOKEN_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);
  const USDC_MASTER_MINTER = "0xe982615d461dd5cd06575bbea87624fda4e3de17";

  async function setupAccsAndTokens() {
    const [ deployer, lp1, lp2, lp3, borrower1, borrower2 ] = await ethers.getSigners()

    // prepare USDC balances
    const USDC = await ethers.getContractAt("IUSDC", LOAN_TOKEN_ADDR);
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
    
    // prepare RPL balances
    const RPL_IMPERSONATE_ADDR = "0x3bDC69C4E5e13E52A65f5583c23EFB9636b469d6"
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [RPL_IMPERSONATE_ADDR],
    });
    const rplHolder = await ethers.getSigner(RPL_IMPERSONATE_ADDR);

    // give minter eth to pay for gas
    await ethers.provider.send("hardhat_setBalance", [
      rplHolder.address,
      "0x56BC75E2D63100000",
    ]);

    // get coll contract
    const RPL = await ethers.getContractAt(IERC20_SOURCE, COLL_TOKEN_ADDR);

    // credit borrowers with coll
    await RPL.connect(rplHolder).transfer(borrower1.address, ONE_RPL.mul(1000000))
    await RPL.connect(rplHolder).transfer(borrower2.address, ONE_RPL.mul(1000000))

    return [ USDC, RPL, deployer, lp1, lp2, lp3, borrower1, borrower2 ]
  }

  async function setupPool() {
    const [ deployer ] = await ethers.getSigners()

    // pool parameters
    const tenor = ONE_DAY.mul(30)
    const poolConfig = {
      tenor: tenor,
      maxLoanPerColl: ONE_USDC.mul(15),
      r1: BASE.mul(4).div(100).mul(tenor).div(ONE_YEAR),
      r2: BASE.mul(2).div(100).mul(tenor).div(ONE_YEAR),
      liquidityBnd1: ONE_USDC.mul(1000),
      liquidityBnd2: ONE_USDC.mul(1000000),
      minLoan: ONE_USDC.mul(100),
      baseAggrBucketSize: 100,
      creatorFee: 0
    }
    // get contract
    const PoolRplUsdc = await ethers.getContractFactory("PoolRplUsdc");

    // deploy 1st pool
    const pool = await PoolRplUsdc.connect(deployer).deploy(
      poolConfig.tenor,
      poolConfig.maxLoanPerColl,
      poolConfig.r1,
      poolConfig.r2,
      poolConfig.liquidityBnd1,
      poolConfig.liquidityBnd2,
      poolConfig.minLoan,
      poolConfig.baseAggrBucketSize,
      poolConfig.creatorFee
    );
    await pool.deployed();

    return [ pool ];
  }

  async function setupApprovals(token, accs, pool) {
    for (const acc of accs) {
      await token.connect(acc).approve(pool.address, MAX_UINT128)
    }
  }

  async function setup() {
    // setup and fund accounts
    const [USDC, RPL, deployer, lp1, lp2, lp3, borrower1, borrower2] = await setupAccsAndTokens()

    // setup pool
    const [pool] = await setupPool()

    // set "standard" approvals
    await setupApprovals(USDC, [lp1, lp2, lp3, borrower1, borrower2], pool)
    await setupApprovals(RPL, [borrower1, borrower2], pool)

    return [USDC, RPL, pool, deployer, lp1, lp2, lp3, borrower1, borrower2]
  }

  it("Test core functions", async function () {
    const [USDC, RPL, pool, deployer, lp1, lp2, lp3, borrower1, borrower2] = await setup()

    // check balances pre
    const lp1UsdcPreAddCheck = await USDC.balanceOf(lp1.address)
    const poolUsdcPreCheck = await USDC.balanceOf(pool.address)

    // add liquidity
    const addAmount = ONE_USDC.mul(100000)
    const blocknum = await ethers.provider.getBlockNumber();
    const timestamp = (await ethers.provider.getBlock(blocknum)).timestamp;
    await pool.connect(lp1).addLiquidity(lp1.address, addAmount, timestamp+60, 0);
    
    // check balances pre
    const lp1UsdcPostAddCheck = await USDC.balanceOf(lp1.address)
    const poolUsdcPostCheck = await USDC.balanceOf(pool.address)
    expect(lp1UsdcPreAddCheck.sub(lp1UsdcPostAddCheck)).to.be.equal(poolUsdcPostCheck.sub(poolUsdcPreCheck))
    expect(lp1UsdcPreAddCheck.sub(lp1UsdcPostAddCheck)).to.be.equal(addAmount)

    // check various loan terms
    const sendAmount = ONE_RPL.mul(1000)
    const sendAmountMultiple = [1,2,3,4,5,10,20,50,100]
    const tmpPoolInfo = await pool.getPoolInfo()
    console.log(`PLEDGE AMOUNT (RPL); LOAN AMOUNT (USDC); POOL UTIL.; APR; LTV`)
    for (let i=0; i<sendAmountMultiple.length;i++) {
      const COLL_TOKEN_DECIMALS = ethers.BigNumber.from("1000000000000000000")
      const LOAN_TOKEN_DECIMALS = ethers.BigNumber.from("1000000")
      const RPL_PRICE_IN_CENT = ethers.BigNumber.from("2780")
      const tmpSendAmount = sendAmount.mul(sendAmountMultiple[i])
      const tmpLoanTerms = await pool.loanTerms(tmpSendAmount)
      const tmpUtil = tmpLoanTerms.loanAmount.mul(10000).div(tmpPoolInfo._totalLiquidity)
      const tmpApr = tmpLoanTerms.repaymentAmount.sub(tmpLoanTerms.loanAmount).mul(60*60*24*365).mul(10000).div(tmpPoolInfo._loanTenor).div(tmpLoanTerms.loanAmount)
      const tmpLtv = tmpLoanTerms.loanAmount.mul(COLL_TOKEN_DECIMALS).mul(10000).mul(100).div(tmpSendAmount).div(RPL_PRICE_IN_CENT).div(LOAN_TOKEN_DECIMALS)
      console.log(`${Number(tmpSendAmount.div(ONE_RPL.div(100).toString()))/100}; ${tmpLoanTerms.loanAmount.div(ONE_USDC.div(100).toString())/100}; ${Number(tmpUtil)/100}%; ${Number(tmpApr)/100}%; ${Number(tmpLtv)/100}%`)
    }

    // new terms
    const poolInfoPre = await pool.getPoolInfo()
    const newTerms = {
      tenor: poolInfoPre._loanTenor,
      maxLoanPerColl: ONE_USDC.mul(19),
      r1: BASE.mul(15).div(100).mul(poolInfoPre._loanTenor).div(ONE_YEAR),
      r2: BASE.mul(5).div(100).mul(poolInfoPre._loanTenor).div(ONE_YEAR),
      liquidityBnd1: ONE_USDC.mul(2000),
      liquidityBnd2: ONE_USDC.mul(3000000),
      creatorFee: BASE.mul(10).div(10000)
    }
    // check revert if other acc than pool creator tries to update terms
    await expect(pool.connect(borrower1).updateTerms(newTerms.maxLoanPerColl, newTerms.creatorFee, newTerms.r1, newTerms.r2, newTerms.liquidityBnd1, newTerms.liquidityBnd2)).to.be.reverted;
    // check revert on invalid new terms
    await expect(pool.connect(deployer).updateTerms(0, newTerms.creatorFee, newTerms.r1, newTerms.r2, newTerms.liquidityBnd1, newTerms.liquidityBnd2)).to.be.reverted;
    await expect(pool.connect(deployer).updateTerms(newTerms.maxLoanPerColl, BASE.mul(31).div(10000), newTerms.r1, newTerms.r2, newTerms.liquidityBnd1, newTerms.liquidityBnd2)).to.be.reverted;
    await expect(pool.connect(deployer).updateTerms(newTerms.maxLoanPerColl, newTerms.creatorFee, newTerms.r2, newTerms.r1, newTerms.liquidityBnd1, newTerms.liquidityBnd2)).to.be.reverted;
    await expect(pool.connect(deployer).updateTerms(newTerms.maxLoanPerColl, newTerms.creatorFee, newTerms.r1, newTerms.r2, newTerms.liquidityBnd2, newTerms.liquidityBnd1)).to.be.reverted;

    // check pool creator can update terms
    await pool.connect(deployer).updateTerms(newTerms.maxLoanPerColl, newTerms.creatorFee, newTerms.r1, newTerms.r2, newTerms.liquidityBnd1, newTerms.liquidityBnd2);

    // check new terms set
    const poolInfoPost = await pool.getPoolInfo()
    const poolRateParamsPost = await pool.getRateParams()
    expect(poolInfoPost._maxLoanPerColl).to.be.equal(newTerms.maxLoanPerColl)
    expect(poolRateParamsPost._liquidityBnd1).to.be.equal(newTerms.liquidityBnd1)
    expect(poolRateParamsPost._liquidityBnd2).to.be.equal(newTerms.liquidityBnd2)
    expect(poolRateParamsPost._r1).to.be.equal(newTerms.r1)
    expect(poolRateParamsPost._r2).to.be.equal(newTerms.r2)

    // get loan terms
    const loanTermsPost = await pool.loanTerms(sendAmount)
    // retrieve creator fee via loan terms and check if updated correctly
    expect(loanTermsPost._creatorFee).to.be.equal(newTerms.creatorFee.mul(sendAmount).div(BASE))
    // alternatively use public getter
    expect(await pool.creatorFee()).to.be.equal(newTerms.creatorFee)

    // check borrow
    const borrower1UsdcPreBorrowCheck = await USDC.balanceOf(borrower1.address)
    const borrower1RplPreBorrowCheck = await RPL.balanceOf(borrower1.address)
    const poolUsdcPreBorrowCheck = await USDC.balanceOf(pool.address)
    const poolRplPreBorrowCheck = await RPL.balanceOf(pool.address)
    const creatorRplPreBorrow = await RPL.balanceOf(deployer.address)

    const minLoanLimit = loanTermsPost.loanAmount
    const maxRepayLimit = loanTermsPost.repaymentAmount
    await pool.connect(borrower1).borrow(borrower1.address, sendAmount, minLoanLimit, maxRepayLimit, timestamp+9999999, 0);

    const borrower1UsdcPostBorrowCheck = await USDC.balanceOf(borrower1.address)
    const borrower1RplPostBorrowCheck = await RPL.balanceOf(borrower1.address)
    const poolUsdcPostBorrowCheck = await USDC.balanceOf(pool.address)
    const poolRplPostBorrowCheck = await RPL.balanceOf(pool.address)
    const creatorRplPostBorrow = await RPL.balanceOf(deployer.address)
    expect(borrower1UsdcPostBorrowCheck.sub(borrower1UsdcPreBorrowCheck)).to.be.equal(poolUsdcPreBorrowCheck.sub(poolUsdcPostBorrowCheck))
    expect(borrower1UsdcPostBorrowCheck.sub(borrower1UsdcPreBorrowCheck)).to.be.equal(loanTermsPost.loanAmount)
    expect(borrower1RplPreBorrowCheck.sub(borrower1RplPostBorrowCheck).sub(loanTermsPost._creatorFee)).to.be.equal(poolRplPostBorrowCheck.sub(poolRplPreBorrowCheck))
    expect(borrower1RplPreBorrowCheck.sub(borrower1RplPostBorrowCheck).sub(loanTermsPost._creatorFee)).to.be.equal(loanTermsPost.pledgeAmount)
    expect(creatorRplPostBorrow.sub(creatorRplPreBorrow)).to.be.equal(loanTermsPost._creatorFee)

    // check repay
    await USDC.connect(lp1).transfer(borrower1.address, loanTermsPost.repaymentAmount)
    const borrower1UsdcPreRepayCheck = await USDC.balanceOf(borrower1.address)
    const borrower1RplPreRepayCheck = await RPL.balanceOf(borrower1.address)
    const poolUsdcPreRepayCheck = await USDC.balanceOf(pool.address)
    const poolRplPreRepayCheck = await RPL.balanceOf(pool.address)
    await pool.connect(borrower1).repay(1, borrower1.address, loanTermsPost.repaymentAmount)
    const borrower1UsdcPostRepayCheck = await USDC.balanceOf(borrower1.address)
    const borrower1RplPostRepayCheck = await RPL.balanceOf(borrower1.address)
    const poolUsdcPostRepayCheck = await USDC.balanceOf(pool.address)
    const poolRplPostRepayCheck = await RPL.balanceOf(pool.address)
    expect(borrower1UsdcPreRepayCheck.sub(borrower1UsdcPostRepayCheck)).to.be.equal(poolUsdcPostRepayCheck.sub(poolUsdcPreRepayCheck))
    expect(borrower1UsdcPreRepayCheck.sub(borrower1UsdcPostRepayCheck)).to.be.equal(loanTermsPost.repaymentAmount)
    expect(borrower1RplPostRepayCheck.sub(borrower1RplPreRepayCheck)).to.be.equal(poolRplPreRepayCheck.sub(poolRplPostRepayCheck))
    expect(borrower1RplPostRepayCheck.sub(borrower1RplPreRepayCheck)).to.be.equal(loanTermsPost.pledgeAmount)

    // check claim
    const lp1UsdcPreClaimCheck = await USDC.balanceOf(lp1.address)
    const poolUsdcPreClaimCheck = await USDC.balanceOf(pool.address)
    await pool.connect(lp1).claim(lp1.address, [1], false, timestamp+9999999)
    const lp1UsdcPostClaimCheck = await USDC.balanceOf(lp1.address)
    const poolUsdcPostClaimCheck = await USDC.balanceOf(pool.address)
    expect(lp1UsdcPostClaimCheck.sub(lp1UsdcPreClaimCheck)).to.be.equal(poolUsdcPreClaimCheck.sub(poolUsdcPostClaimCheck))
    expect(lp1UsdcPostClaimCheck.sub(lp1UsdcPreClaimCheck)).to.be.equal(loanTermsPost.repaymentAmount)
    
    // move forward after earliest remove
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine");

    // remove check
    const lp1UsdcPreRemoveCheck = await USDC.balanceOf(lp1.address)
    const poolUsdcPreRemoveCheck = await USDC.balanceOf(pool.address)
    const lpInfo = await pool.getLpInfo(lp1.address)
    const poolInfo = await pool.getPoolInfo()
    await pool.connect(lp1).removeLiquidity(lp1.address, lpInfo.sharesOverTime[0])
    const lp1UsdcPostRemoveCheck = await USDC.balanceOf(lp1.address)
    const poolUsdcPostRemoveCheck = await USDC.balanceOf(pool.address)
    expect(lp1UsdcPostRemoveCheck.sub(lp1UsdcPreRemoveCheck)).to.be.equal(poolUsdcPreRemoveCheck.sub(poolUsdcPostRemoveCheck))
    expect(lp1UsdcPostRemoveCheck.sub(lp1UsdcPreRemoveCheck)).to.be.equal(poolInfo._totalLiquidity.sub("10000000")) // sub minLiquidity
  });
});
