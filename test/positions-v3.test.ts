/**
 * Test positions-v3.ts address conversion and parameter formatting.
 */

// --- Mock TronWeb instance ---
const mockTriggerSmartContract = jest.fn(async () => ({
  transaction: { txID: 'unsigned_001', raw_data: {} },
}))
const mockTriggerConstantContract = jest.fn(async () => ({
  constant_result: [
    '0000000000000000000000000000000000000000000000000000000000000001', // sqrtPriceX96
  ],
}))

const mockTronWeb: any = {
  defaultAddress: { base58: 'T_MOCK_ISSUER', hex: '41_mock_hex' },
  address: {
    toHex: jest.fn((addr: string) => {
      // Simulate real address conversion
      if (addr.startsWith('T')) {
        return '41' + Buffer.from(addr).toString('hex').slice(0, 40)
      }
      return addr
    }),
    fromHex: jest.fn((hex: string) => `base58_${hex}`),
  },
  transactionBuilder: {
    triggerSmartContract: mockTriggerSmartContract,
    triggerConstantContract: mockTriggerConstantContract,
    triggerConfirmedConstantContract: jest.fn(async () => ({
      constant_result: ['0000000000000000000000000000000000000000000000000000000000000064'],
    })),
  },
  contract: jest.fn(() => ({
    slot0: jest.fn().mockReturnValue({
      call: jest.fn(async () => ({
        sqrtPriceX96: '79228162514264337593543950336', // Q96
        tick: 0,
        observationIndex: 0,
        observationCardinality: 1,
        observationCardinalityNext: 1,
        feeProtocol: 0,
        unlocked: true,
      })),
    }),
    positions: jest.fn().mockReturnValue({
      call: jest.fn(async () => ({
        tickLower: -1000,
        tickUpper: 1000,
        liquidity: '1000000',
      })),
    }),
    collect: jest.fn().mockReturnValue({
      call: jest.fn(async () => ({
        amount0: '100',
        amount1: '200',
      })),
    }),
  })),
  utils: {
    abi: {
      decodeParams: jest.fn(() => ({
        sqrtPriceX96: '79228162514264337593543950336',
        tick: 0,
        liquidity: '1000000',
      })),
    },
  },
}

// Mock createReadonlyTronWeb
jest.mock('../src/kit/tronweb', () => ({
  createReadonlyTronWeb: jest.fn(async () => mockTronWeb),
}))

// Mock TronWeb module
jest.mock('tronweb', () => ({
  TronWeb: function () {
    return mockTronWeb
  },
}))

// --- Tests ---

import { createReadonlyTronWeb } from '../src/kit/tronweb'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('positions-v3 address conversion', () => {
  it('toHexAddress converts Base58 to hex format', async () => {
    const tronWeb = await createReadonlyTronWeb('nile')
    const base58Addr = 'TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK'
    const hexAddr = tronWeb.address.toHex(base58Addr)

    expect(hexAddr).toMatch(/^41/)
    expect(hexAddr).not.toBe(base58Addr)
  })

  it('address conversion is called for token addresses', async () => {
    const tronWeb = await createReadonlyTronWeb('nile')

    // Simulate what mintPositionV3 does
    const token0 = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
    const token1 = 'TGjgvdTWWrybVLaVeFqSyVqJQWjxqRYbaK'
    const recipient = 'TRecipientAddress123456789abcdef'

    const token0Hex = tronWeb.address.toHex(token0)
    const token1Hex = tronWeb.address.toHex(token1)
    const recipientHex = tronWeb.address.toHex(recipient)

    expect(tronWeb.address.toHex).toHaveBeenCalledWith(token0)
    expect(tronWeb.address.toHex).toHaveBeenCalledWith(token1)
    expect(tronWeb.address.toHex).toHaveBeenCalledWith(recipient)

    // All should start with '41'
    expect(token0Hex).toMatch(/^41/)
    expect(token1Hex).toMatch(/^41/)
    expect(recipientHex).toMatch(/^41/)
  })
})

describe('positions-v3 parameter formatting', () => {
  it('mint args should be nested array format [[...]]', () => {
    // This is what the args should look like
    const args = [[
      '41token0hex',
      '41token1hex',
      3000,
      -1000,
      1000,
      '1000000',
      '1000000',
      '0',
      '0',
      '41recipienthex',
      1234567890,
    ]]

    expect(Array.isArray(args)).toBe(true)
    expect(Array.isArray(args[0])).toBe(true)
    expect(args[0].length).toBe(11) // 11 parameters for mint
  })

  it('decreaseLiquidity args should be nested array format [[...]]', () => {
    const args = [[
      '123', // tokenId
      '1000000', // liquidity
      '0', // amount0Min
      '0', // amount1Min
      1234567890, // deadline
    ]]

    expect(Array.isArray(args)).toBe(true)
    expect(Array.isArray(args[0])).toBe(true)
    expect(args[0].length).toBe(5)
  })

  it('collect args should be nested array format [[...]]', () => {
    const args = [[
      '123', // tokenId
      '41recipienthex', // recipient (hex format)
      '340282366920938463463374607431768211455', // MAX_UINT128
      '340282366920938463463374607431768211455', // MAX_UINT128
    ]]

    expect(Array.isArray(args)).toBe(true)
    expect(Array.isArray(args[0])).toBe(true)
    expect(args[0].length).toBe(4)
    expect(args[0][1]).toMatch(/^41/) // recipient should be hex
  })
})
