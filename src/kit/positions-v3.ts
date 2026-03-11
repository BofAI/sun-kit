import { SunKitError } from '../types'
import type { MintPositionV3Params, IncreaseLiquidityV3Params, DecreaseLiquidityV3Params } from '../types'
import { sendContractTx, ensureTokenAllowance, type ContractContext } from './contracts'

const DEFAULT_SLIPPAGE_BPS = 500 // 5%

function applySlippage(amount: string): string {
  const raw = BigInt(amount || '0')
  if (raw === BigInt(0)) return '0'
  const factor = BigInt(10_000 - DEFAULT_SLIPPAGE_BPS)
  return ((raw * factor) / BigInt(10_000)).toString()
}

export async function mintPositionV3(
  ctx: ContractContext,
  params: MintPositionV3Params,
): Promise<unknown> {
  const network = params.network || 'mainnet'

  const amount0Min = params.amount0Min ?? applySlippage(params.amount0Desired)
  const amount1Min = params.amount1Min ?? applySlippage(params.amount1Desired)

  if (!ctx.wallet) {
    throw new SunKitError('NO_WALLET', 'Mint V3 position requires a wallet.')
  }
  const recipient = params.recipient ?? (await ctx.wallet.getAddress())
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  await ensureTokenAllowance(ctx, {
    network,
    tokenAddress: params.token0,
    spender: params.positionManagerAddress,
    requiredAmount: params.amount0Desired,
  })

  await ensureTokenAllowance(ctx, {
    network,
    tokenAddress: params.token1,
    spender: params.positionManagerAddress,
    requiredAmount: params.amount1Desired,
  })

  const args = [
    {
      token0: params.token0,
      token1: params.token1,
      fee: params.fee,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min,
      amount1Min,
      recipient,
      deadline,
    },
  ]

  return sendContractTx(ctx, {
    address: params.positionManagerAddress,
    functionName: 'mint',
    args,
    abi: params.abi,
    network,
  })
}

export async function increaseLiquidityV3(
  ctx: ContractContext,
  params: IncreaseLiquidityV3Params,
): Promise<unknown> {
  const network = params.network || 'mainnet'

  const amount0Min = params.amount0Min ?? applySlippage(params.amount0Desired)
  const amount1Min = params.amount1Min ?? applySlippage(params.amount1Desired)
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  const args = [
    {
      tokenId: params.tokenId,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min,
      amount1Min,
      deadline,
    },
  ]

  return sendContractTx(ctx, {
    address: params.positionManagerAddress,
    functionName: 'increaseLiquidity',
    args,
    abi: params.abi,
    network,
  })
}

export async function decreaseLiquidityV3(
  ctx: ContractContext,
  params: DecreaseLiquidityV3Params,
): Promise<unknown> {
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  const args = [
    {
      tokenId: params.tokenId,
      liquidity: params.liquidity,
      amount0Min: params.amount0Min ?? '0',
      amount1Min: params.amount1Min ?? '0',
      deadline,
    },
  ]

  return sendContractTx(ctx, {
    address: params.positionManagerAddress,
    functionName: 'decreaseLiquidity',
    args,
    abi: params.abi,
    network: params.network || 'mainnet',
  })
}
