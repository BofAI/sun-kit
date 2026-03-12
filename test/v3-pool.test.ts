/**
 * Unit tests for v3-pool module
 */

// Mock TronWeb
jest.mock('../src/kit/tronweb', () => ({
  createReadonlyTronWeb: jest.fn().mockResolvedValue({
    address: {
      toHex: (addr: string) => '41' + addr.slice(1),
      fromHex: (hex: string) => 'T' + hex.slice(2),
    },
    contract: jest.fn().mockResolvedValue({
      getPool: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue('TPoolAddress1234567890123456789012'),
      }),
      slot0: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue({
          sqrtPriceX96: '79228162514264337593543950336',
          tick: 0,
          observationIndex: 0,
          observationCardinality: 1,
          observationCardinalityNext: 1,
          feeProtocol: 0,
          unlocked: true,
        }),
      }),
      liquidity: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue('1000000000000'),
      }),
      tickSpacing: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue(60),
      }),
    }),
  }),
}))

import { getV3PoolInfo } from '../src/kit/v3-pool'

describe('v3-pool', () => {
  const mockCtx = {
    wallet: null,
    rpcOverride: undefined,
    apiKey: undefined,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getV3PoolInfo', () => {
    it('returns pool info when pool exists', async () => {
      const result = await getV3PoolInfo(
        mockCtx,
        'mainnet',
        'TToken0Address12345678901234567890',
        'TToken1Address12345678901234567890',
        3000,
      )

      expect(result).toBeDefined()
      expect(result!.poolAddress).toBeTruthy()
      expect(result!.sqrtPriceX96).toBeTruthy()
      expect(result!.tick).toBeDefined()
      expect(result!.tickSpacing).toBeDefined()
      expect(result!.liquidity).toBeTruthy()
    })

    it('works with different fee tiers', async () => {
      for (const fee of [500, 3000, 10000]) {
        const result = await getV3PoolInfo(
          mockCtx,
          'mainnet',
          'TToken0Address12345678901234567890',
          'TToken1Address12345678901234567890',
          fee,
        )
        expect(result).toBeDefined()
      }
    })

    it('works with mainnet network', async () => {
      const result = await getV3PoolInfo(
        mockCtx,
        'mainnet',
        'TToken0Address12345678901234567890',
        'TToken1Address12345678901234567890',
        3000,
      )
      expect(result).toBeDefined()
    })

    it('works with nile network', async () => {
      const result = await getV3PoolInfo(
        mockCtx,
        'nile',
        'TToken0Address12345678901234567890',
        'TToken1Address12345678901234567890',
        3000,
      )
      expect(result).toBeDefined()
    })
  })
})
