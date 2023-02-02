const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('WETH-cUSDC Pool Testing', function () {
  const MONE = ethers.BigNumber.from('1000000000000000000') //10**18
  const ONE_USDC = ethers.BigNumber.from('1000000')
  const ONE_ETH = MONE
  const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const _loanCcyToken = '0x39AA39c021dfbaE8faC545936693aC917d5E7563'
  const _collCcyToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const _loanTenor = 86400
  let _maxLoanPerColl
  const _r1 = MONE.mul(2).div(100)
  const _r2 = MONE.mul(2).div(1000)
  let _liquidityBnd1
  let _liquidityBnd2
  let _minLoan
  let _minLiquidity
  const USDC_MASTER_MINTER = '0xe982615d461dd5cd06575bbea87624fda4e3de17'
  const MAX_UINT128 = ethers.BigNumber.from('340282366920938463463374607431768211455')

  beforeEach(async () => {
    ;[deployer, _, _, _, _, _, _, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners()

    // get USDC contract and mock master minter
    USDC = await ethers.getContractAt('IUSDC', USDC_ADDRESS)
    await ethers.provider.send('hardhat_setBalance', [USDC_MASTER_MINTER, '0x56BC75E2D63100000'])
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [USDC_MASTER_MINTER]
    })
    masterMinter = await ethers.getSigner(USDC_MASTER_MINTER)

    // mint USDC to all test users
    cUSDC = await ethers.getContractAt('CTokenInterface', _loanCcyToken)
    users = [lp1, lp2, lp3, lp4, lp5, borrower]
    for (const user of users) {
      await USDC.connect(masterMinter).configureMinter(masterMinter.address, MAX_UINT128)
      await USDC.connect(masterMinter).mint(user.address, MAX_UINT128)
    }

    // have all lps mint cUSDC from their USDC balances
    lps = [lp1, lp2, lp3, lp4, lp5]
    for (const lp of lps) {
      await USDC.connect(lp).approve(cUSDC.address, MAX_UINT128)
      await cUSDC.connect(lp).mint(MAX_UINT128)
    }

    // mint WETH to borrower account
    WETH = await ethers.getContractAt('IWETH', _collCcyToken)
    await ethers.provider.send('hardhat_setBalance', [borrower.address, '0x204FCE5E3E25026110000000'])
    amount = ethers.BigNumber.from('0x204FCE5E3E25026110000000')
    await WETH.connect(borrower).deposit({ value: amount.sub(ONE_ETH.mul(10)) })

    // get cUSDC exchange rate to calculate _maxLoanPerColl and liquidity bound pool params
    await cUSDC.connect(lp1).exchangeRateCurrent()
    exchangeRateCurrent = await cUSDC.connect(lp1).exchangeRateStored()
    _maxLoanPerColl = ONE_USDC.mul(1000).mul(MONE).div(exchangeRateCurrent)
    _liquidityBnd1 = ONE_USDC.mul(100000).mul(MONE).div(exchangeRateCurrent)
    _liquidityBnd2 = ONE_USDC.mul(1000000).mul(MONE).div(exchangeRateCurrent)
    _minLoan = ONE_USDC.mul(100).mul(MONE).div(exchangeRateCurrent)
    _minLiquidity = ethers.BigNumber.from('44199813427') //ONE_USDC.mul(10).mul(MONE).div(exchangeRateCurrent);

    // deploy pool
    PoolWethCusdc = await ethers.getContractFactory('PoolWethCusdc')
    PoolWethCusdc = await PoolWethCusdc.connect(deployer)
    poolWethCusdc = await PoolWethCusdc.deploy(
      _loanTenor,
      _maxLoanPerColl,
      _r1,
      _r2,
      _liquidityBnd1,
      _liquidityBnd2,
      _minLoan,
      100,
      0
    )
    await poolWethCusdc.deployed()

    // have all test accounts approve pool
    users = [lp1, lp2, lp3, lp4, lp5, borrower]
    for (const user of users) {
      await cUSDC.connect(user).approve(poolWethCusdc.address, MAX_UINT128)
      await WETH.connect(user).approve(poolWethCusdc.address, MAX_UINT128)
    }
  })

  it('Should exchange cUSDC for USDC at expected rate, and vice versa', async function () {
    usdcBal = await USDC.balanceOf(borrower.address)
    cusdcBal = await cUSDC.balanceOf(borrower.address)
    expect(usdcBal).to.be.equal(MAX_UINT128)
    expect(cusdcBal).to.be.equal(0)

    // get current cUSDC exchange rate
    await cUSDC.connect(borrower).exchangeRateCurrent()
    exchangeRateCurrent = await cUSDC.connect(borrower).exchangeRateStored()

    // calculate expected cUSDC amount when depositing 1000 USDC
    expectedCusdcBalAfterMint = ONE_USDC.mul(1000).mul(MONE).div(exchangeRateCurrent)

    // approve cUSDC contract to withdraw USDC
    await USDC.connect(borrower).approve(cUSDC.address, MAX_UINT128)

    // USDC -> cUSDC: i.e., mint cUSDC equivalent of 1000 USDC
    await cUSDC.connect(borrower).mint(ONE_USDC.mul(1000))
    cusdcBalAfterMint = await cUSDC.balanceOf(borrower.address)
    console.log('cusdcBalAfterMint', cusdcBalAfterMint)
    console.log('expectedCusdcBalAfterMint', expectedCusdcBalAfterMint)
    expect(cusdcBalAfterMint).to.be.equal(expectedCusdcBalAfterMint)

    // calculate expected redemption amount when redeeming cUSDC
    await cUSDC.connect(borrower).exchangeRateCurrent()
    exchangeRateCurrent = await cUSDC.connect(borrower).exchangeRateStored()
    expectedUsdcBalDiffAfterRedeem = cusdcBalAfterMint.mul(exchangeRateCurrent).div(MONE)

    // cUSDC -> USDC: i.e., redeem cUSDC for USDC
    usdcBalBeforeRedeem = await USDC.balanceOf(borrower.address)
    cusdcBalBeforeRedeem = await cUSDC.balanceOf(borrower.address)
    await cUSDC.connect(borrower).redeem(cusdcBalBeforeRedeem)
    usdcBalAfterRedeem = await USDC.balanceOf(borrower.address)
    cusdcBalAfterRedeem = await cUSDC.balanceOf(borrower.address)
    usdcBalDiffAfterRedeem = usdcBalAfterRedeem.sub(usdcBalBeforeRedeem)
    expect(cusdcBalAfterRedeem).to.be.equal(0)
    console.log('usdcBalDiffAfterRedeem', usdcBalDiffAfterRedeem)
    console.log('expectedUsdcBalDiffAfterRedeem', expectedUsdcBalDiffAfterRedeem)
    expect(usdcBalDiffAfterRedeem).to.be.equal(expectedUsdcBalDiffAfterRedeem)
  })

  it('Should have correct initial values', async function () {
    poolInfo = await poolWethCusdc.getPoolInfo()
    expect(poolInfo._loanCcyToken).to.be.equal(_loanCcyToken)
    expect(poolInfo._collCcyToken).to.be.equal(_collCcyToken)
    expect(poolInfo._maxLoanPerColl).to.be.equal(_maxLoanPerColl)
    expect(poolInfo._minLoan).to.be.equal(_minLoan)
    expect(poolInfo._loanTenor).to.be.equal(_loanTenor)
    expect(poolInfo._totalLpShares).to.be.equal(0)
    expect(poolInfo._baseAggrBucketSize).to.be.equal(100)
    expect(poolInfo._loanIdx).to.be.equal(1)
  })

  it('Should fail on loan terms without LPs', async function () {
    await expect(poolWethCusdc.loanTerms(ONE_ETH)).to.be.revertedWithCustomError(poolWethCusdc, 'InsufficientLiquidity')
  })

  it('Should allow LPs to add liquidity', async function () {
    // get exchange rate and calculate lp contribution amounts
    exchangeRateCurrent = await cUSDC.connect(lp1).exchangeRateStored()
    lpContribution1 = ONE_USDC.mul(1000).mul(MONE).div(exchangeRateCurrent)
    lpContribution2 = ONE_USDC.mul(10000).mul(MONE).div(exchangeRateCurrent)
    lpContribution3 = ONE_USDC.mul(100000).mul(MONE).div(exchangeRateCurrent)

    // add liquidity
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethCusdc.connect(lp1).addLiquidity(lp1.address, lpContribution1, timestamp + 60, 0)
    await poolWethCusdc.connect(lp2).addLiquidity(lp2.address, lpContribution2, timestamp + 60, 0)
    await poolWethCusdc.connect(lp3).addLiquidity(lp3.address, lpContribution3, timestamp + 60, 0)
    poolInfo = await poolWethCusdc.getPoolInfo()

    // check total liquidity
    expectedTotalLiquidity = lpContribution1.add(lpContribution2).add(lpContribution3)
    expect(poolInfo._totalLiquidity).to.be.equal(expectedTotalLiquidity)

    // check total lp shares
    newLpSharesFromContr1 = lpContribution1.mul(1000).div(_minLiquidity)
    newLpSharesFromContr2 = lpContribution2.mul(newLpSharesFromContr1).div(lpContribution1)
    newLpSharesFromContr3 = lpContribution3
      .mul(newLpSharesFromContr1.add(newLpSharesFromContr2))
      .div(lpContribution1.add(lpContribution2))
    expectedTotalLpShares = newLpSharesFromContr1.add(newLpSharesFromContr2).add(newLpSharesFromContr3)
    expect(poolInfo._totalLpShares).to.be.equal(expectedTotalLpShares)
  })

  it('Should handle add, borrow, repay, claim and remove correctly', async function () {
    // get exchange rate and calculate lp contribution amounts
    exchangeRateCurrent = await cUSDC.connect(lp1).exchangeRateStored()
    lpContribution1 = ONE_USDC.mul(1000).mul(MONE).div(exchangeRateCurrent)
    lpContribution2 = ONE_USDC.mul(10000).mul(MONE).div(exchangeRateCurrent)
    lpContribution3 = ONE_USDC.mul(100000).mul(MONE).div(exchangeRateCurrent)

    // add liquidity
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethCusdc.connect(lp1).addLiquidity(lp1.address, lpContribution1, timestamp + 60, 0)
    await poolWethCusdc.connect(lp2).addLiquidity(lp2.address, lpContribution2, timestamp + 60, 0)
    await poolWethCusdc.connect(lp3).addLiquidity(lp3.address, lpContribution3, timestamp + 60, 0)

    // get loan terms
    loanTerms = await poolWethCusdc.loanTerms(ONE_ETH)
    minLoanLimit = loanTerms[0]
    maxRepayLimit = loanTerms[1]
    console.log(loanTerms)

    // borrow
    currBlock = await ethers.provider.getBlockNumber()
    cusdcBalBeforeBorrow = await cUSDC.balanceOf(borrower.address)
    await poolWethCusdc.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp + 60, 0)
    cusdcBalAfterBorrow = await cUSDC.balanceOf(borrower.address)

    // check cUSDC balance diff
    cusdcBalDiff = cusdcBalAfterBorrow.sub(cusdcBalBeforeBorrow)
    expectedCusdcBalDiff = loanTerms.loanAmount
    expect(cusdcBalDiff).to.be.equal(expectedCusdcBalDiff)

    // check USDC equivalent
    exchangeRateCurrent = await cUSDC.connect(lp1).exchangeRateStored()
    expectedUsdcAmountFromRedeem = cusdcBalDiff.mul(exchangeRateCurrent).div(MONE)

    // redeem cUSDC for cUSDC
    cusdcRedeemAmount = cusdcBalDiff
    cusdcBalBeforeRedeem = await cUSDC.balanceOf(borrower.address)
    usdcBalBeforeRedeem = await USDC.balanceOf(borrower.address)
    await cUSDC.connect(borrower).redeem(cusdcRedeemAmount)
    cusdcBalAfterRedeem = await cUSDC.balanceOf(borrower.address)
    usdcBalBAfterRedeem = await USDC.balanceOf(borrower.address)

    // check balance diffs
    cusdcBalDiff = cusdcBalBeforeRedeem.sub(cusdcBalAfterRedeem)
    expect(cusdcBalDiff).to.be.equal(cusdcRedeemAmount)
    usdcBalDiff = usdcBalBAfterRedeem.sub(usdcBalBeforeRedeem)
    expect(usdcBalDiff).to.be.equal(expectedUsdcAmountFromRedeem)

    // calculate required USDC amount to repay in cUSDC
    exchangeRateCurrent = await cUSDC.connect(lp1).exchangeRateStored()
    requiredUsdcMintAmount = loanTerms.repaymentAmount.mul(MONE).div(exchangeRateCurrent)

    // mint cUSDC
    await cUSDC.connect(borrower).mint(requiredUsdcMintAmount)

    // repay loan
    cusdcBalBeforeRepay = await cUSDC.balanceOf(borrower.address)
    wethBalBeforeRepay = await WETH.balanceOf(borrower.address)
    await poolWethCusdc.connect(borrower).repay(1, borrower.address, loanTerms.repaymentAmount)
    cusdcBalAfterRepay = await cUSDC.balanceOf(borrower.address)
    wethBalAfterRepay = await WETH.balanceOf(borrower.address)

    // check balance diffs
    cusdcBalDiff = cusdcBalBeforeRepay.sub(cusdcBalAfterRepay)
    expect(cusdcBalDiff).to.be.equal(loanTerms.repaymentAmount)
    wethBalDiff = wethBalAfterRepay.sub(wethBalBeforeRepay)
    expect(wethBalDiff).to.be.equal(loanTerms.pledgeAmount)

    // move forward past min lping time
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 60 * 60 * 24 * 365])
    await ethers.provider.send('evm_mine')

    // claim and remove liquidity across all lps
    lps = [lp1, lp2, lp3]
    poolInfo = await poolWethCusdc.getPoolInfo()
    for (const lp of lps) {
      cusdcBalBeforeClaimAndRemove = await cUSDC.balanceOf(lp.address)
      await poolWethCusdc.connect(lp).claim(lp.address, [1], false, timestamp + 9999999)
      lpInfo = await poolWethCusdc.getLpInfo(lp.address)
      await poolWethCusdc.connect(lp).removeLiquidity(lp.address, lpInfo.sharesOverTime[0])
      cusdcBalAfterClaimAndRemove = await cUSDC.balanceOf(lp.address)

      // check bal diff
      cusdcBalDiff = cusdcBalAfterClaimAndRemove.sub(cusdcBalBeforeClaimAndRemove)
      expectedRemoveAmount = poolInfo._totalLiquidity
        .sub(_minLiquidity)
        .mul(lpInfo.sharesOverTime[0])
        .div(poolInfo._totalLpShares)
      expectedClaimAmount = loanTerms.repaymentAmount.mul(lpInfo.sharesOverTime[0]).div(poolInfo._totalLpShares)
      expectedCusdcBalDiff = expectedRemoveAmount.add(expectedClaimAmount)
      expect(cusdcBalDiff).to.be.within(expectedCusdcBalDiff.mul(999).div(1000), expectedCusdcBalDiff.mul(1001).div(1000))
    }
  })
})
