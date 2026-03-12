#!/usr/bin/env npx ts-node
/**
 * 本地测试 SunPump 出售 Meme Token。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-sunpump-sell.ts
 */

import 'dotenv/config'
import { SunKit, LocalWallet } from '../src'
import { getSunPumpAddress } from '../src/kit/sunpump'

const NETWORK = 'nile'
/** 替换为实际的 meme token 地址 */
const TOKEN_ADDRESS = 'TMemeTokenAddress1234567890123456'
/** 出售数量 (token 最小单位) */
const TOKEN_AMOUNT = '1000000000000000000' // 1 token (18 decimals)

async function main() {
  console.log('=== SunPump Sell Token Test ===')
  console.log('TRON_PRIVATE_KEY set:', !!process.env.TRON_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('sunpumpAddress:', getSunPumpAddress(NETWORK))
  console.log('tokenAddress:', TOKEN_ADDRESS)
  console.log('tokenAmount:', TOKEN_AMOUNT)
  console.log('')

  if (!process.env.TRON_PRIVATE_KEY) {
    console.error('Error: TRON_PRIVATE_KEY not set in .env')
    process.exit(1)
  }

  const wallet = new LocalWallet(process.env.TRON_PRIVATE_KEY)
  const sunkit = new SunKit({ wallet })

  // 1) Check token balance
  console.log('--- Step 1: Check Balance ---')
  try {
    const balance = await sunkit.getMemeTokenBalance(TOKEN_ADDRESS, undefined, NETWORK)
    console.log('Token balance:', balance)
    console.log('')
  } catch (err: any) {
    console.error('Error getting balance:', err?.message)
  }

  // 2) Quote sell
  console.log('--- Step 2: Quote Sell ---')
  try {
    const quote = await sunkit.quoteSell(TOKEN_ADDRESS, TOKEN_AMOUNT, NETWORK)
    console.log('Quote:')
    console.log('  Expected TRX:', quote.trxAmount)
    console.log('  Fee:', quote.fee)
    console.log('')
  } catch (err: any) {
    console.error('Error getting quote:', err?.message)
  }

  // 3) Execute sell
  console.log('--- Step 3: Execute Sell ---')
  try {
    const result = await sunkit.sellToken({
      tokenAddress: TOKEN_ADDRESS,
      tokenAmount: TOKEN_AMOUNT,
      slippage: 0.05,
      network: NETWORK,
    })

    console.log('Sell result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    if (err?.stack) console.error('Stack:\n', err.stack)
    process.exit(1)
  }
}

main()
