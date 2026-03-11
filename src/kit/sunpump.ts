import { SunKitError } from '../types'
import type { CreateTokenParams, PumpSwapParams } from '../types'
import type { ContractContext } from './contracts'

export async function createToken(
  _ctx: ContractContext,
  _params: CreateTokenParams,
): Promise<unknown> {
  throw new SunKitError(
    'NOT_IMPLEMENTED',
    'SunPump createToken is not yet implemented. This is a placeholder for future development.',
  )
}

export async function pumpSwap(
  _ctx: ContractContext,
  _params: PumpSwapParams,
): Promise<unknown> {
  throw new SunKitError(
    'NOT_IMPLEMENTED',
    'SunPump pumpSwap is not yet implemented. This is a placeholder for future development.',
  )
}
