import type { GetBalancesParams, TokenBalanceResult, Wallet } from '../types'
import { SunKitError } from '../types'
import { createReadonlyTronWeb } from './tronweb'

export interface BalancesContext {
  wallet: Wallet | null
  rpcOverride?: string
  apiKey?: string
}

export async function getBalances(
  ctx: BalancesContext,
  params: GetBalancesParams,
): Promise<TokenBalanceResult[]> {
  const network = params.network || 'mainnet'

  let owner = params.ownerAddress?.trim()
  if (!owner) {
    if (!ctx.wallet) {
      throw new SunKitError('NO_WALLET', 'ownerAddress is required when no wallet is configured')
    }
    owner = await ctx.wallet.getAddress()
  }

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const results: TokenBalanceResult[] = []

  for (const token of params.tokens) {
    if (token.type === 'TRX') {
      const bal = await tronWeb.trx.getBalance(owner)
      results.push({ address: owner, type: 'TRX', balance: bal.toString() })
      continue
    }

    if (token.type === 'TRC20') {
      if (!token.tokenAddress) {
        throw new SunKitError('CONTRACT_READ_FAILED', 'tokenAddress is required for TRC20 balance queries')
      }
      const contract = await tronWeb.contract().at(token.tokenAddress)
      const raw = await (contract as any).balanceOf(owner).call()
      results.push({
        address: owner,
        type: 'TRC20',
        tokenAddress: token.tokenAddress,
        balance: raw.toString(),
      })
    }
  }

  return results
}
