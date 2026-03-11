import { SunKitError } from '../types'
import type { AddLiquidityV2Params, RemoveLiquidityV2Params } from '../types'
import {
  SUNSWAP_V2_FACTORY_MIN_ABI,
  SUNSWAP_V2_MAINNET_FACTORY,
  SUNSWAP_V2_NILE_FACTORY,
  SUNSWAP_V2_PAIR_MIN_ABI,
  TRX_ADDRESS,
  WTRX_MAINNET,
  WTRX_NILE,
} from '../constants'
import { sendContractTx, ensureTokenAllowance, type ContractContext } from './contracts'
import { createReadonlyTronWeb } from './tronweb'

const DEFAULT_SLIPPAGE_BPS = 500 // 5%

function applySlippage(amount: string): string {
  const raw = BigInt(amount || '0')
  if (raw === BigInt(0)) return '0'
  const factor = BigInt(10_000 - DEFAULT_SLIPPAGE_BPS)
  return ((raw * factor) / BigInt(10_000)).toString()
}

function isTRX(tokenAddress: string): boolean {
  return tokenAddress === TRX_ADDRESS
}

function getWTRXForNetwork(network: string): string {
  const n = network.toLowerCase()
  if (n === 'mainnet' || n === 'tron' || n === 'trx') return WTRX_MAINNET
  if (n === 'nile' || n === 'testnet') return WTRX_NILE
  throw new SunKitError('UNSUPPORTED_NETWORK', `Unsupported network for WTRX: ${network}`)
}

function getPairLookupToken(tokenAddress: string, network: string): string {
  return isTRX(tokenAddress) ? getWTRXForNetwork(network) : tokenAddress
}

function computeOptimalAmounts(
  amountADesired: string,
  amountBDesired: string,
  reserveA: string,
  reserveB: string,
): { amountA: string; amountB: string } {
  const rA = BigInt(reserveA)
  const rB = BigInt(reserveB)
  const dA = BigInt(amountADesired)
  const dB = BigInt(amountBDesired)

  if (rA === BigInt(0) && rB === BigInt(0)) {
    return { amountA: amountADesired, amountB: amountBDesired }
  }

  const optimalB = (dA * rB) / rA
  if (optimalB <= dB) {
    return { amountA: amountADesired, amountB: optimalB.toString() }
  }
  const optimalA = (dB * rA) / rB
  return { amountA: optimalA.toString(), amountB: amountBDesired }
}

function getV2FactoryAddress(network: string): string {
  const n = network.toLowerCase()
  if (n === 'mainnet' || n === 'tron' || n === 'trx') return SUNSWAP_V2_MAINNET_FACTORY
  if (n === 'nile' || n === 'testnet') return SUNSWAP_V2_NILE_FACTORY
  throw new SunKitError('UNSUPPORTED_NETWORK', `Unsupported network for SUNSWAP V2 factory: ${network}`)
}

interface V2PairInfoForAdd {
  pairAddress: string | null
  reserveA: string
  reserveB: string
  totalSupply: string
}

interface V2PairInfo {
  pairAddress: string
  reserveA: string
  reserveB: string
  totalSupply: string
}

