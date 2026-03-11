import type { QuoteExactInputParams, SwapExactInputParams } from '../types'
import { readContract, sendContractTx, type ContractContext } from './contracts'

export async function quoteExactInput(
  ctx: ContractContext,
  params: QuoteExactInputParams,
): Promise<unknown> {
  const functionName = params.functionName || 'quoteExactInput'
  return readContract(
    ctx,
    {
      address: params.routerAddress,
      functionName,
      args: params.args,
      abi: params.abi,
    },
    params.network || 'mainnet',
  )
}

export async function swapExactInput(
  ctx: ContractContext,
  params: SwapExactInputParams,
): Promise<unknown> {
  const functionName = params.functionName || 'swapExactInput'

  return sendContractTx(ctx, {
    address: params.routerAddress,
    functionName,
    args: params.args,
    value: params.value,
    abi: params.abi,
    network: params.network || 'mainnet',
  })
}
