/**
 * Unit tests for SunPump (meme token) trading module
 */

import { SUNPUMP_MAINNET, SUNPUMP_NILE } from '../src/constants'
import { SunPumpTokenState } from '../src/types'

// Mock the contracts module
jest.mock('../src/kit/contracts', () => ({
  readContract: jest.fn(),
  sendContractTx: jest.fn(),
  requireWallet: jest.fn(() => ({
    getAddress: jest.fn().mockResolvedValue('TTestWalletAddress123456789012345'),
  })),
}))

// Mock the tronweb module
jest.mock('../src/kit/tronweb', () => ({
  createReadonlyTronWeb: jest.fn().mockResolvedValue({
    contract: jest.fn().mockResolvedValue({
      allowance: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue('0'),
      }),
      balanceOf: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue('1000000000000000000'),
      }),
    }),
  }),
}))

const mockReadContract = jest.requireMock('../src/kit/contracts').readContract
const mockSendContractTx = jest.requireMock('../src/kit/contracts').sendContractTx

import {
  getSunPumpAddress,
  getTokenState,
  getSunPumpTokenInfo,
  isTokenLaunched,
  quoteBuy,
  quoteSell,
  buyToken,
  sellToken,
  getMemeTokenBalance,
} from '../src/kit/sunpump'

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

