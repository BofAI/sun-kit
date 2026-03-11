# @bankofai/sun-kit

TypeScript SDK for [SUN.IO](https://sun.io) / SUNSWAP on the TRON blockchain.

Provides two entry points:

- **`SunAPI`** — typed HTTP client for all SUN.IO read-only endpoints (pools, tokens, prices, positions, farms, etc.). Zero dependencies beyond `fetch`.
- **`SunKit`** — wallet-dependent on-chain operations (swap, liquidity, positions, contract calls). Requires `tronweb`.

Built as a shared library for [@bankofai/sun-mcp-server](https://github.com/AnotherOneNewCoder/sun-mcp-server) and the upcoming `sun-cli`.

## Install

```bash
npm install @bankofai/sun-kit
# tronweb is an optional peer dep — install it if you use SunKit (on-chain ops)
npm install tronweb
```

## Quick Start

### Read-only: SunAPI

```typescript
import { SunAPI } from '@bankofai/sun-kit'

const api = new SunAPI()

// Get token prices
const prices = await api.getPrice({ symbol: 'TRX,USDT' })
console.log(prices.data)

// Search pools
const pools = await api.searchPools({ query: 'USDT', protocol: 'V3' })

// Get user positions
const positions = await api.getUserPositions({ userAddress: 'TXxx...' })
```

No wallet, no tronweb — just HTTP.

### On-chain: SunKit

```typescript
import { SunKit, type Wallet } from '@bankofai/sun-kit'

// You provide a Wallet implementation (see below)
const kit = new SunKit({
  wallet: myWallet,
  network: 'mainnet', // or 'nile' for testnet
  tronGridApiKey: process.env.TRON_GRID_API_KEY,
})

// Swap tokens via Universal Router (auto route-finding + Permit2)
const result = await kit.swap({
  tokenIn: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',  // USDT
  tokenOut: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',  // TRX
  amountIn: '1000000', // 1 USDT (6 decimals)
  slippage: 0.005,
})
console.log(`txid: ${result.txid}`)

// Add V2 liquidity
await kit.addLiquidityV2({
  routerAddress: 'TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax',
  tokenA: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  tokenB: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
  amountADesired: '1000000',
  amountBDesired: '2000000',
})

// Mint a V3 concentrated liquidity position
await kit.mintPositionV3({
  positionManagerAddress: 'T...',
  token0: 'T...',
  token1: 'T...',
  fee: 3000,
  tickLower: -887220,
  tickUpper: 887220,
  amount0Desired: '1000000',
  amount1Desired: '2000000',
})

// Read any contract (view/pure)
const totalSupply = await kit.readContract({
  address: 'TTokenAddr',
  functionName: 'totalSupply',
})

// Get TRX and TRC20 balances
const balances = await kit.getBalances({
  ownerAddress: 'TYour...',
  tokens: [
    { address: '', type: 'TRX' },
    { address: '', type: 'TRC20', tokenAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
  ],
})
```

## Wallet Interface

sun-kit does **not** ship a wallet implementation. You bring your own:

```typescript
import type { Wallet } from '@bankofai/sun-kit'

class MyWallet implements Wallet {
  readonly type = 'my-wallet'

  async getAddress(): Promise<string> { /* ... */ }
  async getTronWeb(network?: string): Promise<TronWeb> { /* ... */ }
  async signAndBroadcast(unsignedTx: Record<string, unknown>, network?: string) {
    // Sign the transaction and broadcast it
    return { result: true, txid: '...' }
  }
  async signMessage(message: string): Promise<string> { /* ... */ }
  async signTypedData(primaryType, domain, types, message): Promise<string> { /* ... */ }
}
```

Reference implementations:
- `LocalWallet` (raw private key) — see [sun-mcp-server/src/wallet/local-wallet.ts](https://github.com/AnotherOneNewCoder/sun-mcp-server)
- `AgentWalletAdapter` (encrypted agent-wallet) — see [sun-mcp-server/src/wallet/agent-wallet-adapter.ts](https://github.com/AnotherOneNewCoder/sun-mcp-server)

## API Reference

### SunAPI Methods

All methods return `Promise<ApiResponse<T>>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getPrice(params)` | `GET /apiv2/price` | Token prices by address or symbol |
| `getTokens(params)` | `GET /apiv2/tokens` | List tokens |
| `searchTokens(params)` | `GET /apiv2/tokens/search` | Search tokens by keyword |
| `getPools(params)` | `GET /apiv2/pools` | List pools |
| `searchPools(params)` | `GET /apiv2/pools/search` | Search pools |
| `searchCountPools(params)` | `GET /apiv2/pools/search/count` | Count matching pools |
| `getTopApyPoolList(params)` | `GET /apiv2/pools/top_apy_list` | Top APY pools |
| `getPoolVolHistory(params)` | `GET /apiv2/pools/history/vol` | Pool volume history |
| `getPoolLiqHistory(params)` | `GET /apiv2/pools/history/liq` | Pool liquidity history |
| `getPoolHooks()` | `GET /apiv2/pools/hooks` | Pool hooks |
| `getUserPositions(params)` | `GET /apiv2/positions/user` | User liquidity positions |
| `getPoolUserPositionTick(params)` | `GET /apiv2/positions/tick` | Position tick info |
| `getPairs(params)` | `GET /apiv2/pairs` | Token pairs |
| `getFarms(params)` | `GET /apiv2/farms` | Yield farms |
| `getFarmTransactions(params)` | `GET /apiv2/farms/transactions` | Farm transactions |
| `getFarmPositions(params)` | `GET /apiv2/farms/positions/user` | User farm positions |
| `scanTransactions(params)` | `GET /apiv2/transactions/scan` | Transaction history |
| `getProtocol(params)` | `GET /apiv2/protocols` | Protocol overview |
| `getVolHistory(params)` | `GET /apiv2/protocols/history/vol` | Protocol volume history |
| `getLiqHistory(params)` | `GET /apiv2/protocols/history/liq` | Protocol liquidity history |
| `getUsersCountHistory(params)` | `GET /apiv2/protocols/history/usersCount` | User count history |
| `getTransactionsHistory(params)` | `GET /apiv2/protocols/history/transactions` | Transaction count history |
| `getPoolsCountHistory(params)` | `GET /apiv2/protocols/history/poolsCount` | Pool count history |

### SunKit Methods

| Method | Wallet Required | Description |
|--------|:-:|-------------|
| `getBalances(params)` | | TRX and TRC20 balances |
| `readContract(params)` | | Call view/pure contract functions |
| `getReadonlyTronWeb(network?)` | | Get a read-only TronWeb instance |
| `quoteExactInput(params)` | | Quote a swap via smart router |
| `sendContractTx(params)` | Yes | Send a state-changing contract call |
| `ensureTokenAllowance(params)` | Yes | Approve token if allowance is insufficient |
| `swapExactInput(params)` | Yes | Low-level router swap |
| `swap(params)` | Yes | High-level swap (auto route + Permit2) |
| `addLiquidityV2(params)` | Yes | Add V2 liquidity (auto TRX/ETH detection) |
| `removeLiquidityV2(params)` | Yes | Remove V2 liquidity |
| `mintPositionV3(params)` | Yes | Mint a new V3 concentrated position |
| `increaseLiquidityV3(params)` | Yes | Increase V3 position liquidity |
| `decreaseLiquidityV3(params)` | Yes | Decrease V3 position liquidity |
| `modifyLiquidityV4(params)` | Yes | *Stub — not yet implemented* |
| `createToken(params)` | Yes | *Stub — not yet implemented* |
| `pumpSwap(params)` | Yes | *Stub — not yet implemented* |

## Networks

```typescript
import { TronNetwork, getNetworkConfig, NETWORKS } from '@bankofai/sun-kit'

getNetworkConfig('mainnet')  // or 'tron', 'trx'
getNetworkConfig('nile')     // or 'testnet'
getNetworkConfig('shasta')
```

## Constants

Pre-configured contract addresses for common use:

```typescript
import {
  TRX_ADDRESS,
  WTRX_MAINNET,
  SUNSWAP_V2_MAINNET_ROUTER,
  SUNSWAP_V2_MAINNET_FACTORY,
  SUNSWAP_V2_NILE_ROUTER,
  SUNSWAP_V3_MAINNET_FACTORY,
  SUNSWAP_V3_MAINNET_POSITION_MANAGER,
  // ...
} from '@bankofai/sun-kit'
```

## Error Handling

All errors thrown by SunKit are instances of `SunKitError`:

```typescript
import { SunKitError } from '@bankofai/sun-kit'

try {
  await kit.swap({ ... })
} catch (err) {
  if (err instanceof SunKitError) {
    console.error(err.code, err.message)
  }
}
```

Error codes:

| Code | Description |
|------|-------------|
| `NO_WALLET` | Write operation attempted without a wallet |
| `NOT_IMPLEMENTED` | Stub method (V4, SunPump) |
| `NO_ROUTE` | Swap route not found |
| `UNSUPPORTED_NETWORK` | Network not supported |
| `CONTRACT_READ_FAILED` | Contract read call failed |
| `BROADCAST_FAILED` | Transaction broadcast failed |
| `POOL_NOT_FOUND` | V2 pair does not exist |
| `ALLOWANCE_FAILED` | Token approve failed |
| `API_ERROR` | SunAPI HTTP error |

## Architecture

```
@bankofai/sun-kit
├── SunAPI          (read-only HTTP, zero deps)
│   └── 23 typed methods -> SUN.IO open API
│
├── SunKit          (wallet-dependent, needs tronweb)
│   ├── swap        Universal Router + Permit2
│   ├── liquidity   V2 add/remove, V3 mint/increase/decrease
│   ├── contracts   read, send, approve
│   ├── balances    TRX + TRC20
│   └── stubs       V4 liquidity, SunPump
│
├── Wallet          interface only (consumers implement)
├── chains          network configs (mainnet, nile, shasta)
└── constants       contract addresses, ABIs
```

## License

MIT
