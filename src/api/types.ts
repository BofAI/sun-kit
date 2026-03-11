// ---------------------------------------------------------------------------
// SunAPI Request/Response types — derived from sunio-open-api.json
// Response types use `any` for data payloads since the API schema may evolve.
// Consumers can narrow these types as needed.
// ---------------------------------------------------------------------------

// Common pagination
export interface PaginatedParams {
  pageNo?: number
  pageSize?: number
  sort?: string
}

// --- Transactions ---

export interface ScanTransactionsParams {
  protocol?: string
  tokenAddress?: string
  poolAddress?: string
  type?: 'add' | 'withdraw' | 'swap'
  startTime?: string
  endTime?: string
  pageSize?: number
  offset?: string
}

// --- Tokens ---

export interface GetTokensParams extends PaginatedParams {
  tokenAddress?: string
  protocol?: string
  filterBlackList?: boolean
}

export interface SearchTokensParams extends PaginatedParams {
  query?: string
  protocol?: string
  filterBlackList?: boolean
}

// --- Protocols ---

export interface GetProtocolParams {
  protocol?: string
}

export interface ProtocolHistoryParams {
  protocol?: string
  startDate?: string
  endDate?: string
}

// --- Prices ---

export interface GetPriceParams {
  tokenAddress?: string
  symbol?: string
}

// --- Positions ---

export interface GetUserPositionsParams extends PaginatedParams {
  userAddress?: string
  poolAddress?: string
  protocol?: string
  query?: string
}

export interface GetPoolUserPositionTickParams {
  poolAddress: string
  pageNo?: number
  pageSize?: number
}

// --- Pools ---

export interface GetPoolsParams extends PaginatedParams {
  poolAddress?: string
  tokenAddress?: string
  protocol?: string
  desc?: boolean
  filterBlackList?: boolean
}

export interface GetTopApyPoolListParams {
  pageNo?: number
  pageSize?: number
}

export interface SearchPoolsParams extends PaginatedParams {
  query?: string
  protocol?: string
  desc?: boolean
  filterBlackList?: boolean
}

export interface SearchCountPoolsParams {
  query?: string
  protocol?: string
  filterBlackList?: boolean
}

export interface PoolHistoryParams {
  poolAddress: string
  startDate?: string
  endDate?: string
}

// --- Pairs ---

export interface GetPairsParams extends PaginatedParams {
  protocols?: string
  protocol?: string
  tokenAddress?: string
  desc?: boolean
}

// --- Farms ---

export interface GetFarmsParams extends PaginatedParams {
  farmAddress?: string
}

export interface GetFarmTransactionsParams extends PaginatedParams {
  userAddress?: string
  farmAddress?: string
  farmTxType?: string
  startTime?: string
  endTime?: string
}

export interface GetFarmPositionsParams extends PaginatedParams {
  userAddress?: string
  farmAddress?: string
}

// --- Generic API response wrapper ---

export interface ApiResponse<T = any> {
  code?: number
  message?: string
  data?: T
  [key: string]: unknown
}
