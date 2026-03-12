/**
 * SUNSWAP V4 concentrated liquidity position management.
 *
 * Uses modifyLiquidities(bytes payload, uint256 deadline) to interact with
 * CLPositionManager. Payload is built via ActionsPlanner from @sun-protocol/universal-router-sdk V4.
 *
 * Uses Permit2 for token approvals.
 */

import { encodeFunctionData, zeroAddress } from 'viem'
import { V4 } from '@sun-protocol/universal-router-sdk'
import { AllowanceTransfer, type PermitSingle } from '@sun-protocol/permit2-sdk'
import { SunKitError } from '../types'
import type {
  MintPositionV4Params,
  IncreaseLiquidityV4Params,
  DecreaseLiquidityV4Params,
  CollectPositionV4Params,
} from '../types'
import {
  sendContractTx,
  requireWallet,
  type ContractContext,
} from './contracts'
import { createReadonlyTronWeb } from './tronweb'
import {
  getSqrtRatioAtTick,
  maxLiquidityForAmounts,
  getAmountsForLiquidity,
  nearestUsableTick,
  FEE_TICK_SPACING,
} from './v3-math'
import {
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
  TRX_ADDRESS,
  PERMIT2_MAINNET,
  PERMIT2_NILE,
} from '../constants'

const PLACEHOLDER_ADDRESS = 'T000000000000000000000000000000000000'
const DEFAULT_TICK_RANGE_FACTOR = 100
const ZERO_HEX_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`
const APPROVAL_DELAY_MS = 3000

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

export function getCLPositionManagerAddress(network: string): string {
  const n = network.toLowerCase()
  if (n === 'mainnet' || n === 'tron' || n === 'trx') return SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER
  if (n === 'nile' || n === 'testnet') return SUNSWAP_V4_NILE_CL_POSITION_MANAGER
  throw new SunKitError('UNSUPPORTED_NETWORK', `Unsupported network for SUNSWAP V4 CLPositionManager: ${network}`)
}

export function getPoolManagerAddress(network: string): string {
  const n = network.toLowerCase()
  if (n === 'mainnet' || n === 'tron' || n === 'trx') return SUNSWAP_V4_MAINNET_POOL_MANAGER
  if (n === 'nile' || n === 'testnet') return SUNSWAP_V4_NILE_POOL_MANAGER
  throw new SunKitError('UNSUPPORTED_NETWORK', `Unsupported network for SUNSWAP V4 PoolManager: ${network}`)
}

export function getPermit2Address(network: string): string {
  const n = network.toLowerCase()
  if (n === 'mainnet' || n === 'tron' || n === 'trx') return PERMIT2_MAINNET
  if (n === 'nile' || n === 'testnet') return PERMIT2_NILE
  throw new SunKitError('UNSUPPORTED_NETWORK', `Unsupported network for Permit2: ${network}`)
}

function ensureV4Deployed(address: string, label: string): void {
  if (!address || address === PLACEHOLDER_ADDRESS) {
    throw new SunKitError(
      'NOT_DEPLOYED',
      `SUNSWAP V4 ${label} not deployed. Set SUNSWAP_V4_*_${label.toUpperCase().replace(/ /g, '_')} in constants.ts.`,
    )
  }
}

function toEvmHex(tronWeb: { address: { toHex: (a: string) => string } }, addr: string): `0x${string}` {
  if (!addr || addr === TRX_ADDRESS) return ZERO_HEX_ADDRESS
  const hex = tronWeb.address.toHex(addr)
  const body = (hex.startsWith('41') ? hex.slice(2) : hex.replace(/^0x/, '')).slice(-40)
  return `0x${body}` as `0x${string}`
}

/**
 * Convert TRON hex address (41-prefixed) to EVM hex address (0x-prefixed).
 * Used for addresses returned from chain queries (already in hex format).
 * viem expects 20 bytes (40 hex chars) with 0x prefix.
 */
function tronHexToEvmHex(hexAddr: string): `0x${string}` {
  if (!hexAddr) return ZERO_HEX_ADDRESS
  // Already in EVM format
  if (hexAddr.startsWith('0x') && hexAddr.length === 42) {
    return hexAddr as `0x${string}`
  }
  // TRON hex format: 41 + 40 chars = 42 chars total
  if (hexAddr.startsWith('41') && hexAddr.length === 42) {
    return `0x${hexAddr.slice(2)}` as `0x${string}`
  }
  // Handle other formats: just ensure 0x prefix and take last 40 chars
  const clean = hexAddr.replace(/^0x/, '').slice(-40).padStart(40, '0')
  return `0x${clean}` as `0x${string}`
}

async function buildEncodedPoolKey(
  tronWeb: { address: { toHex: (a: string) => string } },
  token0: string,
  token1: string,
  fee: number,
  tickSpacing: number,
  hooks: `0x${string}` = ZERO_HEX_ADDRESS,
): Promise<V4.EncodedPoolKey> {
  const currency0 = toEvmHex(tronWeb, token0)
  const currency1 = toEvmHex(tronWeb, token1)
  const parameters = V4.encodePoolParameters({ tickSpacing }) as `0x${string}`
  return { currency0, currency1, hooks, fee, parameters }
}

async function buildPoolKey(
  tronWeb: { address: { toHex: (a: string) => string } },
  token0: string,
  token1: string,
  fee: number,
  tickSpacing: number,
  hooks: `0x${string}` = ZERO_HEX_ADDRESS,
): Promise<V4.PoolKey> {
  const currency0 = toEvmHex(tronWeb, token0)
  const currency1 = toEvmHex(tronWeb, token1)
  return { currency0, currency1, hooks, fee, parameters: { tickSpacing } }
}

// ---------------------------------------------------------------------------
// Slot0 & sorting
// ---------------------------------------------------------------------------

async function getV4Slot0(
  ctx: ContractContext,
  network: string,
  poolKey: V4.PoolKey,
): Promise<{ sqrtPriceX96: bigint; tick: number }> {
  const poolManagerAddr = getPoolManagerAddress(network)
  ensureV4Deployed(poolManagerAddr, 'PoolManager')

  const poolId = V4.getPoolId({
    ...poolKey,
    hooks: poolKey.hooks ?? ZERO_HEX_ADDRESS,
  })

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const result = await tronWeb.transactionBuilder.triggerConstantContract(
    poolManagerAddr,
    'getSlot0(bytes32)',
    {},
    [{ type: 'bytes32', value: poolId }],
  )

  if (!result?.constant_result?.[0]) throw new SunKitError('CONTRACT_READ_FAILED', 'getSlot0 returned no data')

  const hex = '0x' + result.constant_result[0]
  const decoded = tronWeb.utils.abi.decodeParams(
    ['sqrtPriceX96', 'tick', 'protocolFee', 'lpFee'],
    ['uint160', 'int24', 'uint24', 'uint24'],
    hex,
    true,
  )

  const sqrtPriceX96 = BigInt(decoded.sqrtPriceX96 ?? decoded[0] ?? 0)
  if (sqrtPriceX96 === 0n) {
    throw new SunKitError('POOL_NOT_INITIALIZED', 'Pool not initialized (sqrtPriceX96 = 0)')
  }

  return {
    sqrtPriceX96,
    tick: Number(decoded.tick ?? decoded[1] ?? 0),
  }
}

async function sortTokenPair(
  ctx: ContractContext,
  tokenA: string,
  tokenB: string,
  network: string,
): Promise<[string, string, boolean]> {
  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const hexA = toEvmHex(tronWeb, tokenA).toLowerCase()
  const hexB = toEvmHex(tronWeb, tokenB).toLowerCase()
  if (hexA <= hexB) return [tokenA, tokenB, false]
  return [tokenB, tokenA, true]
}

// ---------------------------------------------------------------------------
// Slippage helpers
// ---------------------------------------------------------------------------

function toAmountMax(amount: bigint, slippagePercent?: number): bigint {
  if (slippagePercent && slippagePercent > 0) {
    return (amount * BigInt(Math.floor((100 + slippagePercent) * 100))) / 10000n
  }
  return amount
}

function toAmountMin(amount: bigint, slippagePercent?: number): bigint {
  if (slippagePercent && slippagePercent > 0) {
    return (amount * BigInt(Math.floor((100 - slippagePercent) * 100))) / 10000n
  }
  return amount
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sqrtPriceX96ToTick(sqrtPriceX96: bigint): number {
  const Q96 = 2n ** 96n
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96)
  if (sqrtPrice <= 0) return 0
  const price = sqrtPrice * sqrtPrice
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

// ---------------------------------------------------------------------------
// Permit2
// ---------------------------------------------------------------------------

interface Permit2Signature extends PermitSingle {
  signature: `0x${string}`
}

function encodePermit2Call(owner: `0x${string}`, permit2Signature: Permit2Signature): `0x${string}` {
  const { signature, details, spender, sigDeadline } = permit2Signature
  const permitSingle = {
    details: {
      token: details.token as `0x${string}`,
      amount: BigInt(details.amount),
      expiration: Number(details.expiration),
      nonce: Number(details.nonce),
    },
    spender: spender as `0x${string}`,
    sigDeadline: BigInt(sigDeadline),
  }

  return encodeFunctionData({
    abi: V4.Permit2ForwardAbi,
    functionName: 'permit',
    args: [owner, permitSingle, signature],
  })
}

async function approveToPermit2(
  ctx: ContractContext,
  network: string,
  tokenAddress: string,
  amount: bigint,
): Promise<void> {
  const wallet = requireWallet(ctx)
  const tronWeb = await wallet.getTronWeb(network)
  const walletAddress = await wallet.getAddress()
  const permit2Address = getPermit2Address(network)

  const result = await tronWeb.transactionBuilder.triggerConstantContract(
    tokenAddress,
    'allowance(address,address)',
    {},
    [
      { type: 'address', value: walletAddress },
      { type: 'address', value: permit2Address },
    ],
  )

  const currentAllowance = result?.constant_result?.[0]
    ? BigInt('0x' + result.constant_result[0])
    : 0n

  if (currentAllowance >= amount) return

  const maxUint256 = 2n ** 256n - 1n
  const approveTx = await tronWeb.transactionBuilder.triggerSmartContract(
    tokenAddress,
    'approve(address,uint256)',
    { feeLimit: 100_000_000, callValue: 0 },
    [
      { type: 'address', value: permit2Address },
      { type: 'uint256', value: maxUint256.toString() },
    ],
  )

  const signed = await wallet.signAndBroadcast(approveTx as unknown as Record<string, unknown>, network)
  if (!signed.result) {
    throw new SunKitError('APPROVAL_FAILED', 'Failed to approve token to Permit2')
  }

  await sleep(APPROVAL_DELAY_MS)
}

async function generatePermit2Signature(
  ctx: ContractContext,
  network: string,
  tokenAddress: string,
  amount: bigint,
  spender: string,
): Promise<Permit2Signature> {
  const wallet = requireWallet(ctx)
  const tronWeb = await wallet.getTronWeb(network)
  const walletAddress = await wallet.getAddress()
  const permit2Address = getPermit2Address(network)
  const testnet = network.toLowerCase() === 'nile' || network.toLowerCase() === 'testnet'

  const permit2 = new AllowanceTransfer(tronWeb as never, permit2Address, testnet)

  const now = Math.floor(Date.now() / 1000)
  const deadline = (now + 3600).toString()
  const sigDeadline = (now + 3600).toString()

  const { domain, permitSingle } = await permit2.generatePermitSignData(
    {
      owner: walletAddress,
      token: tokenAddress,
      amount,
      deadline,
    },
    spender,
    sigDeadline,
  )

  const PERMIT_TYPES = {
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  }

  const rawSig = await wallet.signTypedData(
    'PermitSingle',
    domain,
    PERMIT_TYPES,
    permitSingle as unknown as Record<string, unknown>,
  )
  const signature = `0x${rawSig}` as `0x${string}`

  return { ...permitSingle, signature } as Permit2Signature
}

// ---------------------------------------------------------------------------
// Multicall
// ---------------------------------------------------------------------------

async function callMulticall(
  ctx: ContractContext,
  address: string,
  calls: `0x${string}`[],
  callValue: number,
  network: string,
): Promise<unknown> {
  const abi = V4.CLPositionManagerAbi as unknown as { type: string; name: string; inputs: unknown[] }[]
  return sendContractTx(ctx, {
    address,
    functionName: 'multicall',
    args: [calls],
    abi,
    network,
    value: callValue > 0 ? callValue.toString() : undefined,
  })
}

// ---------------------------------------------------------------------------
// Mint Position
// ---------------------------------------------------------------------------

export async function mintPositionV4(
  ctx: ContractContext,
  params: MintPositionV4Params,
): Promise<{
  txResult: unknown
  computedAmounts?: { amount0Desired: string; amount1Desired: string }
  computedTicks?: { tickLower: number; tickUpper: number }
  poolCreated?: boolean
}> {
  const network = params.network || 'mainnet'
  const fee = params.fee ?? 500
  const address = getCLPositionManagerAddress(network)
  ensureV4Deployed(address, 'CLPositionManager')

  const [token0, token1, swapped] = await sortTokenPair(ctx, params.token0, params.token1, network)
  const tickSpacing = FEE_TICK_SPACING[fee] ?? 10

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const poolKey = await buildPoolKey(tronWeb, token0, token1, fee, tickSpacing)
  const encodedPoolKey = await buildEncodedPoolKey(tronWeb, token0, token1, fee, tickSpacing)

  let slot0: { sqrtPriceX96: bigint; tick: number } | null = null
  let poolCreated = false
  let initializePoolCall: `0x${string}` | null = null

  try {
    slot0 = await getV4Slot0(ctx, network, poolKey)
  } catch {
    if (params.sqrtPriceX96) {
      const initialSqrtPriceX96 = BigInt(params.sqrtPriceX96)
      initializePoolCall = encodeFunctionData({
        abi: V4.CLPositionManagerAbi,
        functionName: 'initializePool',
        args: [encodedPoolKey, initialSqrtPriceX96],
      })
      poolCreated = true
      const tick = sqrtPriceX96ToTick(initialSqrtPriceX96)
      slot0 = { sqrtPriceX96: initialSqrtPriceX96, tick }
    } else {
      throw new SunKitError(
        'POOL_NOT_FOUND',
        `V4 pool not found for ${token0}/${token1} fee=${fee}. Provide sqrtPriceX96 to create a new pool.`,
      )
    }
  }

  const currentTick = slot0.tick
  const sqrtPriceX96 = slot0.sqrtPriceX96

  const tickLower =
    params.tickLower ?? nearestUsableTick(currentTick - DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing)
  const tickUpper =
    params.tickUpper ?? nearestUsableTick(currentTick + DEFAULT_TICK_RANGE_FACTOR * tickSpacing, tickSpacing)

  const sqrtA = getSqrtRatioAtTick(tickLower)
  const sqrtB = getSqrtRatioAtTick(tickUpper)

  const userAmount0 = params.amount0Desired ? BigInt(params.amount0Desired) : 0n
  const userAmount1 = params.amount1Desired ? BigInt(params.amount1Desired) : 0n

  let amount0 = swapped ? userAmount1 : userAmount0
  let amount1 = swapped ? userAmount0 : userAmount1
  let computedAmounts: { amount0Desired: string; amount1Desired: string } | undefined

  if (amount0 > 0n && amount1 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount0 * 1000000n)
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
    amount1 = amts.amount1 > 0n ? amts.amount1 : 1n
    computedAmounts = { amount0Desired: amount0.toString(), amount1Desired: amount1.toString() }
  } else if (amount1 > 0n && amount0 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount1 * 1000000n, amount1)
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
    amount0 = amts.amount0 > 0n ? amts.amount0 : 1n
    computedAmounts = { amount0Desired: amount0.toString(), amount1Desired: amount1.toString() }
  }

  if (amount0 === 0n && amount1 === 0n) {
    throw new SunKitError('INVALID_PARAMS', 'At least one of amount0Desired / amount1Desired must be > 0')
  }

  const liquidity = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount1)
  const amount0Max = toAmountMax(amount0, params.slippage)
  const amount1Max = toAmountMax(amount1, params.slippage)

  const wallet = requireWallet(ctx)
  const recipient = params.recipient ?? (await wallet.getAddress())
  const recipientEvm = toEvmHex(tronWeb, recipient)
  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60)

  const ownerAddress = await wallet.getAddress()
  const ownerEvm = toEvmHex(tronWeb, ownerAddress)

  const permit2Calls: `0x${string}`[] = []

  if (encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS) {
    await approveToPermit2(ctx, network, token0, amount0Max)
    const permit2Sig0 = await generatePermit2Signature(ctx, network, token0, amount0Max, address)
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig0))
  }

  if (encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS) {
    await approveToPermit2(ctx, network, token1, amount1Max)
    const permit2Sig1 = await generatePermit2Signature(ctx, network, token1, amount1Max, address)
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig1))
  }

  const planner = new V4.ActionsPlanner()

  const encodedPositionConfig: V4.EncodedCLPositionConfig = {
    poolKey: encodedPoolKey,
    tickLower,
    tickUpper,
  }

  planner.add(V4.ACTIONS.CL_MINT_POSITION, [
    encodedPositionConfig,
    liquidity,
    amount0Max,
    amount1Max,
    recipientEvm,
    '0x' as `0x${string}`,
  ])

  const OPEN_DELTA = V4.ACTION_CONSTANTS.OPEN_DELTA
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency0,
    OPEN_DELTA,
    encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS,
  ])
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency1,
    OPEN_DELTA,
    encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS,
  ])

  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency0, recipientEvm])
  }
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency1, recipientEvm])
  }

  const payload = planner.encode()

  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: 'modifyLiquidities',
    args: [payload, deadline],
  })

  let callValue = 0
  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) callValue += Number(amount0Max)
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) callValue += Number(amount1Max)

  const calls: `0x${string}`[] = [...permit2Calls]
  if (initializePoolCall) calls.push(initializePoolCall)
  calls.push(modifyLiquiditiesCall)

  const txResult = await callMulticall(ctx, address, calls, callValue, network)

  const computedTicks =
    params.tickLower == null || params.tickUpper == null ? { tickLower, tickUpper } : undefined

  if (computedAmounts && swapped) {
    computedAmounts = {
      amount0Desired: computedAmounts.amount1Desired,
      amount1Desired: computedAmounts.amount0Desired,
    }
  }

  return { txResult, computedAmounts, computedTicks, poolCreated }
}

// ---------------------------------------------------------------------------
// Increase Liquidity
// ---------------------------------------------------------------------------

export async function increaseLiquidityV4(
  ctx: ContractContext,
  params: IncreaseLiquidityV4Params,
): Promise<{ txResult: unknown; computedAmounts?: { amount0Desired: string; amount1Desired: string } }> {
  const network = params.network || 'mainnet'
  const address = getCLPositionManagerAddress(network)
  ensureV4Deployed(address, 'CLPositionManager')

  if (!params.token0 || !params.token1) {
    throw new SunKitError('INVALID_PARAMS', 'token0 and token1 are required for increaseLiquidityV4')
  }

  const [token0, token1, swapped] = await sortTokenPair(ctx, params.token0, params.token1, network)
  const fee = params.fee ?? 500
  const tickSpacing = FEE_TICK_SPACING[fee] ?? 10

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const poolKey = await buildPoolKey(tronWeb, token0, token1, fee, tickSpacing)
  const encodedPoolKey = await buildEncodedPoolKey(tronWeb, token0, token1, fee, tickSpacing)

  let slot0: { sqrtPriceX96: bigint; tick: number }
  try {
    slot0 = await getV4Slot0(ctx, network, poolKey)
  } catch {
    throw new SunKitError('POOL_NOT_FOUND', `V4 pool not found for ${token0}/${token1} fee=${fee}`)
  }

  const sqrtPriceX96 = slot0.sqrtPriceX96

  let tickLower: number | undefined
  let tickUpper: number | undefined

  const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, address)
  const pos = await (pm as unknown as { positions: (id: string) => { call: () => Promise<unknown> } })
    .positions(params.tokenId)
    .call()
  const posArr = Array.isArray(pos) ? pos : [pos]
  const posObj = pos as { tickLower?: unknown; tickUpper?: unknown }
  tickLower = Number(posObj.tickLower ?? posArr[1])
  tickUpper = Number(posObj.tickUpper ?? posArr[2])

  const sqrtA = getSqrtRatioAtTick(tickLower)
  const sqrtB = getSqrtRatioAtTick(tickUpper)

  const userAmount0 = params.amount0Desired ? BigInt(params.amount0Desired) : 0n
  const userAmount1 = params.amount1Desired ? BigInt(params.amount1Desired) : 0n

  let amount0 = swapped ? userAmount1 : userAmount0
  let amount1 = swapped ? userAmount0 : userAmount1

  if (amount0 > 0n && amount1 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount0 * 1000000n)
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
    amount1 = amts.amount1 > 0n ? amts.amount1 : 1n
  } else if (amount1 > 0n && amount0 === 0n) {
    const liq = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount1 * 1000000n, amount1)
    const amts = getAmountsForLiquidity(sqrtPriceX96, sqrtA, sqrtB, liq)
    amount0 = amts.amount0 > 0n ? amts.amount0 : 1n
  }

  if (amount0 === 0n && amount1 === 0n) {
    throw new SunKitError('INVALID_PARAMS', 'At least one of amount0Desired / amount1Desired must be > 0')
  }

  const liquidity = maxLiquidityForAmounts(sqrtPriceX96, sqrtA, sqrtB, amount0, amount1)
  const amount0Max = toAmountMax(amount0, params.slippage)
  const amount1Max = toAmountMax(amount1, params.slippage)

  const wallet = requireWallet(ctx)
  const ownerAddress = await wallet.getAddress()
  const ownerEvm = toEvmHex(tronWeb, ownerAddress)
  const recipientEvm = ownerEvm
  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60)

  const permit2Calls: `0x${string}`[] = []

  if (encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS) {
    await approveToPermit2(ctx, network, token0, amount0Max)
    const permit2Sig0 = await generatePermit2Signature(ctx, network, token0, amount0Max, address)
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig0))
  }

  if (encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS) {
    await approveToPermit2(ctx, network, token1, amount1Max)
    const permit2Sig1 = await generatePermit2Signature(ctx, network, token1, amount1Max, address)
    permit2Calls.push(encodePermit2Call(ownerEvm, permit2Sig1))
  }

  const planner = new V4.ActionsPlanner()

  planner.add(V4.ACTIONS.CL_INCREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    liquidity,
    amount0Max,
    amount1Max,
    '0x' as `0x${string}`,
  ])

  const OPEN_DELTA = V4.ACTION_CONSTANTS.OPEN_DELTA
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency0,
    OPEN_DELTA,
    encodedPoolKey.currency0 !== ZERO_HEX_ADDRESS,
  ])
  planner.add(V4.ACTIONS.SETTLE, [
    encodedPoolKey.currency1,
    OPEN_DELTA,
    encodedPoolKey.currency1 !== ZERO_HEX_ADDRESS,
  ])

  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency0, recipientEvm])
  }
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) {
    planner.add(V4.ACTIONS.SWEEP, [encodedPoolKey.currency1, recipientEvm])
  }

  const payload = planner.encode()

  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: 'modifyLiquidities',
    args: [payload, deadline],
  })

  let callValue = 0
  if (encodedPoolKey.currency0 === ZERO_HEX_ADDRESS) callValue += Number(amount0Max)
  if (encodedPoolKey.currency1 === ZERO_HEX_ADDRESS) callValue += Number(amount1Max)

  const calls: `0x${string}`[] = [...permit2Calls, modifyLiquiditiesCall]
  const txResult = await callMulticall(ctx, address, calls, callValue, network)

  let computedAmounts: { amount0Desired: string; amount1Desired: string } = {
    amount0Desired: amount0.toString(),
    amount1Desired: amount1.toString(),
  }
  if (swapped) {
    computedAmounts = {
      amount0Desired: computedAmounts.amount1Desired,
      amount1Desired: computedAmounts.amount0Desired,
    }
  }

  return { txResult, computedAmounts }
}

// ---------------------------------------------------------------------------
// Decrease Liquidity
// ---------------------------------------------------------------------------

export async function decreaseLiquidityV4(
  ctx: ContractContext,
  params: DecreaseLiquidityV4Params,
): Promise<{ txResult: unknown; computedAmountMin?: { amount0Min: string; amount1Min: string } }> {
  const network = params.network || 'mainnet'
  const address = getCLPositionManagerAddress(network)
  ensureV4Deployed(address, 'CLPositionManager')

  if (!params.token0 || !params.token1) {
    throw new SunKitError('INVALID_PARAMS', 'token0 and token1 are required for decreaseLiquidityV4')
  }

  const [token0, token1] = await sortTokenPair(ctx, params.token0, params.token1, network)
  const fee = params.fee ?? 500
  const tickSpacing = FEE_TICK_SPACING[fee] ?? 10

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const encodedPoolKey = await buildEncodedPoolKey(tronWeb, token0, token1, fee, tickSpacing)

  const liquidity = BigInt(params.liquidity)
  const amount0Min = toAmountMin(BigInt(params.amount0Min ?? '0'), params.slippage)
  const amount1Min = toAmountMin(BigInt(params.amount1Min ?? '0'), params.slippage)

  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60)

  const planner = new V4.ActionsPlanner()

  planner.add(V4.ACTIONS.CL_DECREASE_LIQUIDITY, [
    BigInt(params.tokenId),
    liquidity,
    amount0Min,
    amount1Min,
    '0x' as `0x${string}`,
  ])

  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency0])
  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency1])

  const payload = planner.encode()

  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: 'modifyLiquidities',
    args: [payload, deadline],
  })

  const txResult = await callMulticall(ctx, address, [modifyLiquiditiesCall], 0, network)

  return {
    txResult,
    computedAmountMin: {
      amount0Min: amount0Min.toString(),
      amount1Min: amount1Min.toString(),
    },
  }
}

// ---------------------------------------------------------------------------
// Collect Fees
// ---------------------------------------------------------------------------

export async function collectPositionV4(
  ctx: ContractContext,
  params: CollectPositionV4Params,
): Promise<{ txResult: unknown }> {
  const network = params.network || 'mainnet'
  const address = getCLPositionManagerAddress(network)
  ensureV4Deployed(address, 'CLPositionManager')

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)

  const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, address)
  const pos = await (pm as unknown as { positions: (id: string) => { call: () => Promise<unknown> } })
    .positions(params.tokenId)
    .call()
  const posArr = Array.isArray(pos) ? pos : [pos]
  const poolKeyObj = (pos as { poolKey?: unknown }).poolKey ?? posArr[0]
  const poolKeyArr = Array.isArray(poolKeyObj) ? poolKeyObj : [poolKeyObj]

  let currency0: `0x${string}`
  let currency1: `0x${string}`
  let fee: number
  let tickSpacing: number

  if (params.token0 && params.token1) {
    const [token0, token1] = await sortTokenPair(ctx, params.token0, params.token1, network)
    currency0 = toEvmHex(tronWeb, token0)
    currency1 = toEvmHex(tronWeb, token1)
    fee = params.fee ?? 500
    tickSpacing = FEE_TICK_SPACING[fee] ?? 10
  } else {
    const poolKeyObjTyped = poolKeyObj as { currency0?: string; currency1?: string; fee?: number }
    const rawCurrency0 = poolKeyObjTyped?.currency0 ?? poolKeyArr[0] ?? ''
    const rawCurrency1 = poolKeyObjTyped?.currency1 ?? poolKeyArr[1] ?? ''
    // Convert TRON hex (41...) to EVM hex (0x...) for viem compatibility
    currency0 = tronHexToEvmHex(rawCurrency0 as string)
    currency1 = tronHexToEvmHex(rawCurrency1 as string)
    fee = Number(poolKeyObjTyped?.fee ?? poolKeyArr[3] ?? 500)
    tickSpacing = FEE_TICK_SPACING[fee] ?? 10
  }

  const encodedPoolKey: V4.EncodedPoolKey = {
    currency0,
    currency1,
    hooks: ZERO_HEX_ADDRESS,
    fee,
    parameters: V4.encodePoolParameters({ tickSpacing }) as `0x${string}`,
  }

  const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + 30 * 60)

  const planner = new V4.ActionsPlanner()

  planner.add(V4.ACTIONS.CL_DECREASE_LIQUIDITY, [BigInt(params.tokenId), 0n, 0n, 0n, '0x' as `0x${string}`])
  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency0])
  planner.add(V4.ACTIONS.CLOSE_CURRENCY, [encodedPoolKey.currency1])

  const payload = planner.encode()

  const modifyLiquiditiesCall = encodeFunctionData({
    abi: V4.CLPositionManagerAbi,
    functionName: 'modifyLiquidities',
    args: [payload, deadline],
  })

  const txResult = await callMulticall(ctx, address, [modifyLiquiditiesCall], 0, network)

  return { txResult }
}

// ---------------------------------------------------------------------------
// Read Helpers
// ---------------------------------------------------------------------------

export async function getV4PositionInfo(
  ctx: ContractContext,
  network: string,
  positionManagerAddress: string,
  tokenId: string,
): Promise<{
  poolKey: { currency0: string; currency1: string; fee: number; tickSpacing: number }
  tickLower: number
  tickUpper: number
  liquidity: string
} | null> {
  ensureV4Deployed(positionManagerAddress, 'CLPositionManager')

  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)
  const pm = await tronWeb.contract(V4.CLPositionManagerAbi as never, positionManagerAddress)

  try {
    const result = await (pm as unknown as { getPoolAndPositionInfo: (id: string) => { call: () => Promise<unknown> } })
      .getPoolAndPositionInfo(tokenId)
      .call()

    const poolKey = (result as unknown[])[0] as {
      currency0?: string
      currency1?: string
      fee?: number
    }
    const info = (result as unknown[])[1] as { tickLower?: number; tickUpper?: number; liquidity?: string }

    return {
      poolKey: {
        currency0: poolKey?.currency0 ?? '',
        currency1: poolKey?.currency1 ?? '',
        fee: poolKey?.fee ?? 0,
        tickSpacing: 0,
      },
      tickLower: info?.tickLower ?? 0,
      tickUpper: info?.tickUpper ?? 0,
      liquidity: (info?.liquidity ?? '0').toString(),
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Price Helpers
// ---------------------------------------------------------------------------

export function priceToSqrtPriceX96(price: number): string {
  if (price <= 0) throw new SunKitError('INVALID_PARAMS', 'Price must be positive')
  const Q96 = 2n ** 96n
  const sqrtPrice = Math.sqrt(price)
  return BigInt(Math.floor(sqrtPrice * Number(Q96))).toString()
}

export function sqrtPriceX96ToPrice(sqrtPriceX96: string | bigint): number {
  const Q96 = 2n ** 96n
  const sqrtPriceX96Bn = typeof sqrtPriceX96 === 'string' ? BigInt(sqrtPriceX96) : sqrtPriceX96
  const sqrtPrice = Number(sqrtPriceX96Bn) / Number(Q96)
  return sqrtPrice * sqrtPrice
}

export function amountsToSqrtPriceX96(
  amount0: string | bigint,
  amount1: string | bigint,
  decimals0 = 6,
  decimals1 = 6,
): string {
  const amt0 = typeof amount0 === 'string' ? BigInt(amount0) : amount0
  const amt1 = typeof amount1 === 'string' ? BigInt(amount1) : amount1

  if (amt0 === 0n) throw new SunKitError('INVALID_PARAMS', 'amount0 must be positive')

  const decimalAdjustment = 10 ** (decimals1 - decimals0)
  const price = (Number(amt1) / Number(amt0)) * decimalAdjustment

  return priceToSqrtPriceX96(price)
}
