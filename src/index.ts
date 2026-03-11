// ---------------------------------------------------------------------------
// @bankofai/sun-kit — public API
// ---------------------------------------------------------------------------

// SunAPI: read-only HTTP client for SUN.IO open API
export { SunAPI, type SunAPIOptions } from './api'
export type {
  ApiResponse,
  PaginatedParams,
  ScanTransactionsParams,
  GetTokensParams,
  SearchTokensParams,
  GetProtocolParams,
  ProtocolHistoryParams,
  GetPriceParams,
  GetUserPositionsParams,
  GetPoolUserPositionTickParams,
  GetPoolsParams,
  GetTopApyPoolListParams,
  SearchPoolsParams,
  SearchCountPoolsParams,
  PoolHistoryParams,
  GetPairsParams,
  GetFarmsParams,
  GetFarmTransactionsParams,
  GetFarmPositionsParams,
} from './api'

// SunKit: wallet-dependent on-chain operations
export { SunKit, type SunKitOptions } from './kit'

// Low-level helpers
export { createReadonlyTronWeb } from './kit/tronweb'

// Wallet interface & errors
export { SunKitError } from './types'
export type {
  Wallet,
  ContractCallParams,
  ContractSendParams,
  RawContractTxParams,
  SwapParams,
  SwapResult,
  QuoteExactInputParams,
  SwapExactInputParams,
  AddLiquidityV2Params,
  RemoveLiquidityV2Params,
  MintPositionV3Params,
  IncreaseLiquidityV3Params,
  DecreaseLiquidityV3Params,
  ModifyLiquidityV4Params,
  CreateTokenParams,
  PumpSwapParams,
  GetBalancesParams,
  TokenBalanceRequest,
  TokenBalanceResult,
  EnsureAllowanceParams,
} from './types'

// Network config & constants
export {
  TronNetwork,
  NETWORKS,
  DEFAULT_NETWORK,
  getNetworkConfig,
  type NetworkConfig,
} from './chains'

export {
  MAINNET,
  NILE,
  SHASTA,
  TRX_ADDRESS,
  WTRX_MAINNET,
  WTRX_NILE,
  SUNSWAP_V2_MAINNET_FACTORY,
  SUNSWAP_V2_MAINNET_ROUTER,
  SUNSWAP_V2_NILE_FACTORY,
  SUNSWAP_V2_NILE_ROUTER,
  SUNSWAP_V3_MAINNET_FACTORY,
  SUNSWAP_V3_MAINNET_POSITION_MANAGER,
  SUNSWAP_V3_NILE_FACTORY,
  SUNSWAP_V3_NILE_POSITION_MANAGER,
  TRC20_MIN_ABI,
  SUNSWAP_V2_FACTORY_MIN_ABI,
  SUNSWAP_V2_PAIR_MIN_ABI,
  type NetworkConstants,
  type SwapConstants,
} from './constants'
