const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('WETH-DAI Pool Testing', function () {
  const IERC20_SOURCE = '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20'
  const MONE = ethers.BigNumber.from('1000000000000000000') //10**18
  const ONE_DAI = MONE
  const ONE_ETH = MONE
  const _loanCcyToken = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  const _collCcyToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const _loanTenor = 86400
  const _maxLoanPerColl = ONE_DAI.mul(500)
  const _r1 = MONE.mul(2).div(10)
  const _r2 = MONE.mul(2).div(100)
  const _liquidityBnd1 = ONE_DAI.mul(100000)
  const _liquidityBnd2 = ONE_DAI.mul(1000000)
  const _minLoan = ONE_DAI.mul(300)
  const minLiquidity = ONE_DAI.mul(10) //10*10**18
  const DAI_HOLDER = '0x6c6bc977e13df9b0de53b251522280bb72383700'
  const MAX_UINT128 = ethers.BigNumber.from('340282366920938463463374607431768211455')

  before(async () => {
    ;[deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners()

    // prepare DAI balances
    DAI = await ethers.getContractAt(IERC20_SOURCE, _loanCcyToken)
    await ethers.provider.send('hardhat_setBalance', [DAI_HOLDER, '0x56BC75E2D63100000'])
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [DAI_HOLDER]
    })
    daiHolder = await ethers.getSigner(DAI_HOLDER)
    bal = await DAI.balanceOf(DAI_HOLDER)
    expect(bal).to.be.equal('531662329855678383637691110') // account should hold around 530mn DAI

    // transfer DAI to test accounts
    await DAI.connect(daiHolder).transfer(lp1.address, bal.div(6))
    await DAI.connect(daiHolder).transfer(lp2.address, bal.div(6))
    await DAI.connect(daiHolder).transfer(lp3.address, bal.div(6))
    await DAI.connect(daiHolder).transfer(lp4.address, bal.div(6))
    await DAI.connect(daiHolder).transfer(lp5.address, bal.div(6))
    await DAI.connect(daiHolder).transfer(borrower.address, bal.div(6))
  })

  beforeEach(async () => {
    ;[deployer, lp1, lp2, lp3, lp4, lp5, borrower, ...addrs] = await ethers.getSigners()

    // prepare WETH balance
    WETH = await ethers.getContractAt('IWETH', _collCcyToken)
    await ethers.provider.send('hardhat_setBalance', [borrower.address, '0x204FCE5E3E25026110000000'])
    balance = await ethers.provider.getBalance(borrower.address)
    await WETH.connect(borrower).deposit({ value: balance.sub(ONE_ETH) })

    // deploy pool
    PoolWethDai = await ethers.getContractFactory('PoolWethDai')
    PoolWethDai = await PoolWethDai.connect(deployer)
    poolWethDai = await PoolWethDai.deploy(
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
    await poolWethDai.deployed()

    // approve DAI and WETH balances
    DAI.connect(lp1).approve(poolWethDai.address, MAX_UINT128)
    DAI.connect(lp2).approve(poolWethDai.address, MAX_UINT128)
    DAI.connect(lp3).approve(poolWethDai.address, MAX_UINT128)
    DAI.connect(lp4).approve(poolWethDai.address, MAX_UINT128)
    DAI.connect(lp5).approve(poolWethDai.address, MAX_UINT128)
    DAI.connect(borrower).approve(poolWethDai.address, MAX_UINT128)
    WETH.connect(borrower).approve(poolWethDai.address, MAX_UINT128)
  })

  it('Should have sufficient DAI for testing', async function () {
    bal = await DAI.balanceOf(lp1.address)
    expect((await bal).gt(ONE_DAI.mul(80000000))).to.be.true //make sure each lp account has at least 80mn for testing
  })

  it('Should have correct initial values', async function () {
    poolInfo = await poolWethDai.getPoolInfo()
    expect(poolInfo._totalLiquidity).to.be.equal(0)
    expect(poolInfo._loanIdx).to.be.equal(1)
  })

  it('Should fail on loan terms without LPs', async function () {
    await expect(poolWethDai.loanTerms(ONE_ETH)).to.be.revertedWithCustomError(poolWethDai, 'InsufficientLiquidity')
  })

  it('Should correctly calculate loan terms', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(2000000), timestamp + 60, 0)

    // check loan terms and increasing rate
    loanTerms = await poolWethDai.loanTerms(ONE_ETH)
    expect(loanTerms.loanAmount).to.be.equal('499875030617498712815')
    expect(loanTerms.repaymentAmount).to.be.equal('509872531229848687071')
    rate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(10))
    expect(loanTerms.loanAmount).to.be.equal('4987531109880847286021')
    expect(loanTerms.repaymentAmount).to.be.equal('5087281732078464231741')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    rateDiff = tmpRate.sub(rate)
    rateDiff = rateDiff.toNumber()
    expect(rateDiff).to.be.equal(0) // compare APR with APR of smaller loan; here diff is 0 because of constant APR range
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(100))
    expect(loanTerms.loanAmount).to.be.equal('48780481856009053702700')
    expect(loanTerms.repaymentAmount).to.be.equal('49756091493129234776754')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    rateDiff = tmpRate.sub(rate)
    rateDiff = rateDiff.toNumber()
    expect(rateDiff).to.be.equal(1) // compare APR with APR of smaller loan; diff should be 0 but here is 1 due to rounding error
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(1000))
    expect(loanTerms.loanAmount).to.be.equal('399999599998399993599974')
    expect(loanTerms.repaymentAmount).to.be.equal('407999591998367993471973')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    rateDiff = tmpRate.sub(rate)
    rateDiff = rateDiff.toNumber()
    expect(rateDiff).to.be.equal(-1) // compare APR with APR of smaller loan; diff should be 0 but here is -1 due to rounding error
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(10000))
    expect(loanTerms.loanAmount).to.be.equal('1428566326523323604748006')
    expect(loanTerms.repaymentAmount).to.be.equal('1518361195329092039186055')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    tmpRate = tmpRate.toNumber()
    rate = rate.toNumber()
    expect(tmpRate).to.be.greaterThan(rate) // compare APR with APR of smaller loan; rate should be increasing outside of constant APR range
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(100000))
    expect(loanTerms.loanAmount).to.be.equal('1923067677513014906349020')
    expect(loanTerms.repaymentAmount).to.be.equal('2192267108037695107489193')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    tmpRate = tmpRate.toNumber()
    expect(tmpRate).to.be.greaterThan(rate) // compare APR with APR of smaller loan; rate should be increasing outside of constant APR range
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(1000000))
    expect(loanTerms.loanAmount).to.be.equal('1992021952032309801440434')
    expect(loanTerms.repaymentAmount).to.be.equal('4508821057339827841456022')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    tmpRate = tmpRate.toNumber()
    expect(tmpRate).to.be.greaterThan(rate) // compare APR with APR of smaller loan; rate should be increasing outside of constant APR range
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(10000000))
    expect(loanTerms.loanAmount).to.be.equal('1999190327867233762229575')
    expect(loanTerms.repaymentAmount).to.be.equal('26710538731671834621852309')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    tmpRate = tmpRate.toNumber()
    expect(tmpRate).to.be.greaterThan(rate) // compare APR with APR of smaller loan; rate should be increasing outside of constant APR range
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(100000000))
    expect(loanTerms.loanAmount).to.be.equal('1999910003999822007919647')
    expect(loanTerms.repaymentAmount).to.be.equal('224242007868923219707998854')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    tmpRate = tmpRate.toNumber()
    expect(tmpRate).to.be.greaterThan(rate) // compare APR with APR of smaller loan; rate should be increasing outside of constant APR range
    rate = tmpRate

    loanTerms = await poolWethDai.loanTerms(ONE_ETH.mul(1000000000))
    expect(loanTerms.loanAmount).to.be.equal('1999982000111999192005471')
    expect(loanTerms.repaymentAmount).to.be.equal('1113128006504612418009925543')
    tmpRate = loanTerms.repaymentAmount.mul(10000).div(loanTerms.loanAmount)
    tmpRate = tmpRate.toNumber()
    expect(tmpRate).to.be.greaterThan(rate) // compare APR with APR of smaller loan; rate should be increasing outside of constant APR range
  })

  it('Should allow LPs to add liquidity', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(1111), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(10111), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(130111), timestamp + 60, 0)
    poolInfo = await poolWethDai.getPoolInfo()
    expect(poolInfo._totalLiquidity).to.be.equal(ONE_DAI.mul(141333))
  })

  it('Should allow borrowing with ETH', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(1000), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(10000), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(100000), timestamp + 60, 0)

    loanTerms = await poolWethDai.loanTerms(ONE_ETH)
    minLoanLimit = loanTerms[0].mul(98).div(100)
    maxRepayLimit = loanTerms[1].mul(102).div(100)
    console.log(loanTerms)
    console.log(minLoanLimit, maxRepayLimit)
    currBlock = await ethers.provider.getBlockNumber()
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp + 60, 0)
  })

  it('Should not allow new LPs to claim on unentitled previous loans', async function () {
    //add liquidity
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(30000), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(20000), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(10000), timestamp + 60, 0)

    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp

    //borrow & repay
    loanTerms = await poolWethDai.loanTerms(ONE_ETH)
    minLoanLimit = loanTerms[0].mul(98).div(100)
    maxRepayLimit = loanTerms[1].mul(102).div(100)
    await poolWethDai
      .connect(borrower)
      .borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp + 9999999, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(1)
    await poolWethDai.connect(borrower).repay(1, borrower.address, loanInfo.repayment)

    //borrow & repay
    loanTerms = await poolWethDai.loanTerms(ONE_ETH)
    minLoanLimit = loanTerms[0].mul(98).div(100)
    maxRepayLimit = loanTerms[1].mul(102).div(100)
    await poolWethDai
      .connect(borrower)
      .borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp + 9999999, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(2)
    await poolWethDai.connect(borrower).repay(2, borrower.address, loanInfo.repayment)

    //borrow & default
    loanTerms = await poolWethDai.loanTerms(ONE_ETH)
    minLoanLimit = loanTerms[0].mul(98).div(100)
    maxRepayLimit = loanTerms[1].mul(102).div(100)
    await poolWethDai
      .connect(borrower)
      .borrow(borrower.address, ONE_ETH, minLoanLimit, maxRepayLimit, timestamp + 9999999, 0)

    //move forward to loan expiry
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 60 * 60 * 24 * 365])
    await ethers.provider.send('evm_mine')

    //claim
    await poolWethDai.connect(lp1).claim(lp1.address, [1, 2, 3], false, timestamp + 9999999)

    //remove liquidity
    let lp1NumSharesPre = await poolWethDai.getLpInfo(lp1.address)
    await poolWethDai.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre.sharesOverTime[0])

    //cannot remove twice
    await expect(
      poolWethDai.connect(lp1).removeLiquidity(lp1.address, lp1NumSharesPre.sharesOverTime[0])
    ).to.be.revertedWithCustomError(poolWethDai, 'InvalidRemove')

    lp1NumSharesPost = await poolWethDai.getLpInfo(lp1.address)
    await expect(lp1NumSharesPost.sharesOverTime[0]).to.be.equal(0) // shares get overwritten to zero because LP claimed up until curr loan idx

    //ensure new lp cannot claim on previous loan
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp4).addLiquidity(lp4.address, ONE_DAI.mul(1000), timestamp + 60, 0)
    await expect(poolWethDai.connect(lp4).claim(lp4.address, [1], false, timestamp + 9999999)).to.be.revertedWithCustomError(
      poolWethDai,
      'UnentitledFromLoanIdx'
    )
    await expect(poolWethDai.connect(lp4).claim(lp4.address, [2], false, timestamp + 9999999)).to.be.revertedWithCustomError(
      poolWethDai,
      'UnentitledFromLoanIdx'
    )
    await expect(poolWethDai.connect(lp4).claim(lp4.address, [3], false, timestamp + 9999999)).to.be.revertedWithCustomError(
      poolWethDai,
      'UnentitledFromLoanIdx'
    )
    await expect(
      poolWethDai.connect(lp4).claim(lp4.address, [1, 2], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'UnentitledFromLoanIdx')
    await expect(
      poolWethDai.connect(lp4).claim(lp4.address, [2, 3], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'UnentitledFromLoanIdx')
    await expect(
      poolWethDai.connect(lp4).claim(lp4.address, [1, 3], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'UnentitledFromLoanIdx')
    await expect(
      poolWethDai.connect(lp4).claim(lp4.address, [1, 2, 3], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'UnentitledFromLoanIdx')
  })

  it("Should be possible to borrow when there's sufficient liquidity, and allow new LPs to add liquidity to make borrowing possible again", async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(1000), timestamp + 60, 0)

    // iteratively take out borrows until until liquidity so low that loan amount below min. loan
    numBorrows = 0
    tooSmallLoans = false
    for (let i = 0; i < 100; i++) {
      try {
        loanTerms = await poolWethDai.loanTerms(ONE_ETH)
        await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
        numBorrows += 1
        console.log('loanTerms: ', loanTerms)
      } catch (error) {
        console.log('loanTerms error: ', error)
        await expect(
          poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
        ).to.be.revertedWithCustomError(poolWethDai, 'LoanTooSmall')
        tooSmallLoans = true
        break
      }
    }
    // check that some loans were taken out before eventually borrowing starts to revert
    expect(numBorrows).to.be.gte(0)
    expect(tooSmallLoans).to.be.true

    // add liquidity again
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(1000), timestamp + 60, 0)

    // take out a loan should be possible again without revert after liquidity add
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
  })

  it('Should allow LPs to claim individually', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(100000), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(100000), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(100000), timestamp + 60, 0)

    for (let i = 0; i < 100; i++) {
      loanTerms = await poolWethDai.loanTerms(ONE_ETH)
      await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
      loanInfo = await poolWethDai.loanIdxToLoanInfo(i + 1)
      await poolWethDai.connect(borrower).repay(i + 1, borrower.address, loanInfo.repayment)
    }
    loanIds = Array.from(Array(100), (_, index) => index + 1)

    await poolWethDai.connect(lp1).claim(lp1.address, loanIds, false, timestamp + 9999999)
    //cannot claim twice
    await expect(
      poolWethDai.connect(lp1).claim(lp1.address, loanIds, false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'UnentitledFromLoanIdx')

    await poolWethDai.connect(lp2).claim(lp2.address, loanIds, false, timestamp + 9999999)
    await poolWethDai.connect(lp3).claim(lp3.address, loanIds, false, timestamp + 9999999)
  })

  it('Should handle aggregate claims correctly (1/2)', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(500000), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(500000), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(300000), timestamp + 60, 0)
    await poolWethDai.connect(lp4).addLiquidity(lp4.address, ONE_DAI.mul(200000), timestamp + 60, 0)

    totalRepaymentsIndicative = ethers.BigNumber.from(0)
    totalRepayments = ethers.BigNumber.from(0)
    totalInterestCosts = ethers.BigNumber.from(0)
    preBorrBal = await DAI.balanceOf(borrower.address)
    pledgeAmount = ONE_ETH.mul(2)

    for (let i = 0; i < 99; i++) {
      //indicative repayment
      loanTerms = await poolWethDai.loanTerms(pledgeAmount)
      totalRepaymentsIndicative = totalRepaymentsIndicative.add(loanTerms[1])
      //borrow
      await poolWethDai.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp + 1000000000, 0)
      //actual repayment
      loanInfo = await poolWethDai.loanIdxToLoanInfo(i + 1)
      totalRepayments = totalRepayments.add(loanInfo[0])
      await expect(loanTerms[1]).to.be.equal(loanInfo[0])
      //interest costs
      totalInterestCosts = totalInterestCosts.add(loanTerms[1].sub(loanTerms[0]))
      //repay
      loanInfo = await poolWethDai.loanIdxToLoanInfo(i + 1)
      await poolWethDai.connect(borrower).repay(i + 1, borrower.address, loanInfo.repayment)
    }
    await expect(totalRepaymentsIndicative).to.be.equal(totalRepayments)
    console.log('totalRepayments', totalRepayments)
    //total interest cost
    postBorrBal = await DAI.balanceOf(borrower.address)
    await expect(preBorrBal.sub(postBorrBal)).to.be.equal(totalInterestCosts)

    //lp1 claims individually
    preClaimBal = await DAI.balanceOf(lp1.address)
    loanIds = Array.from(Array(99), (_, index) => index + 1)

    await poolWethDai.connect(lp1).claim(lp1.address, loanIds, false, timestamp + 9999999)
    postClaimBal = await DAI.balanceOf(lp1.address)
    expClaim = totalRepayments.mul(5).div(15)
    actClaim = postClaimBal.sub(preClaimBal)
    pct = actClaim.mul(10000).div(actClaim)
    await expect(10000 <= pct && pct <= 10010).to.be.true

    //cannot claim twice
    await expect(
      poolWethDai.connect(lp1).claimFromAggregated(lp1.address, [0, 100], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'UnentitledFromLoanIdx')

    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 60 * 60 * 24 * 365])
    await ethers.provider.send('evm_mine')

    //lp2 claims via aggregate
    benchmarkDiff = postClaimBal.sub(preClaimBal)
    preClaimBal = await DAI.balanceOf(lp2.address)
    await poolWethDai.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp + 9999999)
    postClaimBal = await DAI.balanceOf(lp2.address)
    diff = postClaimBal.sub(preClaimBal)
    await expect(benchmarkDiff).to.be.equal(diff)

    //cannot claim twice
    await expect(
      poolWethDai.connect(lp2).claimFromAggregated(lp2.address, [0, 100], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'UnentitledFromLoanIdx')

    //lp3 claims
    preClaimBal = await DAI.balanceOf(lp3.address)
    await poolWethDai.connect(lp3).claimFromAggregated(lp3.address, [0, 100], false, timestamp + 9999999)
    postClaimBal = await DAI.balanceOf(lp3.address)
    expClaim = totalRepayments.mul(5).div(15)
    actClaim = postClaimBal.sub(preClaimBal)
    pct = actClaim.mul(10000).div(actClaim)
    await expect(10000 <= pct && pct <= 10010).to.be.true

    //lp4 claims
    preClaimBal = await DAI.balanceOf(lp4.address)
    await poolWethDai.connect(lp4).claimFromAggregated(lp4.address, [0, 100], false, timestamp + 9999999)
    postClaimBal = await DAI.balanceOf(lp4.address)
    expClaim = totalRepayments.mul(5).div(15)
    actClaim = postClaimBal.sub(preClaimBal)
    pct = actClaim.mul(10000).div(actClaim)
    await expect(10000 <= pct && pct <= 10010).to.be.true
  })

  it('Should handle aggregate claims correctly (2/2)', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(500000), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(300000), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(200000), timestamp + 60, 0)

    totalRepayments = ethers.BigNumber.from(0)
    totalLeftColl = ethers.BigNumber.from(0)

    //1st borrow & repay
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(1)
    totalRepayments = totalRepayments.add(loanInfo[0])
    await poolWethDai.connect(borrower).repay(1, borrower.address, loanInfo.repayment)

    //2nd borrow & repay
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(2)
    totalRepayments = totalRepayments.add(loanInfo[0])
    await poolWethDai.connect(borrower).repay(2, borrower.address, loanInfo.repayment)

    //3rd borrow & default
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
    totalLeftColl = totalLeftColl.add(ONE_ETH)

    //move forward to loan expiry
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 60 * 60 * 24 * 365])
    await ethers.provider.send('evm_mine')

    //lp1 claims
    console.log('totalRepayments', totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp1.address) //await ethers.provider.getBalance(lp1.address);
    preClaimTokenBal = await DAI.balanceOf(lp1.address)
    await expect(
      poolWethDai.connect(lp1).claimFromAggregated(lp1.address, [1, 3], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'InvalidSubAggregation')
    await poolWethDai.connect(lp1).claim(lp1.address, [1, 2, 3], false, timestamp + 9999999)
    postClaimEthBal = await WETH.balanceOf(lp1.address) //ethers.provider.getBalance(lp1.address);
    postClaimTokenBal = await DAI.balanceOf(lp1.address)

    //WETH diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal)
    expEthDiff = totalLeftColl.mul(5).div(10)
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect(10000 <= pctEthDiff && pctEthDiff <= 10010).to.be.true

    //token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal)
    expTokenDiff = totalRepayments.mul(5).div(10)
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect(10000 <= pctEthDiff && pctEthDiff <= 10010).to.be.true

    //lp2 claims
    console.log('totalRepayments', totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp2.address) //await ethers.provider.getBalance(lp2.address);
    preClaimTokenBal = await DAI.balanceOf(lp2.address)
    await expect(
      poolWethDai.connect(lp2).claimFromAggregated(lp2.address, [1, 3], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'InvalidSubAggregation')
    await poolWethDai.connect(lp2).claim(lp2.address, [1, 2, 3], false, timestamp + 9999999)
    postClaimEthBal = await WETH.balanceOf(lp2.address) //await ethers.provider.getBalance(lp2.address);
    postClaimTokenBal = await DAI.balanceOf(lp2.address)

    //ETH diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal)
    expEthDiff = totalLeftColl.mul(3).div(10)
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect(10000 <= pctEthDiff && pctEthDiff <= 10010).to.be.true

    //token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal)
    expTokenDiff = totalRepayments.mul(3).div(10)
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect(10000 <= pctEthDiff && pctEthDiff <= 10010).to.be.true

    //lp3 claims
    console.log('totalRepayments', totalRepayments)
    preClaimEthBal = await WETH.balanceOf(lp3.address) //await ethers.provider.getBalance(lp3.address);
    preClaimTokenBal = await DAI.balanceOf(lp3.address)
    await expect(
      poolWethDai.connect(lp3).claimFromAggregated(lp3.address, [1, 3], false, timestamp + 9999999)
    ).to.be.revertedWithCustomError(poolWethDai, 'InvalidSubAggregation')
    await poolWethDai.connect(lp3).claim(lp3.address, [1, 2, 3], false, timestamp + 9999999)
    postClaimEthBal = await WETH.balanceOf(lp3.address) //await ethers.provider.getBalance(lp3.address);
    postClaimTokenBal = await DAI.balanceOf(lp3.address)

    //ETH diffs
    ethDiff = postClaimEthBal.sub(preClaimEthBal)
    expEthDiff = totalLeftColl.mul(2).div(10)
    pctEthDiff = expEthDiff.mul(10000).div(ethDiff)
    await expect(10000 <= pctEthDiff && pctEthDiff <= 10010).to.be.true

    //token diffs
    tokenDiff = postClaimTokenBal.sub(preClaimTokenBal)
    expTokenDiff = totalRepayments.mul(2).div(10)
    pctTokenDiff = expTokenDiff.mul(10000).div(tokenDiff)
    await expect(10000 <= pctEthDiff && pctEthDiff <= 10010).to.be.true
  })

  it('Should allow removing liquidity test', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(500000), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(300000), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(200000), timestamp + 60, 0)

    totalRepayments = ethers.BigNumber.from(0)
    totalLeftColl = ethers.BigNumber.from(0)

    for (let i = 0; i < 100; i++) {
      await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
      loanInfo = await poolWethDai.loanIdxToLoanInfo(i + 1)
      totalRepayments = totalRepayments.add(loanInfo[0])
      await poolWethDai.connect(borrower).repay(i + 1, borrower.address, loanInfo.repayment)
    }

    for (let i = 0; i < 99; i++) {
      await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
      loanInfo = await poolWethDai.loanIdxToLoanInfo(i + 101)
      totalRepayments = totalRepayments.add(loanInfo[0])
    }

    //move forward to loan expiry
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 60 * 60 * 24 * 365])
    await ethers.provider.send('evm_mine')

    //claim
    await poolWethDai.connect(lp1).claimFromAggregated(lp1.address, [0, 100, 200], false, timestamp + 9999999)
    await poolWethDai.connect(lp2).claimFromAggregated(lp2.address, [0, 100, 200], false, timestamp + 9999999)

    //remove liquidity
    const lp1NumShares = await poolWethDai.getLpInfo(lp1.address)
    const lp2NumShares = await poolWethDai.getLpInfo(lp2.address)
    const lp3NumShares = await poolWethDai.getLpInfo(lp3.address)

    await poolWethDai.connect(lp1).removeLiquidity(lp1.address, lp1NumShares.sharesOverTime[0])
    await poolWethDai.connect(lp2).removeLiquidity(lp2.address, lp2NumShares.sharesOverTime[0])
    await poolWethDai.connect(lp3).removeLiquidity(lp3.address, lp3NumShares.sharesOverTime[0])

    balEth = await WETH.balanceOf(poolWethDai.address) //await ethers.provider.getBalance(poolWethDai.address);
    balTestToken = await DAI.balanceOf(poolWethDai.address)
    poolInfo = await poolWethDai.getPoolInfo()

    await expect(poolInfo._totalLiquidity).to.be.equal(minLiquidity)
    await expect(poolInfo._totalLpShares).to.be.equal(0)
    console.log('(2/2) balEth:', balEth)
    console.log('(2/2) balTestToken:', balTestToken)
    console.log('(2/2) totalLiquidity:', poolInfo._totalLiquidity)
    console.log('(2/2) totalLpShares:', poolInfo._totalLpShares)
  })

  it('Should allow adding liquidity again after removing and claiming', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(500000), timestamp + 60, 0)
    await poolWethDai.connect(lp2).addLiquidity(lp2.address, ONE_DAI.mul(300000), timestamp + 60, 0)
    await poolWethDai.connect(lp3).addLiquidity(lp3.address, ONE_DAI.mul(200000), timestamp + 60, 0)

    totalRepayments = ethers.BigNumber.from(0)
    totalLeftColl = ethers.BigNumber.from(0)

    //1st borrow & repay
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(1)
    totalRepayments = totalRepayments.add(loanInfo[0])
    await poolWethDai.connect(borrower).repay(1, borrower.address, loanInfo.repayment)

    //2nd borrow & repay
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(2)
    totalRepayments = totalRepayments.add(loanInfo[0])
    await poolWethDai.connect(borrower).repay(2, borrower.address, loanInfo.repayment)

    //3rd borrow & default
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
    totalLeftColl = totalLeftColl.add(ONE_ETH)

    //move forward to loan expiry
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 60 * 60 * 24 * 365])
    await ethers.provider.send('evm_mine')

    //claim
    await poolWethDai.connect(lp1).claim(lp1.address, [1, 2, 3], false, timestamp + 9999999)
    await poolWethDai.connect(lp2).claim(lp2.address, [1, 2, 3], false, timestamp + 9999999)
    await poolWethDai.connect(lp3).claim(lp3.address, [1, 2, 3], false, timestamp + 9999999)

    //remove liquidity
    const lp1NumShares = await poolWethDai.getLpInfo(lp1.address)
    const lp2NumShares = await poolWethDai.getLpInfo(lp2.address)
    const lp3NumShares = await poolWethDai.getLpInfo(lp3.address)

    await poolWethDai.connect(lp1).removeLiquidity(lp1.address, lp1NumShares.sharesOverTime[0])
    await poolWethDai.connect(lp2).removeLiquidity(lp2.address, lp2NumShares.sharesOverTime[0])
    await poolWethDai.connect(lp3).removeLiquidity(lp3.address, lp3NumShares.sharesOverTime[0])

    balEth = await WETH.balanceOf(poolWethDai.address) //await ethers.provider.getBalance(poolWethDai.address);
    balTestToken = await DAI.balanceOf(poolWethDai.address)
    console.log('balEth:', balEth)
    console.log('balTestToken:', balTestToken)

    //add liquidity with dust should automatically transfer
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(500000), timestamp + 1000, 0)

    //check dust was transferred to creator
    balCreator = await DAI.balanceOf(deployer.address)
    await expect(balCreator).to.be.equal(minLiquidity)

    //check lp shares
    poolInfo = await poolWethDai.getPoolInfo()
    await expect(poolInfo._totalLpShares).to.be.equal(ONE_DAI.mul(500000).mul(1000).div(minLiquidity))
  })

  it('Should never fall below minLiquidity', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(1001), timestamp + 60, 0)

    //large borrow
    await ethers.provider.send('hardhat_setBalance', [borrower.address, '0x152D02C7E14AF6800000'])
    await poolWethDai
      .connect(borrower)
      .borrow(borrower.address, ONE_ETH.mul(10000), 0, MAX_UINT128, timestamp + 1000000000, 0)

    //check total liquidity & balance
    poolInfo = await poolWethDai.getPoolInfo()
    balance = await DAI.balanceOf(poolWethDai.address)
    console.log('totalLiquidity:', poolInfo._totalLiquidity)
    console.log('balance:', balance)
    expect(poolInfo._totalLiquidity).to.be.equal(balance)
    expect(poolInfo._totalLiquidity).to.be.gte(minLiquidity)
  })

  it('Should allow rolling over loan', async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    await poolWethDai.connect(lp1).addLiquidity(lp1.address, ONE_DAI.mul(100000), timestamp + 60, 0)

    pledgeAmount = ONE_ETH
    await poolWethDai.connect(borrower).borrow(borrower.address, ONE_ETH, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(1)

    loanTerms = await poolWethDai.loanTerms(loanInfo.collateral)
    balTestTokenPre = await DAI.balanceOf(borrower.address)
    await poolWethDai
      .connect(borrower)
      .rollOver(1, 0, MAX_UINT128, timestamp + 1000000000, loanInfo.repayment.sub(loanTerms[0]))
    balTestTokenPost = await DAI.balanceOf(borrower.address)

    expRollCost = loanInfo.repayment.sub(loanTerms[0])
    actRollCost = balTestTokenPre.sub(balTestTokenPost)
    expect(expRollCost).to.be.equal(actRollCost)
  })

  it("Shouldn't overflow even after 4x rounds of consecutive LPing with DAI ≈80mn and borrowing against 120,000,000 ETH", async function () {
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    pledgeAmount = ONE_ETH.mul(120000000)

    bal = await DAI.balanceOf(lp1.address)

    await poolWethDai.connect(lp1).addLiquidity(lp1.address, bal, timestamp + 1000000000, 0)
    loanTerms = await poolWethDai.loanTerms(pledgeAmount)
    console.log(loanTerms)
    await poolWethDai.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(1)

    poolInfo = await poolWethDai.getPoolInfo()
    console.log(loanInfo)
    console.log(poolInfo._totalLiquidity)
    console.log(poolInfo._totalLpShares)

    await poolWethDai.connect(lp2).addLiquidity(lp2.address, bal, timestamp + 1000000000, 0)
    loanTerms = await poolWethDai.loanTerms(pledgeAmount)
    console.log(loanTerms)
    await poolWethDai.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(2)

    poolInfo = await poolWethDai.getPoolInfo()
    console.log(loanInfo)
    console.log(poolInfo._totalLiquidity)
    console.log(poolInfo._totalLpShares)

    await poolWethDai.connect(lp3).addLiquidity(lp3.address, bal, timestamp + 1000000000, 0)
    loanTerms = await poolWethDai.loanTerms(pledgeAmount)
    console.log(loanTerms)
    await poolWethDai.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(3)

    poolInfo = await poolWethDai.getPoolInfo()
    console.log(loanInfo)
    console.log(poolInfo._totalLiquidity)
    console.log(poolInfo._totalLpShares)

    await poolWethDai.connect(lp4).addLiquidity(lp4.address, bal, timestamp + 1000000000, 0)
    loanTerms = await poolWethDai.loanTerms(pledgeAmount)
    console.log(loanTerms)
    await poolWethDai.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp + 1000000000, 0)
    loanInfo = await poolWethDai.loanIdxToLoanInfo(4)

    poolInfo = await poolWethDai.getPoolInfo()
    console.log(loanInfo)
    console.log(poolInfo._totalLiquidity)
    console.log(poolInfo._totalLpShares)
  })

  it('(1/2) Should handle consecutively large add and borrows correctly (7x iterations before overflow)', async function () {
    // transfer all DAI to lp1
    users = [borrower, lp2, lp3, lp4, lp5]
    for (const user of users) {
      bal = await DAI.balanceOf(user.address)
      await DAI.connect(user).transfer(lp1.address, bal)
    }

    // check balance of lp1
    bal = await DAI.balanceOf(lp1.address)
    expect(bal).to.be.equal('525998336154986862124593707') // approx. 526mn DAI

    // get timestamp
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp

    // consecutively do large add and deplete pool
    counter = 0
    totalLoaned = ethers.BigNumber.from('0')
    totalRepayment = ethers.BigNumber.from('0')
    totalPledged = ethers.BigNumber.from('0')
    for (let i = 0; i < 100; i++) {
      lpDaiBal = await DAI.balanceOf(lp1.address)
      poolInfo = await poolWethDai.getPoolInfo()
      console.log('trying to add liquidity:', lpDaiBal)
      console.log('pool has totalLiquidity of:', poolInfo._totalLiquidity)
      console.log('pool has totalLpShares of:', poolInfo._totalLpShares)
      if (i == 0) {
        newLpShares = lpDaiBal.mul(1000).div(minLiquidity)
        totalLpSharesAfterAdd = newLpShares
      } else {
        newLpShares = lpDaiBal.mul(poolInfo._totalLpShares).div(poolInfo._totalLiquidity)
        totalLpSharesAfterAdd = poolInfo._totalLpShares.add(newLpShares)
      }

      // try adding large liquidity amount
      try {
        await poolWethDai.connect(lp1).addLiquidity(lp1.address, lpDaiBal, timestamp + 1000000000, 0)
        counter += 1
      } catch (error) {
        await expect(
          poolWethDai.connect(lp1).addLiquidity(lp1.address, lpDaiBal, timestamp + 1000000000, 0)
        ).to.be.revertedWithCustomError(poolWethDai, 'InvalidAddAmount')
        break
      }
      poolInfo = await poolWethDai.getPoolInfo()
      expect(totalLpSharesAfterAdd).to.be.equal(poolInfo._totalLpShares)
      console.log('poolInfo 1:', poolInfo)

      // prepare borrower's WETH balance
      WETH = await ethers.getContractAt('IWETH', _collCcyToken)
      await ethers.provider.send('hardhat_setBalance', [borrower.address, '0x204FCE5E3E25026110000000'])
      pledgeAmount = ethers.BigNumber.from('0x204FCE5E3E25026110000000').sub(ONE_ETH)
      await WETH.connect(borrower).deposit({ value: pledgeAmount })
      borrowerWEthBal = await WETH.balanceOf(borrower.address)
      console.log('WETH bal', borrowerWEthBal)

      // get loan terms for large borrow
      loanTerms = await poolWethDai.loanTerms(pledgeAmount)
      totalLoaned = totalLoaned.add(loanTerms.loanAmount)
      totalRepayment = totalRepayment.add(loanTerms.repaymentAmount)
      totalPledged = totalPledged.add(loanTerms.pledgeAmount)

      // deplete pool by large borrow
      await poolWethDai.connect(borrower).borrow(borrower.address, pledgeAmount, 0, MAX_UINT128, timestamp + 1000000000, 0)
      poolInfo = await poolWethDai.getPoolInfo()
      console.log('poolInfo 2:', poolInfo)

      // send DAI to lp to test adding liquidity again
      borrowerDaiBal = await DAI.balanceOf(borrower.address)
      await DAI.connect(borrower).transfer(lp1.address, borrowerDaiBal)
      lpDaiBal = await DAI.balanceOf(lp1.address)
    }
    expect(counter).to.be.equal(7)
    console.log('totalLoaned', totalLoaned)
    console.log('totalRepayment', totalRepayment)
    console.log('totalPledged', totalPledged)
    expect(totalLoaned).to.be.equal('3681600979894270315427817139') // aprox. $3.7bn
    expect(totalRepayment).to.be.equal('4383698105736210772780875326') // aprox. $4.4bn
    expect(totalPledged).to.be.equal('69999999993000000000000000000') // aprox. 70bn ETH vs 122,375,913 total supply
  })

  it('(2/2) Should handle consecutively small add and borrows correctly (25x iterations before overflow)', async function () {
    // transfer all DAI to lp1
    users = [borrower, lp2, lp3, lp4, lp5]
    for (const user of users) {
      bal = await DAI.balanceOf(user.address)
      await DAI.connect(user).transfer(lp1.address, bal)
    }

    // get timestamp
    blocknum = await ethers.provider.getBlockNumber()
    timestamp = (await ethers.provider.getBlock(blocknum)).timestamp

    // fill up large collateral amount
    WETH = await ethers.getContractAt('IWETH', _collCcyToken)
    await ethers.provider.send('hardhat_setBalance', [borrower.address, '0x204FCE5E3E25026110000000'])
    amount = ethers.BigNumber.from('0x204FCE5E3E25026110000000')
    await WETH.connect(borrower).deposit({ value: amount.sub(ONE_ETH) })

    // consecutively add and deplete pool
    numAdds = 0
    numBorrows = 0
    for (let i = 0; i < 100; i++) {
      // define small add amount
      if (i == 0) {
        addAmount = minLiquidity.add(_minLoan)
      } else {
        addAmount = _minLoan
      }

      // add small amount of liquidity
      try {
        await poolWethDai.connect(lp1).addLiquidity(lp1.address, addAmount, timestamp + 1000000000, 0)
        numAdds += 1
      } catch (error) {
        await expect(
          poolWethDai.connect(lp1).addLiquidity(lp1.address, addAmount, timestamp + 1000000000, 0)
        ).to.be.revertedWithCustomError(poolWethDai, 'InvalidAddAmount')
        break
      }

      // try depleting pool by pledging large collateral amount
      console.log('try borrowing against', ONE_ETH.mul(100))
      poolInfo = await poolWethDai.getPoolInfo()
      console.log('pool has totalLiquidity of:', poolInfo._totalLiquidity)
      console.log('pool has totalLpShares of:', poolInfo._totalLpShares)
      try {
        await poolWethDai
          .connect(borrower)
          .borrow(borrower.address, ONE_ETH.mul(100), 0, MAX_UINT128, timestamp + 1000000000, 0)
        numBorrows += 1
      } catch (error) {
        try {
          await expect(
            poolWethDai
              .connect(borrower)
              .borrow(borrower.address, ONE_ETH.mul(100), 0, MAX_UINT128, timestamp + 1000000000, 0)
          ).to.be.revertedWithCustomError(poolWethDai, 'LoanTooSmall')
        } catch (error) {
          await poolWethDai
            .connect(borrower)
            .borrow(borrower.address, ONE_ETH.mul(100), 0, MAX_UINT128, timestamp + 1000000000, 0)
        }
      }
    }
    // check number of adds before lp shares overflow
    expect(numAdds).to.be.equal(25)

    //move forward to loan expiry
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 60 * 60 * 24 * 365])
    await ethers.provider.send('evm_mine')

    // check that lp can still remove all his funds despite lp share overflow
    loanIds = Array.from({ length: numBorrows }, (_, i) => i + 1)
    lpInfo = await poolWethDai.getLpInfo(lp1.address)
    console.log('lpInfo', lpInfo)
    for (const loanId of loanIds) {
      await poolWethDai.connect(lp1).claim(lp1.address, [loanId], false, timestamp + 9999999)
    }
    lpInfo = await poolWethDai.getLpInfo(lp1.address)
    await poolWethDai.connect(lp1).removeLiquidity(lp1.address, lpInfo.sharesOverTime[lpInfo.sharesOverTime.length - 1])
  })
})
