#!/usr/bin/env npx ts-node
/**
 * 本地测试 V3 Decrease Liquidity。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥
 *
 * 运行：npx ts-node scripts/test-v3-decrease.ts
 */

import 'dotenv/config'
import { SunKit, LocalWallet } from '../src'
import { SUNSWAP_V3_NILE_POSITION_MANAGER } from '../src/constants'

const NETWORK = 'nile'
const PM = SUNSWAP_V3_NILE_POSITION_MANAGER

/** 替换为你实际持有的 position tokenId */
const TOKEN_ID = '519'
/** 要移除的 liquidity 数量 */
const LIQUIDITY = '168860193549162'

async function main() {
  console.log('=== V3 Decrease Liquidity Test ===')
  console.log('TRON_PRIVATE_KEY set:', !!process.env.TRON_PRIVATE_KEY)
  console.log('network:', NETWORK)
  console.log('positionManager:', PM)
  console.log('tokenId:', TOKEN_ID)
  console.log('liquidity:', LIQUIDITY)
  console.log('')

  if (!process.env.TRON_PRIVATE_KEY) {
    console.error('Error: TRON_PRIVATE_KEY not set in .env')
    process.exit(1)
  }

  // Initialize wallet and SunKit
  const wallet = new LocalWallet(process.env.TRON_PRIVATE_KEY)
  const sunkit = new SunKit({ wallet })

  try {
    const result = await sunkit.decreaseLiquidityV3({
      network: NETWORK,
      positionManagerAddress: PM,
      tokenId: TOKEN_ID,
      liquidity: LIQUIDITY,
      // amount0Min / amount1Min omitted → defaults to "0"
    })

    console.log('Decrease result:')
    console.log(JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    if (err?.stack) console.error('Stack:\n', err.stack)
    process.exit(1)
  }
}

main()
