import { SunKitError } from '../types'
import type {
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
  ApiResponse,
} from './types'

export type { ApiResponse }
export * from './types'

// ---------------------------------------------------------------------------
// SunAPI — typed read-only HTTP client for SUN.IO open API
// ---------------------------------------------------------------------------

export interface SunAPIOptions {
  baseUrl?: string
}

const DEFAULT_BASE_URL = 'https://open.sun.io'

export class SunAPI {
  private readonly baseUrl: string

  constructor(options: SunAPIOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  // ---- internal helpers ---------------------------------------------------

  private async get<T = any>(path: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(path, this.baseUrl)

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new SunKitError(
        'API_ERROR',
        `SUN.IO API error: ${response.status} ${response.statusText} for ${path}`,
      )
    }

    return (await response.json()) as ApiResponse<T>
  }

  // ---- Transactions -------------------------------------------------------

  async scanTransactions(params: ScanTransactionsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/transactions/scan', params as any)
  }

  // ---- Tokens -------------------------------------------------------------

  async getTokens(params: GetTokensParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/tokens', params as any)
  }

  async searchTokens(params: SearchTokensParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/tokens/search', params as any)
  }

  // ---- Protocols ----------------------------------------------------------

  async getProtocol(params: GetProtocolParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/protocols', params as any)
  }

  async getVolHistory(params: ProtocolHistoryParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/protocols/history/vol', params as any)
  }

  async getUsersCountHistory(params: ProtocolHistoryParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/protocols/history/usersCount', params as any)
  }

  async getTransactionsHistory(params: ProtocolHistoryParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/protocols/history/transactions', params as any)
  }

  async getPoolsCountHistory(params: ProtocolHistoryParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/protocols/history/poolsCount', params as any)
  }

  async getLiqHistory(params: ProtocolHistoryParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/protocols/history/liq', params as any)
  }

  // ---- Prices -------------------------------------------------------------

  async getPrice(params: GetPriceParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/price', params as any)
  }

  // ---- Positions ----------------------------------------------------------

  async getUserPositions(params: GetUserPositionsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/positions/user', params as any)
  }

  async getPoolUserPositionTick(params: GetPoolUserPositionTickParams): Promise<ApiResponse> {
    return this.get('/apiv2/positions/tick', params as any)
  }

  // ---- Pools --------------------------------------------------------------

  async getPools(params: GetPoolsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/pools', params as any)
  }

  async getTopApyPoolList(params: GetTopApyPoolListParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/pools/top_apy_list', params as any)
  }

  async searchPools(params: SearchPoolsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/pools/search', params as any)
  }

  async searchCountPools(params: SearchCountPoolsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/pools/search/count', params as any)
  }

  async getPoolHooks(): Promise<ApiResponse> {
    return this.get('/apiv2/pools/hooks')
  }

  async getPoolVolHistory(params: PoolHistoryParams): Promise<ApiResponse> {
    return this.get('/apiv2/pools/history/vol', params as any)
  }

  async getPoolLiqHistory(params: PoolHistoryParams): Promise<ApiResponse> {
    return this.get('/apiv2/pools/history/liq', params as any)
  }

  // ---- Pairs --------------------------------------------------------------

  async getPairs(params: GetPairsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/pairs', params as any)
  }

  // ---- Farms --------------------------------------------------------------

  async getFarms(params: GetFarmsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/farms', params as any)
  }

  async getFarmTransactions(params: GetFarmTransactionsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/farms/transactions', params as any)
  }

  async getFarmPositions(params: GetFarmPositionsParams = {}): Promise<ApiResponse> {
    return this.get('/apiv2/farms/positions/user', params as any)
  }
}
