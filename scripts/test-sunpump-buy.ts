#!/usr/bin/env npx ts-node
/**
 * 本地测试 SunPump 购买 Meme Token。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-sunpump-buy.ts
 */

import 'dotenv/config'
import { SunKit, LocalWallet } from '../src'
import { getSunPumpAddress } from '../src/kit/sunpump'

const NETWORK = 'nile'
/** 替换为实际的 meme token 地址 */
const TOKEN_ADDRESS = 'TMemeTokenAddress1234567890123456'
/** 购买金额 (Sun, 1 TRX = 1000000 Sun) */
const TRX_AMOUNT = '10000000' // 10 TRX

async function main() {
  console.log('=== SunPump Buy Token Test ===')
  console.log('TRON_PRIVATE_KEY set:', !!process.env.TRON_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('sunpumpAddress:', getSunPumpAddress(NETWORK))
  console.log('tokenAddress:', TOKEN_ADDRESS)
  console.log('trxAmount:', TRX_AMOUNT)
  console.log('')

  if (!process.env.TRON_PRIVATE_KEY) {
    console.error('Error: TRON_PRIVATE_KEY not set in .env')
    process.exit(1)
  }

  const wallet = new LocalWallet(process.env.TRON_PRIVATE_KEY)
  const sunkit = new SunKit({ wallet })

  // 1) Get token info first
  console.log('--- Step 1: Get Token Info ---')
  try {
    const info = await sunkit.getSunPumpTokenInfo(TOKEN_ADDRESS, NETWORK)
    console.log('Token info:')
    console.log(JSON.stringify(info, null, 2))
    console.log('')

    if (info.launched) {
      console.log('Token has launched to DEX. Use SunSwap V2 for trading.')
      process.exit(0)
    }
  } catch (err: any) {
    console.error('Error getting token info:', err?.message)
  }

  // 2) Quote buy
  console.log('--- Step 2: Quote Buy ---')
  try {
    const quote = await sunkit.quoteBuy(TOKEN_ADDRESS, TRX_AMOUNT, NETWORK)
    console.log('Quote:')
    console.log('  Expected tokens:', quote.tokenAmount)
    console.log('  Fee:', quote.fee)
    console.log('')
  } catch (err: any) {
    console.error('Error getting quote:', err?.message)
  }

  // 3) Execute buy
  console.log('--- Step 3: Execute Buy ---')
  try {
    const result = await sunkit.buyToken({
      tokenAddress: TOKEN_ADDRESS,
      trxAmount: TRX_AMOUNT,
      slippage: 0.05,
      network: NETWORK,
    })

    console.log('Buy result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    if (err?.stack) console.error('Stack:\n', err.stack)
    process.exit(1)
  }
}

main()
