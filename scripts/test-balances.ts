#!/usr/bin/env npx ts-node
/**
 * 本地测试余额查询。
 *
 * 使用前请在项目根目录配置 .env：
 *   TRON_PRIVATE_KEY=你的十六进制私钥 (可选，如果不提供则需要指定 ownerAddress)
 *
 * 运行：npx ts-node scripts/test-balances.ts
 */

import 'dotenv/config'
import { SunKit, LocalWallet } from '../src'

const NETWORK = 'nile'
/** 替换为要查询的地址，如果设置了 TRON_PRIVATE_KEY 则可以留空 */
const OWNER_ADDRESS = process.env.OWNER_ADDRESS || ''
/** 要查询的 TRC20 token 地址 */
const TOKEN_ADDRESS = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf' // USDT on Nile

async function main() {
  console.log('=== Balances Test ===')
  console.log('network:', NETWORK)
  console.log('')

  let sunkit: SunKit

  if (process.env.TRON_PRIVATE_KEY) {
    const wallet = new LocalWallet(process.env.TRON_PRIVATE_KEY)
    sunkit = new SunKit({ wallet })
    console.log('Using wallet from TRON_PRIVATE_KEY')
  } else if (OWNER_ADDRESS) {
    sunkit = new SunKit({})
    console.log('Using ownerAddress:', OWNER_ADDRESS)
  } else {
    console.error('Error: Set TRON_PRIVATE_KEY in .env or OWNER_ADDRESS in script')
    process.exit(1)
  }

  try {
    const results = await sunkit.getBalances({
      tokens: [
        { type: 'TRX' },
        { type: 'TRC20', tokenAddress: TOKEN_ADDRESS },
      ],
      ownerAddress: OWNER_ADDRESS || undefined,
      network: NETWORK,
    })

    console.log('Balances:')
    for (const result of results) {
      if (result.type === 'TRX') {
        console.log(`  TRX: ${result.balance} Sun (${Number(result.balance) / 1e6} TRX)`)
      } else {
        console.log(`  TRC20 (${result.tokenAddress}): ${result.balance}`)
      }
    }
  } catch (err: any) {
    console.error('Error name:', err?.name)
    console.error('Error message:', err?.message)
    if (err?.stack) console.error('Stack:\n', err.stack)
    process.exit(1)
  }
}

main()
