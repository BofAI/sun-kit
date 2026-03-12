/**
 * Test that contracts.ts properly handles tuple expansion and address conversion.
 */

// --- Mock TronWeb instance ---
const mockTriggerSmartContract = jest.fn(async () => ({
  transaction: { txID: 'unsigned_001', raw_data: {} },
}))
const mockTriggerConfirmedConstantContract = jest.fn(async () => ({
  constant_result: ['0000000000000000000000000000000000000000000000000000000000000064'],
}))
const mockContractAt = jest.fn(async () => ({
  abi: [
    {
      type: 'function',
      name: 'approve',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
  ],
  methods: {},
}))

const mockTronWeb: any = {
  defaultAddress: { base58: 'T_MOCK_ISSUER', hex: '41_mock_hex' },
  address: {
    toHex: jest.fn((addr: string) => `41_hex_${addr}`),
    fromHex: jest.fn((hex: string) => `base58_${hex}`),
  },
  transactionBuilder: {
    triggerSmartContract: mockTriggerSmartContract,
    triggerConfirmedConstantContract: mockTriggerConfirmedConstantContract,
  },
  contract: jest.fn((...args: any[]) => {
    if (args.length >= 2) {
      return { abi: args[0], methods: {} }
    }
    return { at: mockContractAt }
  }),
}

// Mock TronWeb module
jest.mock('tronweb', () => {
  return {
    TronWeb: Object.assign(
      function TronWebMock() {
        return mockTronWeb
      },
      { address: { fromPrivateKey: jest.fn() } },
    ),
  }
})

// Mock createReadonlyTronWeb
jest.mock('../src/kit/tronweb', () => ({
  createReadonlyTronWeb: jest.fn(async () => mockTronWeb),
}))

// --- Tests ---

import { buildUnsignedContractTx, readConstantContractSolidity } from '../src/kit/contracts'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('buildUnsignedContractTx', () => {
  it('expands tuple types correctly', async () => {
    const tupleAbi = [
      {
        type: 'function',
        name: 'mint',
        inputs: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'token0', type: 'address' },
              { name: 'token1', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickLower', type: 'int24' },
              { name: 'tickUpper', type: 'int24' },
              { name: 'amount0Desired', type: 'uint256' },
              { name: 'amount1Desired', type: 'uint256' },
              { name: 'amount0Min', type: 'uint256' },
              { name: 'amount1Min', type: 'uint256' },
              { name: 'recipient', type: 'address' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
        ],
      },
    ]

    const params = {
      address: 'TContractAddr',
      functionName: 'mint',
      args: [
        [
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
        ],
      ],
      abi: tupleAbi,
    }

    await buildUnsignedContractTx(mockTronWeb, params)

    expect(mockTriggerSmartContract).toHaveBeenCalled()
    const callArgs = mockTriggerSmartContract.mock.calls[0] as unknown[]
    const functionSelector = callArgs[1] as string

    // Should be expanded tuple format, not just 'tuple'
    expect(functionSelector).toBe(
      'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))',
    )
    expect(functionSelector).not.toContain('tuple')
  })

  it('handles simple types without expansion', async () => {
    const simpleAbi = [
      {
        type: 'function',
        name: 'approve',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ]

    const params = {
      address: 'TContractAddr',
      functionName: 'approve',
      args: ['TSpender', '1000'],
      abi: simpleAbi,
    }

    await buildUnsignedContractTx(mockTronWeb, params)

    const callArgs = mockTriggerSmartContract.mock.calls[0] as unknown[]
    const functionSelector = callArgs[1] as string

    expect(functionSelector).toBe('approve(address,uint256)')
  })

  it('handles tuple[] array types', async () => {
    const tupleArrayAbi = [
      {
        type: 'function',
        name: 'batchTransfer',
        inputs: [
          {
            name: 'transfers',
            type: 'tuple[]',
            components: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
        ],
      },
    ]

    const params = {
      address: 'TContractAddr',
      functionName: 'batchTransfer',
      args: [[['TAddr1', '100'], ['TAddr2', '200']]],
      abi: tupleArrayAbi,
    }

    await buildUnsignedContractTx(mockTronWeb, params)

    const callArgs = mockTriggerSmartContract.mock.calls[0] as unknown[]
    const functionSelector = callArgs[1] as string

    expect(functionSelector).toBe('batchTransfer((address,uint256)[])')
  })
})

describe('readConstantContractSolidity', () => {
  it('returns constant_result from solidity node call', async () => {
    const result = await readConstantContractSolidity(
      mockTronWeb,
      'TTokenAddr',
      'allowance(address,address)',
      [
        { type: 'address', value: 'TOwner' },
        { type: 'address', value: 'TSpender' },
      ],
      '41_hex_owner',
    )

    expect(mockTriggerConfirmedConstantContract).toHaveBeenCalledWith(
      'TTokenAddr',
      'allowance(address,address)',
      { callValue: 0, feeLimit: 100_000_000 },
      [
        { type: 'address', value: 'TOwner' },
        { type: 'address', value: 'TSpender' },
      ],
      '41_hex_owner',
    )
    expect(result).toEqual([
      '0000000000000000000000000000000000000000000000000000000000000064',
    ])
  })

  it('throws when constant_result is missing', async () => {
    mockTriggerConfirmedConstantContract.mockResolvedValueOnce({} as any)

    await expect(
      readConstantContractSolidity(
        mockTronWeb,
        'TTokenAddr',
        'allowance(address,address)',
        [],
        '41_hex',
      ),
    ).rejects.toThrow(/no constant_result/)
  })
})
