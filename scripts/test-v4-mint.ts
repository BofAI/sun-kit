#!/usr/bin/env npx ts-node
/**
 * 本地测试 V4 Mint Position。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v4-mint.ts
 */

import 'dotenv/config'
import { SunKit, LocalWallet } from '../src'
import { getCLPositionManagerAddress, priceToSqrtPriceX96 } from '../src/kit/positions-v4'

const NETWORK = 'nile'
const TOKEN_0 = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf' // USDT on Nile
const TOKEN_1 = 'TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK' // Another token
const FEE = 500

async function main() {
  console.log('=== V4 Mint Position Test ===')
  console.log('TRON_PRIVATE_KEY set:', !!process.env.TRON_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('positionManager:', getCLPositionManagerAddress(NETWORK))
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

  console.log('--- Mint V4 Position ---')
  try {
    const result = await sunkit.mintPositionV4({
      network: NETWORK,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      amount0Desired: '10000000', // 10 USDT
      // sqrtPriceX96 for new pool (if pool doesn't exist)
      sqrtPriceX96: priceToSqrtPriceX96(1),
    })

    console.log('Mint result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    if (err?.stack) console.error('Stack:\n', err.stack)
    process.exit(1)
  }
}

main()