async function getV2PairInfoForAdd(
  ctx: ContractContext,
  network: string,
  tokenA: string,
  tokenB: string,
): Promise<V2PairInfoForAdd> {
  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const factoryAddress = getV2FactoryAddress(network)
  const lookupA = getPairLookupToken(tokenA, network)
  const lookupB = getPairLookupToken(tokenB, network)

  const factory = await tronWeb.contract(SUNSWAP_V2_FACTORY_MIN_ABI as any, factoryAddress)
  const pairHex = await factory.getPair(lookupA, lookupB).call()
  const pairBase58 = tronWeb.address.fromHex(pairHex)

  const zeroBase58 = tronWeb.address.fromHex('410000000000000000000000000000000000000000')
  if (!pairBase58 || pairBase58 === zeroBase58) {
    return { pairAddress: null, reserveA: '0', reserveB: '0', totalSupply: '0' }
  }

  const pair = await tronWeb.contract(SUNSWAP_V2_PAIR_MIN_ABI as any, pairBase58)
  const reserves = await pair.getReserves().call()
  const token0Hex = await pair.token0().call()
  const token1Hex = await pair.token1().call()
  const totalSupply = await pair.totalSupply().call()

  const token0 = tronWeb.address.fromHex(token0Hex)
  const token1 = tronWeb.address.fromHex(token1Hex)

  const reserve0 = (reserves._reserve0 ?? reserves[0]).toString()
  const reserve1 = (reserves._reserve1 ?? reserves[1]).toString()

  const reserveA = token0 === lookupA ? reserve0 : reserve1
  const reserveB = token0 === lookupB ? reserve0 : reserve1

  return { pairAddress: pairBase58, reserveA, reserveB, totalSupply: totalSupply.toString() }
}

async function getV2PairInfo(
  ctx: ContractContext,
  network: string,
  tokenA: string,
  tokenB: string,
): Promise<V2PairInfo> {
  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const factoryAddress = getV2FactoryAddress(network)
  const lookupA = getPairLookupToken(tokenA, network)
  const lookupB = getPairLookupToken(tokenB, network)

  const factory = await tronWeb.contract(SUNSWAP_V2_FACTORY_MIN_ABI as any, factoryAddress)
  const pairHex = await factory.getPair(lookupA, lookupB).call()
  const pairBase58 = tronWeb.address.fromHex(pairHex)

  const zeroBase58 = tronWeb.address.fromHex('410000000000000000000000000000000000000000')
  if (!pairBase58 || pairBase58 === zeroBase58) {
    throw new SunKitError('POOL_NOT_FOUND', 'Pool does not exist for this token pair.')
  }

  const pair = await tronWeb.contract(SUNSWAP_V2_PAIR_MIN_ABI as any, pairBase58)
  const reserves = await pair.getReserves().call()
  const token0Hex = await pair.token0().call()
  const token1Hex = await pair.token1().call()
  const totalSupply = await pair.totalSupply().call()

  const token0 = tronWeb.address.fromHex(token0Hex)
  const token1 = tronWeb.address.fromHex(token1Hex)

  const reserve0 = (reserves._reserve0 ?? reserves[0]).toString()
  const reserve1 = (reserves._reserve1 ?? reserves[1]).toString()

  const reserveA = token0 === lookupA ? reserve0 : reserve1
  const reserveB = token0 === lookupB ? reserve0 : reserve1

  return { pairAddress: pairBase58, reserveA, reserveB, totalSupply: totalSupply.toString() }
}

// ---------------------------------------------------------------------------
// Add liquidity
// ---------------------------------------------------------------------------

