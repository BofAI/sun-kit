import type { TronWeb } from 'tronweb'
import { SunKitError } from '../types'
import type {
  Wallet,
  ContractCallParams,
  ContractSendParams,
  RawContractTxParams,
  EnsureAllowanceParams,
} from '../types'
import { TRC20_MIN_ABI } from '../constants'
import { createReadonlyTronWeb } from './tronweb'

// ---------------------------------------------------------------------------
// Context interface — injected by SunKit
// ---------------------------------------------------------------------------

export interface ContractContext {
  wallet: Wallet | null
  rpcOverride?: string
  apiKey?: string
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function readContract(
  ctx: ContractContext,
  params: ContractCallParams,
  network = 'mainnet',
): Promise<unknown> {
  const tronWeb = await createReadonlyTronWeb(network, ctx.rpcOverride, ctx.apiKey)

  try {
    const contract = params.abi
      ? tronWeb.contract(params.abi, params.address)
      : await tronWeb.contract().at(params.address)

    const method = (contract as any).methods[params.functionName]
    if (!method) {
      throw new Error(`Function ${params.functionName} not found in contract`)
    }

    const args = params.args || []
    return await method(...args).call()
  } catch (error: any) {
    throw new SunKitError('CONTRACT_READ_FAILED', `Read contract failed: ${error.message}`, error)
  }
}

// ---------------------------------------------------------------------------
// Build unsigned transactions
// ---------------------------------------------------------------------------

export async function buildUnsignedContractTx(
  tronWeb: TronWeb,
  params: ContractSendParams,
): Promise<unknown> {
  const args = params.args || []
  const options: any = {}
  if (params.value) {
    options.callValue = params.value
  }

  const contract = params.abi
    ? tronWeb.contract(params.abi, params.address)
    : await tronWeb.contract().at(params.address)

  const abi: any[] = params.abi || (contract as any).abi || []

  const abiEntry = abi.find(
    (entry: any) => entry.type === 'function' && entry.name === params.functionName,
  )
  if (!abiEntry) {
    throw new SunKitError(
      'CONTRACT_READ_FAILED',
      `Function ${params.functionName} not found in contract ABI`,
    )
  }

  const paramTypes = (abiEntry.inputs || []).map((i: any) => i.type).join(',')
  const functionSelector = `${params.functionName}(${paramTypes})`

  const typedParams = (abiEntry.inputs || []).map((input: any, idx: number) => ({
    type: input.type,
    value: args[idx],
  }))

  const issuerAddress =
    tronWeb.defaultAddress?.base58 || tronWeb.defaultAddress?.hex || undefined

  return tronWeb.transactionBuilder.triggerSmartContract(
    params.address,
    functionSelector,
    options,
    typedParams,
    issuerAddress,
  )
}

export async function buildRawContractTx(
  tronWeb: TronWeb,
  params: RawContractTxParams,
): Promise<unknown> {
  const options: any = {}
  if (params.callValue != null) options.callValue = params.callValue
  if (params.feeLimit != null) options.feeLimit = params.feeLimit

  return tronWeb.transactionBuilder.triggerSmartContract(
    params.address,
    params.functionSelector,
    options,
    params.parameter,
  )
}

// ---------------------------------------------------------------------------
// Sign & broadcast
// ---------------------------------------------------------------------------

export function requireWallet(ctx: ContractContext): Wallet {
  if (!ctx.wallet) {
    throw new SunKitError('NO_WALLET', 'No wallet configured. Write operations require a wallet.')
  }
  return ctx.wallet
}

export async function signAndBroadcastContractTx(
  ctx: ContractContext,
  unsignedTx: any,
  network = 'mainnet',
): Promise<unknown> {
  const wallet = requireWallet(ctx)
  return wallet.signAndBroadcast(unsignedTx, network)
}

export async function sendContractTx(
  ctx: ContractContext,
  params: ContractSendParams & { network?: string },
): Promise<unknown> {
  const network = params.network || 'mainnet'
  const wallet = requireWallet(ctx)
  const tronWeb = await wallet.getTronWeb(network)

  const unsignedTx = await buildUnsignedContractTx(tronWeb, params)
  return wallet.signAndBroadcast(unsignedTx as Record<string, unknown>, network)
}

// ---------------------------------------------------------------------------
// Solidity node read (for allowance checks)
// ---------------------------------------------------------------------------

export async function readConstantContractSolidity(
  tronWeb: TronWeb,
  contractAddress: string,
  functionSelector: string,
  parameters: { type: string; value: string }[],
  issuerAddressHex: string,
): Promise<string[]> {
  const feeLimit =
    (tronWeb as any).feeLimit != null ? (tronWeb as any).feeLimit : 100_000_000
  const tx = await (tronWeb.transactionBuilder as any).triggerConfirmedConstantContract(
    contractAddress,
    functionSelector,
    { callValue: 0, feeLimit },
    parameters,
    issuerAddressHex,
  )
  if (!tx || !Array.isArray(tx.constant_result)) {
    throw new SunKitError('CONTRACT_READ_FAILED', 'Read contract (solidity) failed: no constant_result')
  }
  return tx.constant_result
}

// ---------------------------------------------------------------------------
// Ensure token allowance
// ---------------------------------------------------------------------------

export async function transferTokenTo(
  ctx: ContractContext,
  params: { network?: string; tokenAddress: string; to: string; amount: string },
): Promise<void> {
  const network = params.network || 'mainnet'
  await sendContractTx(ctx, {
    address: params.tokenAddress,
    functionName: 'transfer',
    args: [params.to, params.amount],
    abi: TRC20_MIN_ABI,
    network,
  })
}

export async function ensureTokenAllowance(
  ctx: ContractContext,
  params: EnsureAllowanceParams,
): Promise<void> {
  const network = params.network || 'mainnet'
  const wallet = requireWallet(ctx)
  const tronWeb = await wallet.getTronWeb(network)
  const ownerAddress = await wallet.getAddress()

  if (!ownerAddress) {
    throw new SunKitError('NO_WALLET', 'Unable to resolve wallet address for allowance check.')
  }

  const ownerHex =
    typeof (tronWeb as any).address?.toHex === 'function'
      ? (tronWeb as any).address.toHex(ownerAddress)
      : ownerAddress

  const parameters = [
    { type: 'address', value: ownerAddress },
    { type: 'address', value: params.spender },
  ]

  const constantResult = await readConstantContractSolidity(
    tronWeb,
    params.tokenAddress,
    'allowance(address,address)',
    parameters,
    ownerHex,
  )

  const currentRaw = constantResult[0]
  const current = BigInt(currentRaw ? '0x' + currentRaw : '0')
  const required = BigInt(params.requiredAmount)

  if (required === BigInt(0) || current >= required) {
    return
  }

  await sendContractTx(ctx, {
    address: params.tokenAddress,
    functionName: 'approve',
    args: [params.spender, params.requiredAmount],
    abi: TRC20_MIN_ABI,
    network,
  })
}
