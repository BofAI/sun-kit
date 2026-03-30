export enum TronNetwork {
  Mainnet = 'mainnet',
  Nile = 'nile',
  Shasta = 'shasta',
}

export interface NetworkConfig {
  name: string
  fullNode: string
  solidityNode: string
  eventServer: string
}

export const NETWORKS: Record<TronNetwork, NetworkConfig> = {
  [TronNetwork.Mainnet]: {
    name: 'Mainnet',
    fullNode: 'https://hptg.bankofai.io',
    solidityNode: 'https://hptg.bankofai.io',
    eventServer: 'https://hptg.bankofai.io',
  },
  [TronNetwork.Nile]: {
    name: 'Nile',
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io',
  },
  [TronNetwork.Shasta]: {
    name: 'Shasta',
    fullNode: 'https://api.shasta.trongrid.io',
    solidityNode: 'https://api.shasta.trongrid.io',
    eventServer: 'https://api.shasta.trongrid.io',
  },
}

export const DEFAULT_NETWORK = TronNetwork.Mainnet

export function getNetworkConfig(
  network: string = DEFAULT_NETWORK,
  rpcOverride?: string,
): NetworkConfig {
  const normalized = network.toLowerCase()

  let baseConfig: NetworkConfig | undefined

  if (Object.values(TronNetwork).includes(normalized as TronNetwork)) {
    baseConfig = NETWORKS[normalized as TronNetwork]
  } else if (normalized === 'tron' || normalized === 'trx' || normalized === 'mainnet') {
    baseConfig = NETWORKS[TronNetwork.Mainnet]
  } else if (normalized === 'testnet') {
    baseConfig = NETWORKS[TronNetwork.Nile]
  }

  if (!baseConfig) {
    throw new Error(`Unsupported network: ${network}`)
  }

  if (rpcOverride) {
    return {
      ...baseConfig,
      fullNode: rpcOverride,
      solidityNode: rpcOverride,
      eventServer: rpcOverride,
    }
  }

  return baseConfig
}
