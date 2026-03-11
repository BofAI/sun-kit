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
export { SunKitError, SunPumpTokenState } from './types'
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
  CollectPositionV3Params,
  MintPositionV4Params,
  IncreaseLiquidityV4Params,
  DecreaseLiquidityV4Params,
  CollectPositionV4Params,
  BuyTokenParams,
  BuyTokenResult,
  SellTokenParams,
  SellTokenResult,
  SunPumpTokenInfo,
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
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
  PERMIT2_MAINNET,
  PERMIT2_NILE,
  SUNPUMP_MAINNET,
  SUNPUMP_NILE,
  SUNPUMP_WTRX,
  TRC20_MIN_ABI,
  SUNSWAP_V2_FACTORY_MIN_ABI,
  SUNSWAP_V2_PAIR_MIN_ABI,
  SUNSWAP_V3_POSITION_MANAGER_MIN_ABI,
  SUNSWAP_V4_CL_POSITION_MANAGER_MIN_ABI,
  SUNPUMP_ABI,
  type NetworkConstants,
  type SwapConstants,
} from './constants'
