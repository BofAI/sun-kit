// Mock external modules before imports
jest.mock('@sun-protocol/universal-router-sdk', () => ({
  V4: {
    ACTIONS: {
      CL_MINT_POSITION: 'CL_MINT_POSITION',
      CL_INCREASE_LIQUIDITY: 'CL_INCREASE_LIQUIDITY',
      CL_DECREASE_LIQUIDITY: 'CL_DECREASE_LIQUIDITY',
      SETTLE: 'SETTLE',
      SWEEP: 'SWEEP',
      CLOSE_CURRENCY: 'CLOSE_CURRENCY',
    },
    ACTION_CONSTANTS: {
      OPEN_DELTA: BigInt(0),
    },
    ActionsPlanner: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      encode: jest.fn().mockReturnValue('0x'),
    })),
    CLPositionManagerAbi: [],
    Permit2ForwardAbi: [],
    encodePoolParameters: jest.fn().mockReturnValue('0x'),
    getPoolId: jest.fn().mockReturnValue('0x'),
  },
}))

jest.mock('@sun-protocol/permit2-sdk', () => ({
  AllowanceTransfer: jest.fn().mockImplementation(() => ({
    generatePermitSignData: jest.fn().mockResolvedValue({
      domain: {},
      permitSingle: {
        details: { token: '0x', amount: BigInt(0), expiration: 0, nonce: 0 },
        spender: '0x',
        sigDeadline: '0',
      },
    }),
  })),
}))

jest.mock('viem', () => ({
  encodeFunctionData: jest.fn().mockReturnValue('0x'),
  zeroAddress: '0x0000000000000000000000000000000000000000',
}))

import {
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
  PERMIT2_MAINNET,
  PERMIT2_NILE,
} from '../src/constants'

// Mock TronWeb - must be before imports
const mockTronWebInstance = {
  address: {
    toHex: (addr: string) => '41' + addr.slice(1),
    fromHex: (hex: string) => 'T' + hex.slice(2),
  },
  contract: jest.fn().mockResolvedValue({
    positions: jest.fn().mockReturnValue({
      call: jest.fn().mockResolvedValue({
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: '1000000',
      }),
    }),
  }),
  transactionBuilder: {
    triggerConstantContract: jest.fn().mockResolvedValue({
      constant_result: ['0000000000000000000000000000000000000001'],
    }),
    triggerSmartContract: jest.fn(),
  },
  utils: {
    abi: {
      decodeParams: jest.fn().mockReturnValue({
        sqrtPriceX96: '79228162514264337593543950336',
        tick: 0,
      }),
    },
  },
}

jest.mock('tronweb', () => ({
  TronWeb: function () {
    return mockTronWebInstance
  },
}))

// Mock contracts module
jest.mock('../src/kit/contracts', () => ({
  sendContractTx: jest.fn().mockResolvedValue({ txid: 'mock-txid' }),
  requireWallet: jest.fn(() => ({
    getAddress: jest.fn().mockResolvedValue('TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'),
    getTronWeb: jest.fn(),
    signAndBroadcast: jest.fn(),
    signTypedData: jest.fn(),
  })),
}))

// Mock tronweb module
jest.mock('../src/kit/tronweb', () => ({
  createReadonlyTronWeb: jest.fn().mockResolvedValue(mockTronWebInstance),
}))

import {
  getCLPositionManagerAddress,
  getPoolManagerAddress,
  getPermit2Address,
  priceToSqrtPriceX96,
  sqrtPriceX96ToPrice,
} from '../src/kit/positions-v4'
import { FEE_TICK_SPACING } from '../src/kit/v3-math'

