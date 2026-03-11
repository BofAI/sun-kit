/**
 * SunPump (Meme Token Launchpad) trading module.
 * Implements bonding curve buy/sell for internal (pre-DEX) trading.
 */

import { SunKitError } from '../types'
import {
  SunPumpTokenState,
  type SunPumpTokenInfo,
  type BuyTokenParams,
  type BuyTokenResult,
  type SellTokenParams,
  type SellTokenResult,
} from '../types'
import {
  SUNPUMP_MAINNET,
  SUNPUMP_NILE,
  SUNPUMP_ABI,
  TRC20_MIN_ABI,
} from '../constants'
import {
  readContract,
  sendContractTx,
  requireWallet,
  type ContractContext,
} from './contracts'
import { createReadonlyTronWeb } from './tronweb'

// ---------------------------------------------------------------------------
// Contract Address Resolution
// ---------------------------------------------------------------------------

export function getSunPumpAddress(network: string): string {
  const n = network.toLowerCase()
  if (n === 'mainnet' || n === 'tron' || n === 'trx') return SUNPUMP_MAINNET
  if (n === 'nile' || n === 'testnet') return SUNPUMP_NILE
  throw new SunKitError('UNSUPPORTED_NETWORK', `Unsupported network for SunPump: ${network}`)
}

// ---------------------------------------------------------------------------
// Token Info & Price Queries
// ---------------------------------------------------------------------------

export async function getTokenState(
  ctx: ContractContext,
  tokenAddress: string,
  network = 'mainnet',
): Promise<SunPumpTokenState> {
  const sunpumpAddress = getSunPumpAddress(network)

  const result = await readContract(
    ctx,
    {
      address: sunpumpAddress,
      functionName: 'getTokenState',
      args: [tokenAddress],
      abi: SUNPUMP_ABI,
    },
    network,
  )

  return Number(result) as SunPumpTokenState
}

export async function getTokenPrice(
  ctx: ContractContext,
  tokenAddress: string,
  network = 'mainnet',
): Promise<string> {
  const sunpumpAddress = getSunPumpAddress(network)

  const result = await readContract(
    ctx,
    {
      address: sunpumpAddress,
      functionName: 'getPrice',
      args: [tokenAddress],
      abi: SUNPUMP_ABI,
    },
    network,
  )

  return BigInt(result as string | number | bigint).toString()
}

export async function getVirtualPool(
  ctx: ContractContext,
  tokenAddress: string,
  network = 'mainnet',
): Promise<{ trxReserve: string; tokenReserve: string; launched: boolean }> {
  const sunpumpAddress = getSunPumpAddress(network)

  const result = await readContract(
    ctx,
    {
      address: sunpumpAddress,
      functionName: 'virtualPools',
      args: [tokenAddress],
      abi: SUNPUMP_ABI,
    },
    network,
  )

  const arr = Array.isArray(result) ? result : [result]
  return {
    trxReserve: BigInt(arr[0] || 0).toString(),
    tokenReserve: BigInt(arr[1] || 0).toString(),
    launched: Boolean(arr[2]),
  }
}

export async function getSunPumpTokenInfo(
  ctx: ContractContext,
  tokenAddress: string,
  network = 'mainnet',
): Promise<SunPumpTokenInfo> {
  const state = await getTokenState(ctx, tokenAddress, network)

  let price = '0'
  let trxReserve = '0'
  let tokenReserve = '0'
  let launched = state === SunPumpTokenState.LAUNCHED

  if (state === SunPumpTokenState.TRADING || state === SunPumpTokenState.LAUNCHED) {
    try {
      const pool = await getVirtualPool(ctx, tokenAddress, network)
      trxReserve = pool.trxReserve
      tokenReserve = pool.tokenReserve
      launched = pool.launched
    } catch {
      // Pool query may fail
    }

    if (state === SunPumpTokenState.TRADING) {
      try {
        price = await getTokenPrice(ctx, tokenAddress, network)
      } catch {
        // Price query may fail for some tokens
      }
    }
  }

  return { tokenAddress, state, price, launched, trxReserve, tokenReserve }
}

export async function isTokenLaunched(
  ctx: ContractContext,
  tokenAddress: string,
  network = 'mainnet',
): Promise<boolean> {
  const state = await getTokenState(ctx, tokenAddress, network)
  return state === SunPumpTokenState.LAUNCHED
}

// ---------------------------------------------------------------------------
// Quote Functions
// ---------------------------------------------------------------------------

export async function quoteBuy(
  ctx: ContractContext,
  tokenAddress: string,
  trxAmount: string,
  network = 'mainnet',
): Promise<{ tokenAmount: string; fee: string }> {
  const sunpumpAddress = getSunPumpAddress(network)

  const result = await readContract(
    ctx,
    {
      address: sunpumpAddress,
      functionName: 'getTokenAmountByPurchaseWithFee',
      args: [tokenAddress, BigInt(trxAmount).toString()],
      abi: SUNPUMP_ABI,
    },
    network,
  )

  const arr = Array.isArray(result) ? result : [result, 0]
  return {
    tokenAmount: BigInt(arr[0] || 0).toString(),
    fee: BigInt(arr[1] || 0).toString(),
  }
}

export async function quoteSell(
  ctx: ContractContext,
  tokenAddress: string,
  tokenAmount: string,
  network = 'mainnet',
): Promise<{ trxAmount: string; fee: string }> {
  const sunpumpAddress = getSunPumpAddress(network)

  const result = await readContract(
    ctx,
    {
      address: sunpumpAddress,
      functionName: 'getTrxAmountBySaleWithFee',
      args: [tokenAddress, BigInt(tokenAmount).toString()],
      abi: SUNPUMP_ABI,
    },
    network,
  )

  const arr = Array.isArray(result) ? result : [result, 0]
  return {
    trxAmount: BigInt(arr[0] || 0).toString(),
    fee: BigInt(arr[1] || 0).toString(),
  }
}

