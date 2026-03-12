#!/usr/bin/env npx ts-node
/**
 * 本地测试 V4 Increase Liquidity。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v4-increase.ts
 */

import 'dotenv/config'
import { SunKit, LocalWallet } from '../src'
import { getCLPositionManagerAddress } from '../src/kit/positions-v4'

const NETWORK = 'nile'
const TOKEN_0 = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
const TOKEN_1 = 'TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK'
const FEE = 500

/** 替换为你实际持有的 position tokenId */
const TOKEN_ID = '1'

async function main() {
  console.log('=== V4 Increase Liquidity Test ===')
  console.log('TRON_PRIVATE_KEY set:', !!process.env.TRON_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('positionManager:', getCLPositionManagerAddress(NETWORK))
  console.log('tokenId:', TOKEN_ID)
  console.log('')

  if (!process.env.TRON_PRIVATE_KEY) {
    console.error('Error: TRON_PRIVATE_KEY not set in .env')
    process.exit(1)
  }

  const wallet = new LocalWallet(process.env.TRON_PRIVATE_KEY)
  const sunkit = new SunKit({ wallet })

  try {
    const result = await sunkit.increaseLiquidityV4({
      network: NETWORK,
      tokenId: TOKEN_ID,
      token0: TOKEN_0,
      token1: TOKEN_1,
      fee: FEE,
      amount0Desired: '5000000',
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
