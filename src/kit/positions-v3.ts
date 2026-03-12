import { SunKitError } from '../types'
import type {
  MintPositionV3Params,
  IncreaseLiquidityV3Params,
  DecreaseLiquidityV3Params,
  CollectPositionV3Params,
} from '../types'
import { sendContractTx, ensureTokenAllowance, requireWallet, type ContractContext } from './contracts'
import { createReadonlyTronWeb } from './tronweb'
import { SUNSWAP_V3_POSITION_MANAGER_MIN_ABI } from '../constants'
import { getV3PoolInfo } from './v3-pool'
import {
  getSqrtRatioAtTick,
  maxLiquidityForAmounts,
  getAmountsForLiquidity,
  nearestUsableTick,
} from './v3-math'

const DEFAULT_FEE = 3000
const DEFAULT_TICK_RANGE_FACTOR = 100

async function sortTokens(
  ctx: ContractContext,
  network: string,
  tokenA: string,
  tokenB: string,
): Promise<[string, string, boolean]> {
  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const hexA = (tronWeb as any).address.toHex(tokenA).toLowerCase()
  const hexB = (tronWeb as any).address.toHex(tokenB).toLowerCase()
  if (hexA <= hexB) return [tokenA, tokenB, false]
  return [tokenB, tokenA, true]
}

// ---------------------------------------------------------------------------
// Mint V3
// ---------------------------------------------------------------------------

export async function mintPositionV3(
  ctx: ContractContext,
  params: MintPositionV3Params,
): Promise<{
  txResult: unknown
  computedAmounts?: { amount0Desired: string; amount1Desired: string }
  computedTicks?: { tickLower: number; tickUpper: number }
}> {
  const network = params.network || 'mainnet'
  const fee = params.fee ?? DEFAULT_FEE

  const [token0, token1, swapped] = await sortTokens(ctx, network, params.token0, params.token1)

  const poolInfo = await getV3PoolInfo(ctx, network, token0, token1, fee)
  if (!poolInfo) {
    throw new SunKitError('POOL_NOT_FOUND', `V3 pool not found for ${token0}/${token1} fee=${fee}`)
  }

  const { tickSpacing, tick: currentTick, sqrtPriceX96: sqrtStr } = poolInfo
  const sqrtPriceX96 = BigInt(sqrtStr)

  const tickLower =
    params.tickLower ??
    nearestUsableTick(currentTick - DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing)
  const tickUpper =
    params.tickUpper ??
    nearestUsableTick(currentTick + DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing)

  const sqrtA = getSqrtRatioAtTick(tickLower)
  const sqrtB = getSqrtRatioAtTick(tickUpper)

  // Map user-supplied amounts into pool-ordered (token0/token1)
  let amount0 = swapped
    ? BigInt(params.amount1Desired || '0')
    : BigInt(params.amount0Desired || '0')
  let amount1 = swapped
    ? BigInt(params.amount0Desired || '0')
    : BigInt(params.amount1Desired || '0')

  let computedAmounts: { amount0Desired: string; amount1Desired: string } | undefined
  const inRange = sqrtPriceX96 > sqrtA && sqrtPriceX96 < sqrtB

  if (amount0 > 0n && amount1 === 0n) {
    const liq = maxLiquidityForAmounts(
      sqrtPriceX96, sqrtA, sqrtB,
      amount0, BigInt('999999999999999999999999999999'),
    )
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
    amount1 = amts.amount1
    if (inRange && amount1 === 0n) amount1 = 1n
    computedAmounts = { amount0Desired: amount0.toString(), amount1Desired: amount1.toString() }
  } else if (amount1 > 0n && amount0 === 0n) {
    const liq = maxLiquidityForAmounts(
      sqrtPriceX96, sqrtA, sqrtB,
      BigInt('999999999999999999999999999999'), amount1,
    )
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
    amount0 = amts.amount0
    if (inRange && amount0 === 0n) amount0 = 1n
    computedAmounts = { amount0Desired: amount0.toString(), amount1Desired: amount1.toString() }
  }

  if (amount0 === 0n && amount1 === 0n) {
    throw new SunKitError('INVALID_PARAMS', 'At least one of amount0Desired / amount1Desired must be > 0')
  }

  const userAmount0Min = swapped ? params.amount1Min : params.amount0Min
  const userAmount1Min = swapped ? params.amount0Min : params.amount1Min

  if (!ctx.wallet) {
    throw new SunKitError('NO_WALLET', 'Mint V3 position requires a wallet.')
  }
  const recipient = params.recipient ?? (await ctx.wallet.getAddress())
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  await ensureTokenAllowance(ctx, {
    network,
    tokenAddress: token0,
    spender: params.positionManagerAddress,
    requiredAmount: amount0.toString(),
  })
  await ensureTokenAllowance(ctx, {
    network,
    tokenAddress: token1,
    spender: params.positionManagerAddress,
    requiredAmount: amount1.toString(),
  })

  const args = [[
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    amount0.toString(),
    amount1.toString(),
    userAmount0Min ?? '0',
    userAmount1Min ?? '0',
    recipient,
    deadline,
  ]]

  const txResult = await sendContractTx(ctx, {
    address: params.positionManagerAddress,
    functionName: 'mint',
    args,
    abi: params.abi ?? SUNSWAP_V3_POSITION_MANAGER_MIN_ABI,
    network,
  })

  const computedTicks =
    params.tickLower == null || params.tickUpper == null
      ? { tickLower, tickUpper }
      : undefined

  if (computedAmounts && swapped) {
    computedAmounts = {
      amount0Desired: computedAmounts.amount1Desired,
      amount1Desired: computedAmounts.amount0Desired,
    }
  }

  return { txResult, computedAmounts, computedTicks }
}

