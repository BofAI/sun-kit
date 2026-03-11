import type { TronWeb } from 'tronweb'

// ---------------------------------------------------------------------------
// Wallet interface — consumers provide their own implementation
// ---------------------------------------------------------------------------

export interface Wallet {
  readonly type: string
  getAddress(): Promise<string>
  getTronWeb(network?: string): Promise<TronWeb>
  signAndBroadcast(
    unsignedTx: Record<string, unknown>,
    network?: string,
  ): Promise<{ result: boolean; txid: string }>
  signMessage(message: string): Promise<string>
  signTypedData(
    primaryType: string,
    domain: Record<string, unknown>,
    types: Record<string, unknown>,
    message: Record<string, unknown>,
  ): Promise<string>
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SunKitError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'SunKitError'
  }
}

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

export interface ContractCallParams {
  address: string
  functionName: string
  args?: any[]
  abi?: any[]
}

export interface ContractSendParams extends ContractCallParams {
  value?: string
}

export interface RawContractTxParams {
  address: string
  functionSelector: string
  parameter: { type: string; value: unknown }[]
  callValue?: number
  feeLimit?: number
}

// ---------------------------------------------------------------------------
// Swap types
// ---------------------------------------------------------------------------

export interface SwapParams {
  tokenIn: string
  tokenOut: string
  amountIn: string
  network?: string
  slippage?: number
}

export interface SwapResult {
  txid: string
  route: {
    amountIn: string
    amountOut: string
    symbols: string[]
    poolVersions: string[]
    impact: string
  }
}

// ---------------------------------------------------------------------------
// Router types
// ---------------------------------------------------------------------------

export interface QuoteExactInputParams {
  network?: string
  routerAddress: string
  functionName?: string
  args: any[]
  abi?: any[]
}

export interface SwapExactInputParams {
  network?: string
  routerAddress: string
  functionName?: string
  args: any[]
  value?: string
  abi?: any[]
}

// ---------------------------------------------------------------------------
// Liquidity V2 types
// ---------------------------------------------------------------------------

export interface AddLiquidityV2Params {
  network?: string
  routerAddress: string
  abi?: any[]
  tokenA: string
  tokenB: string
  amountADesired: string
  amountBDesired: string
  amountAMin?: string
  amountBMin?: string
  to?: string
  deadline?: string | number
}

export interface RemoveLiquidityV2Params {
  network?: string
  routerAddress: string
  abi?: any[]
  tokenA: string
  tokenB: string
  liquidity: string
  amountAMin?: string
  amountBMin?: string
  to?: string
  deadline?: string | number
}

// ---------------------------------------------------------------------------
// Positions V3 types
// ---------------------------------------------------------------------------

export interface MintPositionV3Params {
  network?: string
  positionManagerAddress: string
  abi?: any[]
  token0: string
  token1: string
  fee?: number
  tickLower?: number
  tickUpper?: number
  amount0Desired?: string
  amount1Desired?: string
  amount0Min?: string
  amount1Min?: string
  recipient?: string
  deadline?: string | number
}

export interface IncreaseLiquidityV3Params {
  network?: string
  positionManagerAddress: string
  abi?: any[]
  tokenId: string
  token0?: string
  token1?: string
  fee?: number
  tickLower?: number
  tickUpper?: number
  amount0Desired?: string
  amount1Desired?: string
  amount0Min?: string
  amount1Min?: string
  deadline?: string | number
}

export interface DecreaseLiquidityV3Params {
  network?: string
  positionManagerAddress: string
  abi?: any[]
  tokenId: string
  liquidity: string
  amount0Min?: string
  amount1Min?: string
  deadline?: string | number
}

// ---------------------------------------------------------------------------
// Positions V3 collect
// ---------------------------------------------------------------------------

export interface CollectPositionV3Params {
  network?: string
  positionManagerAddress: string
  abi?: any[]
  tokenId: string
  recipient?: string
}

// ---------------------------------------------------------------------------
// Positions V4 types
// ---------------------------------------------------------------------------

export interface MintPositionV4Params {
  network?: string
  token0: string
  token1: string
  fee?: number
  tickLower?: number
  tickUpper?: number
  amount0Desired?: string
  amount1Desired?: string
  slippage?: number
  recipient?: string
  deadline?: string | number
  sqrtPriceX96?: string
  createPoolIfNeeded?: boolean
}

export interface IncreaseLiquidityV4Params {
  network?: string
  tokenId: string
  token0: string
  token1: string
  fee?: number
  amount0Desired?: string
  amount1Desired?: string
  slippage?: number
  deadline?: string | number
}

export interface DecreaseLiquidityV4Params {
  network?: string
  tokenId: string
  liquidity: string
  token0: string
  token1: string
  fee?: number
  amount0Min?: string
  amount1Min?: string
  slippage?: number
  deadline?: string | number
}

export interface CollectPositionV4Params {
  network?: string
  tokenId: string
  token0?: string
  token1?: string
  fee?: number
  deadline?: string | number
}

// ---------------------------------------------------------------------------
// SunPump types
// ---------------------------------------------------------------------------

export enum SunPumpTokenState {
  NOT_EXIST = 0,
  TRADING = 1,
  LAUNCHED = 2,
}

export interface SunPumpTokenInfo {
  tokenAddress: string
  state: SunPumpTokenState
  price: string
  launched: boolean
  trxReserve: string
  tokenReserve: string
}

export interface BuyTokenParams {
  tokenAddress: string
  trxAmount: string
  minTokenOut?: string
  slippage?: number
  network?: string
}

export interface BuyTokenResult {
  txResult: unknown
  tokenAddress: string
  trxSpent: string
  expectedTokens: string
  minTokenOut: string
}

export interface SellTokenParams {
  tokenAddress: string
  tokenAmount: string
  minTrxOut?: string
  slippage?: number
  network?: string
}

export interface SellTokenResult {
  txResult: unknown
  tokenAddress: string
  tokensSold: string
  expectedTrx: string
  minTrxOut: string
}

// ---------------------------------------------------------------------------
// Balance types
// ---------------------------------------------------------------------------

export interface TokenBalanceRequest {
  address: string
  type: 'TRX' | 'TRC20'
  tokenAddress?: string
}

export interface TokenBalanceResult {
  address: string
  type: 'TRX' | 'TRC20'
  tokenAddress?: string
  balance: string
}

export interface GetBalancesParams {
  network?: string
  ownerAddress?: string
  tokens: TokenBalanceRequest[]
}

// ---------------------------------------------------------------------------
// Allowance types
// ---------------------------------------------------------------------------

export interface EnsureAllowanceParams {
  network?: string
  tokenAddress: string
  spender: string
  requiredAmount: string
}
