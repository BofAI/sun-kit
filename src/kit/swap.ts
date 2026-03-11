import { TradePlanner, parseRouteAPIResponse, type ParseRouteOptions } from '@sun-protocol/universal-router-sdk'
import { AllowanceTransfer, type PermitSingleWithSignature, PERMIT_TYPES } from '@sun-protocol/permit2-sdk'
import { SunKitError } from '../types'
import type { SwapParams, SwapResult, Wallet } from '../types'
import { MAINNET, NILE, type SwapConstants } from '../constants'
import { signAndBroadcastContractTx, buildRawContractTx, ensureTokenAllowance, type ContractContext } from './contracts'

const SWAP_SUPPORTED_NETWORKS: Record<string, SwapConstants> = {
  mainnet: MAINNET,
  nile: NILE,
}

function getSwapConstants(network: string): SwapConstants {
  const constants = SWAP_SUPPORTED_NETWORKS[network]
  if (!constants) {
    throw new SunKitError('UNSUPPORTED_NETWORK', `Swap is not supported on network "${network}". Supported: ${Object.keys(SWAP_SUPPORTED_NETWORKS).join(', ')}`)
  }
  return constants
}

// ---------------------------------------------------------------------------
// Router API
// ---------------------------------------------------------------------------

interface RouterAPIParams {
  fromToken: string
  toToken: string
  amountIn: string
  typeList?: string
  maxCost?: number
}

interface RouterAPIResponse {
  code: number
  message: string
  data: any[]
}

async function fetchRouterAPI(params: RouterAPIParams, baseUrl: string): Promise<RouterAPIResponse> {
  const { fromToken, toToken, amountIn, typeList = '', maxCost = 3 } = params

  const url = new URL('/swap/routerUniversal', baseUrl)
  url.searchParams.append('fromToken', fromToken)
  url.searchParams.append('toToken', toToken)
  url.searchParams.append('amountIn', amountIn)
  url.searchParams.append('typeList', typeList)
  url.searchParams.append('maxCost', maxCost.toString())
  url.searchParams.append('includeUnverifiedV4Hook', 'true')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new SunKitError('NO_ROUTE', `Router API HTTP error: ${response.status}`)
  }

  const data = (await response.json()) as RouterAPIResponse
  if (data.code !== 0) {
    throw new SunKitError('NO_ROUTE', `Router API error: ${data.message}`)
  }
  return data
}

// ---------------------------------------------------------------------------
// Main swap
// ---------------------------------------------------------------------------

export async function executeSwap(ctx: ContractContext, params: SwapParams): Promise<SwapResult> {
  const network = params.network || 'mainnet'
  const slippage = params.slippage ?? 0.005
  const constants = getSwapConstants(network)
  const testnet = network === 'nile'

  if (!ctx.wallet) {
    throw new SunKitError('NO_WALLET', 'Swap requires a wallet.')
  }
  const wallet: Wallet = ctx.wallet

  const tronWeb = await wallet.getTronWeb(network)

  // 1. Fetch route
  const route = await fetchRouterAPI(
    {
      fromToken: params.tokenIn,
      toToken: params.tokenOut,
      amountIn: params.amountIn,
    },
    constants.routerApiUrl,
  )

  if (!route.data || route.data.length === 0) {
    throw new SunKitError('NO_ROUTE', 'No route found for the given token pair and amount')
  }

  const targetRoute = route.data[0]

  // 2. Permit2 flow (skip for native TRX)
  let permitSingleWithSignature: PermitSingleWithSignature | undefined
  if (params.tokenIn !== constants.trx) {
    await ensureTokenAllowance(ctx, {
      network,
      tokenAddress: params.tokenIn,
      spender: constants.permit2,
      requiredAmount: params.amountIn,
    })
    //sleep 3 seconds to ensure the allowance is registered on-chain before generating the permit
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const permit2 = new AllowanceTransfer(tronWeb as any, constants.permit2, testnet)
    const now = Math.floor(Date.now() / 1000)
    const deadline = (now + 3600).toString()
    const sigDeadline = (now + 3600).toString()

    const { domain, permitSingle } = await permit2.generatePermitSignData(
      {
        owner: tronWeb.defaultAddress.base58 as string,
        token: params.tokenIn,
        amount: BigInt(params.amountIn),
        deadline,
      },
      constants.universalRouter,
      sigDeadline,
    )

    const rawSig = await wallet.signTypedData('PermitSingle', domain, PERMIT_TYPES, permitSingle as unknown as Record<string, unknown>)
    const signature = `0x${rawSig}` as `0x${string}`

    permitSingleWithSignature = {
      signature,
      ...permitSingle,
    }
  }

  // 3. Parse route & build trade
  const swapTradeRoute = parseRouteAPIResponse(targetRoute, testnet, {
    slippage,
  } as ParseRouteOptions)

  const tradePlanner = new TradePlanner([swapTradeRoute], false, {
    permitOptions: {
      permitEnabled: !!permitSingleWithSignature,
      permit: permitSingleWithSignature,
    },
  })
  tradePlanner.encode()

  // 4. Build, sign, and broadcast
  const callValue = params.tokenIn === constants.trx ? params.amountIn : '0'
  const txDeadline = Math.floor(Date.now() / 1000) + 3600

  const unsignedTx = await buildRawContractTx(tronWeb, {
    address: constants.universalRouter,
    functionSelector: 'execute(bytes,bytes[],uint256)',
    parameter: [
      { type: 'bytes', value: tradePlanner.commands },
      { type: 'bytes[]', value: tradePlanner.inputs },
      { type: 'uint256', value: txDeadline },
    ],
    callValue: Number(callValue),
    feeLimit: 500_000_000,
  })

  const result = (await signAndBroadcastContractTx(ctx, unsignedTx, network)) as any

  return {
    txid: result.txid,
    route: {
      amountIn: targetRoute.amountIn,
      amountOut: targetRoute.amountOut,
      symbols: targetRoute.symbols,
      poolVersions: targetRoute.poolVersions,
      impact: targetRoute.impact,
    },
  }
}