// ---------------------------------------------------------------------------
// Increase V3
// ---------------------------------------------------------------------------

export async function increaseLiquidityV3(
  ctx: ContractContext,
  params: IncreaseLiquidityV3Params,
): Promise<{
  txResult: unknown
  computedAmounts?: { amount0Desired: string; amount1Desired: string }
}> {
  const network = params.network || 'mainnet'
  let computedAmounts: { amount0Desired: string; amount1Desired: string } | undefined
  let swapped = false
  let token0 = params.token0
  let token1 = params.token1

  if (params.token0 && params.token1) {
    ;[token0, token1, swapped] = await sortTokens(ctx, network, params.token0, params.token1)
  }

  let amount0 = swapped
    ? BigInt(params.amount1Desired || '0')
    : BigInt(params.amount0Desired || '0')
  let amount1 = swapped
    ? BigInt(params.amount0Desired || '0')
    : BigInt(params.amount1Desired || '0')

  const needAutoCompute = (amount0 > 0n && amount1 === 0n) || (amount1 > 0n && amount0 === 0n)

  if (needAutoCompute) {
    if (!token0 || !token1) {
      throw new SunKitError(
        'INVALID_PARAMS',
        'token0/token1 are required for single-sided auto-compute',
      )
    }

    const fee = params.fee ?? DEFAULT_FEE
    const poolInfo = await getV3PoolInfo(ctx, network, token0, token1, fee)
    if (!poolInfo) {
      throw new SunKitError('POOL_NOT_FOUND', `V3 pool not found for ${token0}/${token1} fee=${fee}`)
    }

    let tickLower = params.tickLower
    let tickUpper = params.tickUpper

    if (tickLower == null || tickUpper == null) {
      const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
      const pm = await tronWeb.contract(
        params.abi ?? SUNSWAP_V3_POSITION_MANAGER_MIN_ABI,
        params.positionManagerAddress,
      )
      const pos = await (pm as any).positions(params.tokenId).call()
      tickLower = tickLower ?? Number(pos.tickLower ?? pos[5])
      tickUpper = tickUpper ?? Number(pos.tickUpper ?? pos[6])
    }

    const sqrtPriceX96 = BigInt(poolInfo.sqrtPriceX96)
    const sqrtA = getSqrtRatioAtTick(tickLower!)
    const sqrtB = getSqrtRatioAtTick(tickUpper!)
    const inRange = sqrtPriceX96 > sqrtA && sqrtPriceX96 < sqrtB

    if (amount0 > 0n && amount1 === 0n) {
      const liq = maxLiquidityForAmounts(
        sqrtPriceX96, sqrtA, sqrtB,
        amount0, BigInt('999999999999999999999999999999'),
      )
      const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
      amount1 = amts.amount1
      if (inRange && amount1 === 0n) amount1 = 1n
    } else {
      const liq = maxLiquidityForAmounts(
        sqrtPriceX96, sqrtA, sqrtB,
        BigInt('999999999999999999999999999999'), amount1,
      )
      const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
      amount0 = amts.amount0
      if (inRange && amount0 === 0n) amount0 = 1n
    }

    computedAmounts = { amount0Desired: amount0.toString(), amount1Desired: amount1.toString() }
  }

  if (amount0 === 0n && amount1 === 0n) {
    throw new SunKitError('INVALID_PARAMS', 'At least one of amount0Desired / amount1Desired must be > 0')
  }

  const userAmount0Min = swapped ? params.amount1Min : params.amount0Min
  const userAmount1Min = swapped ? params.amount0Min : params.amount1Min
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  if (token0) {
    await ensureTokenAllowance(ctx, {
      network,
      tokenAddress: token0,
      spender: params.positionManagerAddress,
      requiredAmount: amount0.toString(),
    })
  }
  if (token1) {
    await ensureTokenAllowance(ctx, {
      network,
      tokenAddress: token1,
      spender: params.positionManagerAddress,
      requiredAmount: amount1.toString(),
    })
  }

  const args = [[
    params.tokenId,
    amount0.toString(),
    amount1.toString(),
    userAmount0Min ?? '0',
    userAmount1Min ?? '0',
    deadline,
  ]]

  const txResult = await sendContractTx(ctx, {
    address: params.positionManagerAddress,
    functionName: 'increaseLiquidity',
    args,
    abi: params.abi ?? SUNSWAP_V3_POSITION_MANAGER_MIN_ABI,
    network,
  })

  if (computedAmounts && swapped) {
    computedAmounts = {
      amount0Desired: computedAmounts.amount1Desired,
      amount1Desired: computedAmounts.amount0Desired,
    }
  }

  return { txResult, computedAmounts }
}