describe('positionsV4', () => {
  describe('CLPositionManager addresses', () => {
    it('mainnet address is valid TRON format', () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('nile address is valid TRON format', () => {
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('mainnet and nile addresses are different', () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).not.toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })
  })

  describe('PoolManager addresses', () => {
    it('mainnet address is valid TRON format', () => {
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('nile address is valid TRON format', () => {
      expect(SUNSWAP_V4_NILE_POOL_MANAGER).toBeTruthy()
      expect(SUNSWAP_V4_NILE_POOL_MANAGER).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('mainnet and nile addresses are different', () => {
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).not.toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })
  })

  describe('Permit2 addresses', () => {
    it('mainnet address is valid TRON format', () => {
      expect(PERMIT2_MAINNET).toBeTruthy()
      expect(PERMIT2_MAINNET).toMatch(/^T[A-Za-z0-9]{33}$/)
    })

    it('nile address is valid TRON format', () => {
      expect(PERMIT2_NILE).toBeTruthy()
      expect(PERMIT2_NILE).toMatch(/^T[A-Za-z0-9]{33}$/)
    })
  })

  describe('getCLPositionManagerAddress', () => {
    it('returns mainnet address for mainnet', () => {
      expect(getCLPositionManagerAddress('mainnet')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
    })

    it('returns mainnet address for tron', () => {
      expect(getCLPositionManagerAddress('tron')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
    })

    it('returns mainnet address for trx', () => {
      expect(getCLPositionManagerAddress('trx')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
    })

    it('returns nile address for nile', () => {
      expect(getCLPositionManagerAddress('nile')).toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })

    it('returns nile address for testnet', () => {
      expect(getCLPositionManagerAddress('testnet')).toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })

    it('is case insensitive', () => {
      expect(getCLPositionManagerAddress('MAINNET')).toBe(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER)
      expect(getCLPositionManagerAddress('Nile')).toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
    })

    it('throws for unsupported network', () => {
      expect(() => getCLPositionManagerAddress('ethereum')).toThrow(/Unsupported network/)
    })
  })

  describe('getPoolManagerAddress', () => {
    it('returns mainnet address for mainnet', () => {
      expect(getPoolManagerAddress('mainnet')).toBe(SUNSWAP_V4_MAINNET_POOL_MANAGER)
    })

    it('returns mainnet address for tron', () => {
      expect(getPoolManagerAddress('tron')).toBe(SUNSWAP_V4_MAINNET_POOL_MANAGER)
    })

    it('returns nile address for nile', () => {
      expect(getPoolManagerAddress('nile')).toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })

    it('returns nile address for testnet', () => {
      expect(getPoolManagerAddress('testnet')).toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })

    it('is case insensitive', () => {
      expect(getPoolManagerAddress('MAINNET')).toBe(SUNSWAP_V4_MAINNET_POOL_MANAGER)
      expect(getPoolManagerAddress('NILE')).toBe(SUNSWAP_V4_NILE_POOL_MANAGER)
    })

    it('throws for unsupported network', () => {
      expect(() => getPoolManagerAddress('bsc')).toThrow(/Unsupported network/)
    })
  })

  describe('getPermit2Address', () => {
    it('returns mainnet address for mainnet', () => {
      expect(getPermit2Address('mainnet')).toBe(PERMIT2_MAINNET)
    })

    it('returns nile address for nile', () => {
      expect(getPermit2Address('nile')).toBe(PERMIT2_NILE)
    })

    it('throws for unsupported network', () => {
      expect(() => getPermit2Address('bsc')).toThrow(/Unsupported network/)
    })
  })

  describe('price helpers', () => {
    it('priceToSqrtPriceX96 converts price correctly', () => {
      const sqrtPrice = priceToSqrtPriceX96(1)
      expect(BigInt(sqrtPrice)).toBeGreaterThan(0n)
    })

    it('priceToSqrtPriceX96 throws for non-positive price', () => {
      expect(() => priceToSqrtPriceX96(0)).toThrow('Price must be positive')
      expect(() => priceToSqrtPriceX96(-1)).toThrow('Price must be positive')
    })

    it('sqrtPriceX96ToPrice converts back correctly', () => {
      const price = 1.5
      const sqrtPrice = priceToSqrtPriceX96(price)
      const convertedBack = sqrtPriceX96ToPrice(sqrtPrice)
      expect(convertedBack).toBeCloseTo(price, 5)
    })
  })

  describe('FEE_TICK_SPACING mapping', () => {
    it('has correct tick spacing for fee 100', () => {
      expect(FEE_TICK_SPACING[100]).toBe(1)
    })

    it('has correct tick spacing for fee 500', () => {
      expect(FEE_TICK_SPACING[500]).toBe(10)
    })

    it('has correct tick spacing for fee 3000', () => {
      expect(FEE_TICK_SPACING[3000]).toBe(60)
    })

    it('has correct tick spacing for fee 10000', () => {
      expect(FEE_TICK_SPACING[10000]).toBe(200)
    })

    it('returns undefined for unknown fee', () => {
      expect(FEE_TICK_SPACING[999]).toBeUndefined()
    })
  })
})
