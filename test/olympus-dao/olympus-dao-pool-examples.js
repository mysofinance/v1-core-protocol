const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('Olympus DAO Examples', function () {

  const IERC20_SOURCE = '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20'
  const ONE_DAI = ethers.BigNumber.from('10').pow('18')
  const ONE_GOHM = ONE_DAI
  const DAI_ADDR = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  const GOHM_ADDR = '0x0ab87046fBb341D058F17CBC4c1133F25a20a52f'
  const POOL_ADDR = '0xb339953fC028B9998775C00594a74Dd1488eE2c6'
  const OLYMPUS_MULTISIG = '0x245cc372C84B3645Bf0Ffe6538620B04a217988B'
  const GOHM_HOLDER = '0x2796317b0fF8538F253012862c06787Adfb8cEb6'
  const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1)

  async function setup() {

    const Pool = await ethers.getContractFactory('PoolGohmDai_v_1_1')
    const pool = await Pool.attach(POOL_ADDR)

    // impersonate pool creator
    const mysoCreatorAddr = await pool.poolCreator()
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [mysoCreatorAddr],
    })
    const mysoCreator = await ethers.getSigner(mysoCreatorAddr)

    // impersonate olympus dao multisig
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [OLYMPUS_MULTISIG],
    })
    const olympusMultisig = await ethers.getSigner(OLYMPUS_MULTISIG)
    
    await ethers.provider.send('hardhat_setBalance', [
      mysoCreator.address,
      '0x56BC75E2D63100000',
    ])

    // transfer ownership
    await pool.connect(mysoCreator).proposeNewCreator(olympusMultisig.address)

    // impersonate gohm holder
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [GOHM_HOLDER],
    })
    const gohmHolder = await ethers.getSigner(GOHM_HOLDER)
    

    return { pool, olympusMultisig, gohmHolder }
  }

  it('Example: claim pool admin role, add liquidity, emulate borrowing/repaying, remove liquidty', async function () {
    const { pool, olympusMultisig, gohmHolder } = await setup()

    // claim pool admin role
    await pool.connect(olympusMultisig).claimCreator()

    // add liquidity
    const blocknum = await ethers.provider.getBlockNumber()
    const timestamp = (await ethers.provider.getBlock(blocknum)).timestamp
    const addAmount = ONE_DAI.mul(500000)
    const dai = await ethers.getContractAt(IERC20_SOURCE, DAI_ADDR)
    await dai.connect(olympusMultisig).approve(pool.address, MAX_UINT128)
    await pool.connect(olympusMultisig).addLiquidity(olympusMultisig.address, addAmount, timestamp+60, 0)
    
    // emulate borrow activity
    const gohm = await ethers.getContractAt(IERC20_SOURCE, GOHM_ADDR)
    await gohm.connect(gohmHolder).approve(pool.address, MAX_UINT128)
    await pool.connect(gohmHolder).borrow(gohmHolder.address, ONE_GOHM, 0, MAX_UINT128, timestamp+1000000000, 0)
    const loanInfo = await pool.loanIdxToLoanInfo(1)
    console.log(loanInfo.repayment)
    await dai.connect(gohmHolder).approve(pool.address, MAX_UINT128)
    await pool.connect(gohmHolder).repay(1, gohmHolder.address, loanInfo.repayment)

    // claim
    await pool.connect(olympusMultisig).claim(olympusMultisig.address, [1], false, timestamp+120)

    // move forward in time
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60*60*24*365])
    await ethers.provider.send("evm_mine")

    // remove liquidity
    const lpInfo = await pool.getLpInfo(olympusMultisig.address)
    await pool.connect(olympusMultisig).removeLiquidity(olympusMultisig.address, lpInfo.sharesOverTime[0])
  })
})