// ---------------------------------------------------------------------------
// Decrease V3
// ---------------------------------------------------------------------------

export async function decreaseLiquidityV3(
  ctx: ContractContext,
  params: DecreaseLiquidityV3Params,
): Promise<unknown> {
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  const args = [[
    params.tokenId,
    params.liquidity,
    params.amount0Min ?? '0',
    params.amount1Min ?? '0',
    deadline,
  ]]

  return sendContractTx(ctx, {
    address: params.positionManagerAddress,
    functionName: 'decreaseLiquidity',
    args,
    abi: params.abi ?? SUNSWAP_V3_POSITION_MANAGER_MIN_ABI,
    network: params.network || 'mainnet',
  })
}

// ---------------------------------------------------------------------------
// Collect fees
// ---------------------------------------------------------------------------

const MAX_UINT128 = '340282366920938463463374607431768211455'

export async function collectPositionV3(
  ctx: ContractContext,
  params: CollectPositionV3Params,
): Promise<{ estimatedFees: { amount0: string; amount1: string }; txResult: unknown }> {
  const network = params.network || 'mainnet'
  const wallet = requireWallet(ctx)
  const ownerAddress = await wallet.getAddress()
  const recipient = params.recipient || ownerAddress
  const pmAbi = params.abi ?? SUNSWAP_V3_POSITION_MANAGER_MIN_ABI

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const pmView = await tronWeb.contract(pmAbi, params.positionManagerAddress)

  const feesRaw = await (pmView as any)
    .collect([params.tokenId, ownerAddress, MAX_UINT128, MAX_UINT128])
    .call({ from: ownerAddress })

  const amount0 = (feesRaw.amount0 ?? feesRaw[0] ?? '0').toString()
  const amount1 = (feesRaw.amount1 ?? feesRaw[1] ?? '0').toString()
  const estimatedFees = { amount0, amount1 }

  const args = [[params.tokenId, recipient, MAX_UINT128, MAX_UINT128]]

  const txResult = await sendContractTx(ctx, {
    address: params.positionManagerAddress,
    functionName: 'collect',
    args,
    abi: pmAbi,
    network,
  })

  return { estimatedFees, txResult }
}
