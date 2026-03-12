/**
 * Unit tests for balances module
 */

// Mock TronWeb
const mockGetBalance = jest.fn().mockResolvedValue('1000000000')
const mockBalanceOf = jest.fn().mockReturnValue({
  call: jest.fn().mockResolvedValue('500000000'),
})
const mockContractAt = jest.fn().mockResolvedValue({
  balanceOf: mockBalanceOf,
})

jest.mock('../src/kit/tronweb', () => ({
  createReadonlyTronWeb: jest.fn().mockResolvedValue({
    trx: {
      getBalance: mockGetBalance,
    },
    contract: jest.fn().mockReturnValue({
      at: mockContractAt,
    }),
  }),
}))

import { getBalances } from '../src/kit/balances'

describe('balances', () => {
  const mockCtx: any = {
    wallet: {
      type: 'local' as const,
      getAddress: jest.fn().mockResolvedValue('TTestWalletAddress123456789012345'),
      getTronWeb: jest.fn(),
      signAndBroadcast: jest.fn(),
      signMessage: jest.fn(),
      signTypedData: jest.fn(),
    },
    rpcOverride: undefined,
    apiKey: undefined,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getBalances', () => {
    it('returns TRX balance', async () => {
      const results = await getBalances(mockCtx, {
        tokens: [{ type: 'TRX', address: 'native' }],
        network: 'mainnet',
      })

      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('TRX')
      expect(results[0].balance).toBe('1000000000')
    })

    it('returns TRC20 balance', async () => {
      const results = await getBalances(mockCtx, {
        tokens: [{ type: 'TRC20', address: 'TTokenAddress123456789012345678', tokenAddress: 'TTokenAddress123456789012345678' }],
        network: 'mainnet',
      })

      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('TRC20')
      expect(results[0].tokenAddress).toBe('TTokenAddress123456789012345678')
      expect(results[0].balance).toBe('500000000')
    })

    it('returns multiple token balances', async () => {
      const results = await getBalances(mockCtx, {
        tokens: [
          { type: 'TRX', address: 'native' },
          { type: 'TRC20', address: 'TTokenAddress123456789012345678', tokenAddress: 'TTokenAddress123456789012345678' },
        ],
        network: 'mainnet',
      })

      expect(results).toHaveLength(2)
      expect(results[0].type).toBe('TRX')
      expect(results[1].type).toBe('TRC20')
    })

    it('uses provided ownerAddress', async () => {
      const results = await getBalances(mockCtx, {
        tokens: [{ type: 'TRX', address: 'native' }],
        ownerAddress: 'TCustomOwnerAddress12345678901234',
        network: 'mainnet',
      })

      expect(mockGetBalance).toHaveBeenCalledWith('TCustomOwnerAddress12345678901234')
      expect(results[0].address).toBe('TCustomOwnerAddress12345678901234')
    })

    it('uses wallet address when ownerAddress not provided', async () => {
      await getBalances(mockCtx, {
        tokens: [{ type: 'TRX', address: 'native' }],
        network: 'mainnet',
      })

      expect(mockCtx.wallet.getAddress).toHaveBeenCalled()
    })

    it('throws when no wallet and no ownerAddress', async () => {
      const ctxNoWallet = { wallet: null, rpcOverride: undefined, apiKey: undefined }

      await expect(
        getBalances(ctxNoWallet, {
          tokens: [{ type: 'TRX', address: 'native' }],
          network: 'mainnet',
        }),
      ).rejects.toThrow('ownerAddress is required')
    })

    it('throws when TRC20 token has no tokenAddress', async () => {
      await expect(
        getBalances(mockCtx, {
          tokens: [{ type: 'TRC20', address: 'TToken' }],
          network: 'mainnet',
        }),
      ).rejects.toThrow('tokenAddress is required')
    })

    it('defaults network to mainnet', async () => {
      const results = await getBalances(mockCtx, {
        tokens: [{ type: 'TRX', address: 'native' }],
      })

      expect(results).toHaveLength(1)
    })
  })
})
