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
  ModifyLiquidityV4Params,
  CreateTokenParams,
  PumpSwapParams,
  GetBalancesParams,
  TokenBalanceResult,
  EnsureAllowanceParams,
} from '../types'
import type { ContractContext } from './contracts'
import { readContract, sendContractTx, ensureTokenAllowance as _ensureTokenAllowance } from './contracts'
import { createReadonlyTronWeb } from './tronweb'
import { getBalances as _getBalances } from './balances'
import { quoteExactInput as _quoteExactInput, swapExactInput as _swapExactInput } from './router'
import { executeSwap } from './swap'
import { addLiquidityV2 as _addLiquidityV2, removeLiquidityV2 as _removeLiquidityV2 } from './liquidity-v2'
import { mintPositionV3 as _mintPositionV3, increaseLiquidityV3 as _increaseLiquidityV3, decreaseLiquidityV3 as _decreaseLiquidityV3 } from './positions-v3'
import { modifyLiquidityV4 as _modifyLiquidityV4 } from './liquidity-v4'
import { createToken as _createToken, pumpSwap as _pumpSwap } from './sunpump'

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

  /** Internal context passed to all module functions */
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

  // ---- V4 (stub) ----------------------------------------------------------

  async modifyLiquidityV4(params: ModifyLiquidityV4Params): Promise<unknown> {
    return _modifyLiquidityV4(this.ctx, { ...params, network: params.network ?? this.network })
  }

  // ---- SunPump (stubs) ----------------------------------------------------

  async createToken(params: CreateTokenParams): Promise<unknown> {
    return _createToken(this.ctx, { ...params, network: params.network ?? this.network })
  }

  async pumpSwap(params: PumpSwapParams): Promise<unknown> {
    return _pumpSwap(this.ctx, { ...params, network: params.network ?? this.network })
  }
}