export async function addLiquidityV2(
  ctx: ContractContext,
  params: AddLiquidityV2Params,
): Promise<unknown> {
  const network = params.network || 'mainnet'

  const pairForAdd = await getV2PairInfoForAdd(ctx, network, params.tokenA, params.tokenB)
  const { amountA: actualA, amountB: actualB } = computeOptimalAmounts(
    params.amountADesired,
    params.amountBDesired,
    pairForAdd.reserveA,
    pairForAdd.reserveB,
  )

  const amountAMin = params.amountAMin ?? applySlippage(actualA)
  const amountBMin = params.amountBMin ?? applySlippage(actualB)

  if (!ctx.wallet) {
    throw new SunKitError('NO_WALLET', 'Add liquidity requires a wallet.')
  }
  const to = params.to ?? (await ctx.wallet.getAddress())
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  const hasTRX = isTRX(params.tokenA) || isTRX(params.tokenB)

  if (hasTRX) {
    const otherToken = isTRX(params.tokenA) ? params.tokenB : params.tokenA
    const otherAmount = isTRX(params.tokenA) ? actualB : actualA
    const otherMin = isTRX(params.tokenA) ? amountBMin : amountAMin
    const trxAmount = isTRX(params.tokenA) ? actualA : actualB
    const trxMin = isTRX(params.tokenA) ? amountAMin : amountBMin

    await ensureTokenAllowance(ctx, {
      network,
      tokenAddress: otherToken,
      spender: params.routerAddress,
      requiredAmount: otherAmount,
    })

    return sendContractTx(ctx, {
      address: params.routerAddress,
      functionName: 'addLiquidityETH',
      args: [otherToken, otherAmount, otherMin, trxMin, to, deadline],
      abi: params.abi,
      network,
      value: trxAmount,
    })
  }

  await ensureTokenAllowance(ctx, {
    network,
    tokenAddress: params.tokenA,
    spender: params.routerAddress,
    requiredAmount: actualA,
  })

  await ensureTokenAllowance(ctx, {
    network,
    tokenAddress: params.tokenB,
    spender: params.routerAddress,
    requiredAmount: actualB,
  })

  return sendContractTx(ctx, {
    address: params.routerAddress,
    functionName: 'addLiquidity',
    args: [params.tokenA, params.tokenB, actualA, actualB, amountAMin, amountBMin, to, deadline],
    abi: params.abi,
    network,
  })
}

// ---------------------------------------------------------------------------
// Remove liquidity
// ---------------------------------------------------------------------------

export async function removeLiquidityV2(
  ctx: ContractContext,
  params: RemoveLiquidityV2Params,
): Promise<unknown> {
  const network = params.network || 'mainnet'

  if (!ctx.wallet) {
    throw new SunKitError('NO_WALLET', 'Remove liquidity requires a wallet.')
  }
  const to = params.to ?? (await ctx.wallet.getAddress())
  const deadline = params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60

  const pairInfo = await getV2PairInfo(ctx, network, params.tokenA, params.tokenB)

  await ensureTokenAllowance(ctx, {
    network,
    tokenAddress: pairInfo.pairAddress,
    spender: params.routerAddress,
    requiredAmount: params.liquidity,
  })

  let amountAMin = params.amountAMin
  let amountBMin = params.amountBMin

  if (!amountAMin || !amountBMin) {
    const totalSupply = BigInt(pairInfo.totalSupply || '0')
    const liquidity = BigInt(params.liquidity)

    if (totalSupply === BigInt(0)) {
      amountAMin = amountAMin ?? '0'
      amountBMin = amountBMin ?? '0'
    } else {
      const expectedA = ((liquidity * BigInt(pairInfo.reserveA)) / totalSupply).toString()
      const expectedB = ((liquidity * BigInt(pairInfo.reserveB)) / totalSupply).toString()
      if (!amountAMin) amountAMin = applySlippage(expectedA)
      if (!amountBMin) amountBMin = applySlippage(expectedB)
    }
  }

  const hasTRX = isTRX(params.tokenA) || isTRX(params.tokenB)

  if (hasTRX) {
    const otherToken = isTRX(params.tokenA) ? params.tokenB : params.tokenA
    const amountTokenMin = isTRX(params.tokenA) ? (amountBMin ?? '0') : (amountAMin ?? '0')
    const amountETHMin = isTRX(params.tokenA) ? (amountAMin ?? '0') : (amountBMin ?? '0')

    return sendContractTx(ctx, {
      address: params.routerAddress,
      functionName: 'removeLiquidityETH',
      args: [otherToken, params.liquidity, amountTokenMin, amountETHMin, to, deadline],
      abi: params.abi,
      network,
    })
  }

  return sendContractTx(ctx, {
    address: params.routerAddress,
    functionName: 'removeLiquidity',
    args: [params.tokenA, params.tokenB, params.liquidity, amountAMin ?? '0', amountBMin ?? '0', to, deadline],
    abi: params.abi,
    network,
  })
}