describe('SunPump', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getSunPumpAddress', () => {
    it('returns mainnet address for mainnet', () => {
      expect(getSunPumpAddress('mainnet')).toBe(SUNPUMP_MAINNET)
      expect(getSunPumpAddress('tron')).toBe(SUNPUMP_MAINNET)
      expect(getSunPumpAddress('trx')).toBe(SUNPUMP_MAINNET)
    })

    it('returns nile address for testnet', () => {
      expect(getSunPumpAddress('nile')).toBe(SUNPUMP_NILE)
      expect(getSunPumpAddress('testnet')).toBe(SUNPUMP_NILE)
    })

    it('throws for unsupported network', () => {
      expect(() => getSunPumpAddress('ethereum')).toThrow('Unsupported network')
    })
  })

  describe('getTokenState', () => {
    it('returns TRADING state for active token', async () => {
      mockReadContract.mockResolvedValueOnce(1)

      const state = await getTokenState(mockCtx, 'TTestToken123', 'mainnet')
      expect(state).toBe(SunPumpTokenState.TRADING)
    })

    it('returns LAUNCHED state for graduated token', async () => {
      mockReadContract.mockResolvedValueOnce(2)

      const state = await getTokenState(mockCtx, 'TLaunchedToken', 'mainnet')
      expect(state).toBe(SunPumpTokenState.LAUNCHED)
    })

    it('returns NOT_EXIST state for unknown token', async () => {
      mockReadContract.mockResolvedValueOnce(0)

      const state = await getTokenState(mockCtx, 'TUnknownToken', 'mainnet')
      expect(state).toBe(SunPumpTokenState.NOT_EXIST)
    })
  })

  describe('getSunPumpTokenInfo', () => {
    it('returns token info correctly for trading token', async () => {
      // Mock getTokenState
      mockReadContract.mockResolvedValueOnce(1) // TRADING
      // Mock virtualPools
      mockReadContract.mockResolvedValueOnce(['10000000000', '800000000000000000000000000', false])
      // Mock getPrice
      mockReadContract.mockResolvedValueOnce('1000000')

      const info = await getSunPumpTokenInfo(mockCtx, 'TTestToken123', 'mainnet')

      expect(info.tokenAddress).toBe('TTestToken123')
      expect(info.state).toBe(SunPumpTokenState.TRADING)
      expect(info.price).toBe('1000000')
      expect(info.launched).toBe(false)
      expect(info.trxReserve).toBe('10000000000')
      expect(info.tokenReserve).toBe('800000000000000000000000000')
    })

    it('handles launched token', async () => {
      // Mock getTokenState
      mockReadContract.mockResolvedValueOnce(2) // LAUNCHED
      // Mock virtualPools
      mockReadContract.mockResolvedValueOnce(['0', '0', true])

      const info = await getSunPumpTokenInfo(mockCtx, 'TLaunchedToken', 'mainnet')
      expect(info.launched).toBe(true)
      expect(info.state).toBe(SunPumpTokenState.LAUNCHED)
    })
  })

  describe('isTokenLaunched', () => {
    it('returns false for trading token', async () => {
      mockReadContract.mockResolvedValueOnce(1) // TRADING

      const result = await isTokenLaunched(mockCtx, 'TTestToken123', 'mainnet')
      expect(result).toBe(false)
    })

    it('returns true for launched token', async () => {
      mockReadContract.mockResolvedValueOnce(2) // LAUNCHED

      const result = await isTokenLaunched(mockCtx, 'TLaunchedToken', 'mainnet')
      expect(result).toBe(true)
    })
  })

  describe('quoteBuy', () => {
    it('returns expected token amount and fee for TRX input', async () => {
      mockReadContract.mockResolvedValueOnce(['1000000000000000000', '10000000'])

      const result = await quoteBuy(mockCtx, 'TTestToken123', '1000000000', 'mainnet')

      expect(result.tokenAmount).toBe('1000000000000000000')
      expect(result.fee).toBe('10000000')
    })
  })

  describe('quoteSell', () => {
    it('returns expected TRX amount and fee for token input', async () => {
      mockReadContract.mockResolvedValueOnce(['500000000', '5000000'])

      const result = await quoteSell(mockCtx, 'TTestToken123', '1000000000000000000', 'mainnet')

      expect(result.trxAmount).toBe('500000000')
      expect(result.fee).toBe('5000000')
    })
  })

  describe('buyToken', () => {
    it('throws error if token does not exist', async () => {
      mockReadContract.mockResolvedValueOnce(0)

      await expect(
        buyToken(mockCtx, {
          tokenAddress: 'TUnknownToken',
          trxAmount: '1000000000',
        }),
      ).rejects.toThrow('does not exist')
    })

    it('throws error if token is already launched', async () => {
      mockReadContract.mockResolvedValueOnce(2)

      await expect(
        buyToken(mockCtx, {
          tokenAddress: 'TLaunchedToken',
          trxAmount: '1000000000',
        }),
      ).rejects.toThrow('has already launched to DEX')
    })

    it('executes buy successfully for trading token', async () => {
      // Mock getTokenState
      mockReadContract.mockResolvedValueOnce(1) // TRADING
      // Mock getTokenAmountByPurchaseWithFee
      mockReadContract.mockResolvedValueOnce(['1000000000000000000', '10000000'])
      // Mock sendContractTx
      mockSendContractTx.mockResolvedValueOnce({ txid: 'test-tx-id' })

      const result = await buyToken(mockCtx, {
        tokenAddress: 'TTestToken123',
        trxAmount: '1000000000',
        slippage: 0.05,
      })

      expect(result.txResult).toEqual({ txid: 'test-tx-id' })
      expect(result.tokenAddress).toBe('TTestToken123')
      expect(result.trxSpent).toBe('1000000000')
      expect(BigInt(result.expectedTokens)).toBeGreaterThan(0n)
    })
  })

  describe('sellToken', () => {
    it('throws error if token does not exist', async () => {
      mockReadContract.mockResolvedValueOnce(0)

      await expect(
        sellToken(mockCtx, {
          tokenAddress: 'TUnknownToken',
          tokenAmount: '1000000000000000000',
        }),
      ).rejects.toThrow('does not exist')
    })

    it('throws error if token is already launched', async () => {
      mockReadContract.mockResolvedValueOnce(2)

      await expect(
        sellToken(mockCtx, {
          tokenAddress: 'TLaunchedToken',
          tokenAmount: '1000000000000000000',
        }),
      ).rejects.toThrow('has already launched to DEX')
    })
  })

  describe('getMemeTokenBalance', () => {
    it('returns token balance', async () => {
      const balance = await getMemeTokenBalance(mockCtx, 'TTestToken123', undefined, 'mainnet')
      expect(balance).toBe('1000000000000000000')
    })
  })
})
