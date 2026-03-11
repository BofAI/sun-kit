import type { TronWeb } from 'tronweb'
import type {
  Wallet,
  ContractCallParams,
  ContractSendParams,
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
  TokenBalanceResult,
  EnsureAllowanceParams,
} from '../types'
import { SunPumpTokenState } from '../types'
import type { ContractContext } from './contracts'
import { readContract, sendContractTx, ensureTokenAllowance as _ensureTokenAllowance } from './contracts'
import { createReadonlyTronWeb } from './tronweb'
import { getBalances as _getBalances } from './balances'
import { quoteExactInput as _quoteExactInput, swapExactInput as _swapExactInput } from './router'
import { executeSwap } from './swap'
import { addLiquidityV2 as _addLiquidityV2, removeLiquidityV2 as _removeLiquidityV2 } from './liquidity-v2'
import {
  mintPositionV3 as _mintPositionV3,
  increaseLiquidityV3 as _increaseLiquidityV3,
  decreaseLiquidityV3 as _decreaseLiquidityV3,
  collectPositionV3 as _collectPositionV3,
} from './positions-v3'
import {
  mintPositionV4 as _mintPositionV4,
  increaseLiquidityV4 as _increaseLiquidityV4,
  decreaseLiquidityV4 as _decreaseLiquidityV4,
  collectPositionV4 as _collectPositionV4,
  getV4PositionInfo as _getV4PositionInfo,
  priceToSqrtPriceX96,
  sqrtPriceX96ToPrice,
  amountsToSqrtPriceX96,
  getCLPositionManagerAddress,
  getPoolManagerAddress,
  getPermit2Address,
} from './positions-v4'
import {
  buyToken as _buyToken,
  sellToken as _sellToken,
  getSunPumpTokenInfo as _getSunPumpTokenInfo,
  getTokenState as _getTokenState,
  getTokenPrice as _getTokenPrice,
  quoteBuy as _quoteBuy,
  quoteSell as _quoteSell,
  getMemeTokenBalance as _getMemeTokenBalance,
  getSunPumpAddress,
} from './sunpump'

// ---------------------------------------------------------------------------
// SunKit — main entry point for wallet-dependent on-chain operations
// ---------------------------------------------------------------------------

export interface SunKitOptions {
  wallet?: Wallet
  network?: string
  tronGridApiKey?: string
  rpcUrl?: string
}

export class SunKit {
  readonly wallet: Wallet | null
  readonly network: string
  private readonly apiKey?: string
  private readonly rpcOverride?: string

  constructor(options: SunKitOptions = {}) {
    this.wallet = options.wallet ?? null
    this.network = options.network ?? 'mainnet'
    this.apiKey = options.tronGridApiKey
    this.rpcOverride = options.rpcUrl
  }

  private get ctx(): ContractContext {
    return {
      wallet: this.wallet,
      rpcOverride: this.rpcOverride,
      apiKey: this.apiKey,
    }
  }

  // ---- Read-only TronWeb --------------------------------------------------

  async getReadonlyTronWeb(network?: string): Promise<TronWeb> {
    return createReadonlyTronWeb(network ?? this.network, this.rpcOverride, this.apiKey)
  }

  // ---- Balances (read-only, wallet optional for ownerAddress) -------------

  async getBalances(params: GetBalancesParams): Promise<TokenBalanceResult[]> {
    return _getBalances(this.ctx, { ...params, network: params.network ?? this.network })
  }

  // ---- Contract helpers ---------------------------------------------------

  async readContract(params: ContractCallParams, network?: string): Promise<unknown> {
    return readContract(this.ctx, params, network ?? this.network)
  }

