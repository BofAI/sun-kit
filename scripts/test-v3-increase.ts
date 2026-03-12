#!/usr/bin/env npx ts-node
/**
 * 本地测试 V3 Increase Liquidity（单边输入自动算另一边）。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v3-increase.ts
 */

import 'dotenv/config'
import { SunKit, LocalWallet } from '../src'
import { SUNSWAP_V3_NILE_POSITION_MANAGER } from '../src/constants'

const NETWORK = 'nile'
const PM = SUNSWAP_V3_NILE_POSITION_MANAGER
const TOKEN_0 = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf' // USDT on Nile
const TOKEN_1 = 'TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK' // Another token
const FEE = 500

/** 替换为你实际持有的 position tokenId */
const TOKEN_ID = '519'

async function main() {
  console.log('=== V3 Increase Liquidity Test ===')
  console.log('TRON_PRIVATE_KEY set:', !!process.env.TRON_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('positionManager:', PM)
  console.log('tokenId:', TOKEN_ID)
  console.log('token0:', TOKEN_0)
  console.log('token1:', TOKEN_1)
  console.log('fee:', FEE)
  console.log('')

  if (!process.env.TRON_PRIVATE_KEY) {
    console.error('Error: TRON_PRIVATE_KEY not set in .env')
    process.exit(1)
  }

  // Initialize wallet and SunKit
  const wallet = new LocalWallet(process.env.TRON_PRIVATE_KEY)
  const sunkit = new SunKit({ wallet })

  try {
    const result = await sunkit.increaseLiquidityV3({
      network: NETWORK,
      positionManagerAddress: PM,
      tokenId: TOKEN_ID,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      amount0Desired: '5000000', // only token0, auto-compute token1
      // amount1Desired omitted → auto-computed
    })

    console.log('Increase result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    if (err?.stack) console.error('Stack:\n', err.stack)
    process.exit(1)
  }
}

main()
