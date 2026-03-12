import { getNetworkConfig, TronNetwork, NETWORKS, DEFAULT_NETWORK } from '../src/chains'

describe('chains config', () => {
  it('returns mainnet config as default', () => {
    const cfgDefault = getNetworkConfig()
    const cfgExplicit = getNetworkConfig(TronNetwork.Mainnet)

    expect(cfgDefault.fullNode).toBe(cfgExplicit.fullNode)
    expect(cfgDefault.solidityNode).toBe(cfgExplicit.solidityNode)
    expect(cfgDefault.eventServer).toBe(cfgExplicit.eventServer)
  })

  it('supports common network aliases', () => {
    const mainByTron = getNetworkConfig('tron')
    const mainByTrx = getNetworkConfig('TRX')
    const mainByMainnet = getNetworkConfig('mainnet')

    expect(mainByTron.fullNode).toBe(mainByMainnet.fullNode)
    expect(mainByTrx.fullNode).toBe(mainByMainnet.fullNode)
  })

  it('maps testnet alias to Nile', () => {
    const nile = getNetworkConfig(TronNetwork.Nile)
    const testnet = getNetworkConfig('testnet')

    expect(testnet.fullNode).toBe(nile.fullNode)
  })

  it('supports Shasta network', () => {
    const shasta = getNetworkConfig(TronNetwork.Shasta)
    expect(shasta.name).toBe('Shasta')
    expect(shasta.fullNode).toContain('shasta')
  })

  it('throws on unsupported network', () => {
    expect(() => getNetworkConfig('unknown-network')).toThrow(/Unsupported network/)
  })

  it('honours rpcOverride parameter', () => {
    const customRpc = 'https://custom-rpc.tron.local'
    const cfg = getNetworkConfig('mainnet', customRpc)

    expect(cfg.fullNode).toBe(customRpc)
    expect(cfg.solidityNode).toBe(customRpc)
    expect(cfg.eventServer).toBe(customRpc)
  })

  it('is case insensitive', () => {
    const cfg1 = getNetworkConfig('MAINNET')
    const cfg2 = getNetworkConfig('Mainnet')
    const cfg3 = getNetworkConfig('mainnet')

    expect(cfg1.fullNode).toBe(cfg2.fullNode)
    expect(cfg2.fullNode).toBe(cfg3.fullNode)
  })

  it('NETWORKS has all expected networks', () => {
    expect(NETWORKS[TronNetwork.Mainnet]).toBeDefined()
    expect(NETWORKS[TronNetwork.Nile]).toBeDefined()
    expect(NETWORKS[TronNetwork.Shasta]).toBeDefined()
  })

  it('DEFAULT_NETWORK is mainnet', () => {
    expect(DEFAULT_NETWORK).toBe(TronNetwork.Mainnet)
  })
})