  async sendContractTx(params: ContractSendParams & { network?: string }): Promise<unknown> {
    return sendContractTx(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async ensureTokenAllowance(params: EnsureAllowanceParams): Promise<void> {
    return _ensureTokenAllowance(this.ctx, { ...params, network: params.network ?? this.network })
  }

  // ---- Router helpers -----------------------------------------------------

  async quoteExactInput(params: QuoteExactInputParams): Promise<unknown> {
    return _quoteExactInput(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async swapExactInput(params: SwapExactInputParams): Promise<unknown> {
    return _swapExactInput(this.ctx, { ...params, network: params.network ?? this.network })
  }

  // ---- Swap ---------------------------------------------------------------

  async swap(params: SwapParams): Promise<SwapResult> {
    return executeSwap(this.ctx, { ...params, network: params.network ?? this.network })
  }

  // ---- Liquidity V2 -------------------------------------------------------

  async addLiquidityV2(params: AddLiquidityV2Params): Promise<unknown> {
    return _addLiquidityV2(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async removeLiquidityV2(params: RemoveLiquidityV2Params): Promise<unknown> {
    return _removeLiquidityV2(this.ctx, { ...params, network: params.network ?? this.network })
  }

  // ---- Positions V3 -------------------------------------------------------

  async mintPositionV3(params: MintPositionV3Params): Promise<unknown> {
    return _mintPositionV3(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async increaseLiquidityV3(params: IncreaseLiquidityV3Params): Promise<unknown> {
    return _increaseLiquidityV3(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async decreaseLiquidityV3(params: DecreaseLiquidityV3Params): Promise<unknown> {
    return _decreaseLiquidityV3(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async collectPositionV3(params: CollectPositionV3Params): Promise<{ estimatedFees: { amount0: string; amount1: string }; txResult: unknown }> {
    return _collectPositionV3(this.ctx, { ...params, network: params.network ?? this.network })
  }

  // ---- Positions V4 -------------------------------------------------------

  async mintPositionV4(params: MintPositionV4Params) {
    return _mintPositionV4(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async increaseLiquidityV4(params: IncreaseLiquidityV4Params) {
    return _increaseLiquidityV4(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async decreaseLiquidityV4(params: DecreaseLiquidityV4Params) {
    return _decreaseLiquidityV4(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async collectPositionV4(params: CollectPositionV4Params) {
    return _collectPositionV4(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async getV4PositionInfo(positionManagerAddress: string, tokenId: string, network?: string) {
    return _getV4PositionInfo(this.ctx, network ?? this.network, positionManagerAddress, tokenId)
  }

  // ---- SunPump ------------------------------------------------------------

  async sunpumpBuy(params: BuyTokenParams): Promise<BuyTokenResult> {
    return _buyToken(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async sunpumpSell(params: SellTokenParams): Promise<SellTokenResult> {
    return _sellToken(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async getSunPumpTokenInfo(tokenAddress: string, network?: string): Promise<SunPumpTokenInfo> {
    return _getSunPumpTokenInfo(this.ctx, tokenAddress, network ?? this.network)
  }

  async getSunPumpTokenState(tokenAddress: string, network?: string): Promise<SunPumpTokenState> {
    return _getTokenState(this.ctx, tokenAddress, network ?? this.network)
  }

  async getSunPumpTokenPrice(tokenAddress: string, network?: string): Promise<string> {
    return _getTokenPrice(this.ctx, tokenAddress, network ?? this.network)
  }

  async sunpumpQuoteBuy(tokenAddress: string, trxAmount: string, network?: string) {
    return _quoteBuy(this.ctx, tokenAddress, trxAmount, network ?? this.network)
  }

  async sunpumpQuoteSell(tokenAddress: string, tokenAmount: string, network?: string) {
    return _quoteSell(this.ctx, tokenAddress, tokenAmount, network ?? this.network)
  }

  async getMemeTokenBalance(tokenAddress: string, ownerAddress?: string, network?: string) {
    return _getMemeTokenBalance(this.ctx, tokenAddress, ownerAddress, network ?? this.network)
  }

  // ---- Static helpers (no wallet needed) ----------------------------------

  static getCLPositionManagerAddress = getCLPositionManagerAddress
  static getPoolManagerAddress = getPoolManagerAddress
  static getPermit2Address = getPermit2Address
  static getSunPumpAddress = getSunPumpAddress
  static priceToSqrtPriceX96 = priceToSqrtPriceX96
  static sqrtPriceX96ToPrice = sqrtPriceX96ToPrice
  static amountsToSqrtPriceX96 = amountsToSqrtPriceX96
}