// ---------------------------------------------------------------------------
// Buy / Sell
// ---------------------------------------------------------------------------

export async function buyToken(
  ctx: ContractContext,
  params: BuyTokenParams,
): Promise<BuyTokenResult> {
  const network = params.network || 'mainnet'
  const slippage = params.slippage ?? 0.05
  const sunpumpAddress = getSunPumpAddress(network)

  const state = await getTokenState(ctx, params.tokenAddress, network)
  if (state === SunPumpTokenState.NOT_EXIST) {
    throw new SunKitError('SUNPUMP_NOT_EXIST', `Token ${params.tokenAddress} does not exist on SunPump.`)
  }
  if (state === SunPumpTokenState.LAUNCHED) {
    throw new SunKitError(
      'SUNPUMP_LAUNCHED',
      `Token ${params.tokenAddress} has already launched to DEX. Use SunSwap V2 for trading.`,
    )
  }

  const quote = await quoteBuy(ctx, params.tokenAddress, params.trxAmount, network)
  const expectedTokens = BigInt(quote.tokenAmount)

  let minTokenOut: bigint
  if (params.minTokenOut) {
    minTokenOut = BigInt(params.minTokenOut)
  } else {
    const slippageMultiplier = BigInt(Math.floor((1 - slippage) * 10000))
    minTokenOut = (expectedTokens * slippageMultiplier) / 10000n
  }

  const txResult = await sendContractTx(ctx, {
    address: sunpumpAddress,
    functionName: 'purchaseToken',
    args: [params.tokenAddress, minTokenOut.toString()],
    value: params.trxAmount,
    abi: SUNPUMP_ABI,
    network,
  })

  return {
    txResult,
    tokenAddress: params.tokenAddress,
    trxSpent: params.trxAmount,
    expectedTokens: expectedTokens.toString(),
    minTokenOut: minTokenOut.toString(),
  }
}

export async function sellToken(
  ctx: ContractContext,
  params: SellTokenParams,
): Promise<SellTokenResult> {
  const network = params.network || 'mainnet'
  const slippage = params.slippage ?? 0.05
  const sunpumpAddress = getSunPumpAddress(network)
  const wallet = requireWallet(ctx)

  const state = await getTokenState(ctx, params.tokenAddress, network)
  if (state === SunPumpTokenState.NOT_EXIST) {
    throw new SunKitError('SUNPUMP_NOT_EXIST', `Token ${params.tokenAddress} does not exist on SunPump.`)
  }
  if (state === SunPumpTokenState.LAUNCHED) {
    throw new SunKitError(
      'SUNPUMP_LAUNCHED',
      `Token ${params.tokenAddress} has already launched to DEX. Use SunSwap V2 for trading.`,
    )
  }

  const quote = await quoteSell(ctx, params.tokenAddress, params.tokenAmount, network)
  const expectedTrx = BigInt(quote.trxAmount)

  let minTrxOut: bigint
  if (params.minTrxOut) {
    minTrxOut = BigInt(params.minTrxOut)
  } else {
    const slippageMultiplier = BigInt(Math.floor((1 - slippage) * 10000))
    minTrxOut = (expectedTrx * slippageMultiplier) / 10000n
  }

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const ownerAddress = await wallet.getAddress()

  const tokenContract = await tronWeb.contract(TRC20_MIN_ABI as never, params.tokenAddress)
  const allowance = await (
    tokenContract as unknown as {
      allowance: (owner: string, spender: string) => { call: () => Promise<unknown> }
    }
  )
    .allowance(ownerAddress, sunpumpAddress)
    .call()
  const currentAllowance = BigInt(allowance as string | number)
  const tokenAmountBigInt = BigInt(params.tokenAmount)

  if (currentAllowance < tokenAmountBigInt) {
    const maxUint256 = 2n ** 256n - 1n
    await sendContractTx(ctx, {
      address: params.tokenAddress,
      functionName: 'approve',
      args: [sunpumpAddress, maxUint256.toString()],
      abi: TRC20_MIN_ABI,
      network,
    })

    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  const txResult = await sendContractTx(ctx, {
    address: sunpumpAddress,
    functionName: 'saleToken',
    args: [params.tokenAddress, params.tokenAmount, minTrxOut.toString()],
    abi: SUNPUMP_ABI,
    network,
  })

  return {
    txResult,
    tokenAddress: params.tokenAddress,
    tokensSold: params.tokenAmount,
    expectedTrx: expectedTrx.toString(),
    minTrxOut: minTrxOut.toString(),
  }
}

// ---------------------------------------------------------------------------
// Utility: Get Token Balance
// ---------------------------------------------------------------------------

export async function getMemeTokenBalance(
  ctx: ContractContext,
  tokenAddress: string,
  ownerAddress?: string,
  network = 'mainnet',
): Promise<string> {
  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const owner = ownerAddress || (ctx.wallet ? await ctx.wallet.getAddress() : undefined)
  if (!owner) {
    throw new SunKitError('NO_WALLET', 'No wallet or ownerAddress provided for balance check.')
  }

  const tokenContract = await tronWeb.contract(TRC20_MIN_ABI as never, tokenAddress)
  const balance = await (
    tokenContract as unknown as {
      balanceOf: (account: string) => { call: () => Promise<unknown> }
    }
  )
    .balanceOf(owner)
    .call()

  return BigInt(balance as string | number).toString()
}
