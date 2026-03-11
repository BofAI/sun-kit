import { SunKitError } from '../types'
import type { ModifyLiquidityV4Params } from '../types'
import type { ContractContext } from './contracts'

export async function modifyLiquidityV4(
  _ctx: ContractContext,
  _params: ModifyLiquidityV4Params,
): Promise<unknown> {
  throw new SunKitError(
    'NOT_IMPLEMENTED',
    'V4 modifyLiquidity is not yet implemented. This is a placeholder for future development.',
  )
}
