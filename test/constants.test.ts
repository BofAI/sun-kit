/**
 * Unit tests for constants
 */

import {
  MAINNET,
  NILE,
  SHASTA,
  TRX_ADDRESS,
  WTRX_MAINNET,
  WTRX_NILE,
  SUNSWAP_V2_MAINNET_FACTORY,
  SUNSWAP_V2_MAINNET_ROUTER,
  SUNSWAP_V2_NILE_FACTORY,
  SUNSWAP_V2_NILE_ROUTER,
  SUNSWAP_V3_MAINNET_FACTORY,
  SUNSWAP_V3_MAINNET_POSITION_MANAGER,
  SUNSWAP_V3_NILE_FACTORY,
  SUNSWAP_V3_NILE_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER,
  SUNSWAP_V4_NILE_CL_POSITION_MANAGER,
  SUNSWAP_V4_MAINNET_POOL_MANAGER,
  SUNSWAP_V4_NILE_POOL_MANAGER,
  PERMIT2_MAINNET,
  PERMIT2_NILE,
  SUNPUMP_MAINNET,
  SUNPUMP_NILE,
  TRC20_MIN_ABI,
  SUNSWAP_V2_FACTORY_MIN_ABI,
  SUNSWAP_V2_PAIR_MIN_ABI,
  SUNSWAP_V3_POSITION_MANAGER_MIN_ABI,
  SUNSWAP_V3_COLLECT_VIEW_ABI,
  SUNSWAP_V4_CL_POSITION_MANAGER_MIN_ABI,
  SUNPUMP_ABI,
} from '../src/constants'

describe('constants', () => {
  describe('network constants', () => {
    it('MAINNET has required fields', () => {
      expect(MAINNET.universalRouter).toBeTruthy()
      expect(MAINNET.permit2).toBeTruthy()
      expect(MAINNET.routerApiUrl).toBeTruthy()
      expect(MAINNET.trx).toBeTruthy()
    })

    it('NILE has required fields', () => {
      expect(NILE.universalRouter).toBeTruthy()
      expect(NILE.permit2).toBeTruthy()
      expect(NILE.routerApiUrl).toBeTruthy()
      expect(NILE.trx).toBeTruthy()
    })

    it('SHASTA has required fields', () => {
      expect(SHASTA.trx).toBeTruthy()
    })
  })

  describe('address constants', () => {
    const tronAddressPattern = /^T[A-Za-z0-9]{33}$/

    it('TRX_ADDRESS is valid TRON format', () => {
      expect(TRX_ADDRESS).toMatch(tronAddressPattern)
    })

    it('WTRX addresses are valid TRON format', () => {
      expect(WTRX_MAINNET).toMatch(tronAddressPattern)
      expect(WTRX_NILE).toMatch(tronAddressPattern)
    })

    it('V2 addresses are valid TRON format', () => {
      expect(SUNSWAP_V2_MAINNET_FACTORY).toMatch(tronAddressPattern)
      expect(SUNSWAP_V2_MAINNET_ROUTER).toMatch(tronAddressPattern)
      expect(SUNSWAP_V2_NILE_FACTORY).toMatch(tronAddressPattern)
      expect(SUNSWAP_V2_NILE_ROUTER).toMatch(tronAddressPattern)
    })

    it('V3 addresses are valid TRON format', () => {
      expect(SUNSWAP_V3_MAINNET_FACTORY).toMatch(tronAddressPattern)
      expect(SUNSWAP_V3_MAINNET_POSITION_MANAGER).toMatch(tronAddressPattern)
      expect(SUNSWAP_V3_NILE_FACTORY).toMatch(tronAddressPattern)
      expect(SUNSWAP_V3_NILE_POSITION_MANAGER).toMatch(tronAddressPattern)
    })

    it('V4 addresses are valid TRON format', () => {
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).toMatch(tronAddressPattern)
      expect(SUNSWAP_V4_NILE_CL_POSITION_MANAGER).toMatch(tronAddressPattern)
      expect(SUNSWAP_V4_MAINNET_POOL_MANAGER).toMatch(tronAddressPattern)
      expect(SUNSWAP_V4_NILE_POOL_MANAGER).toMatch(tronAddressPattern)
    })

    it('Permit2 addresses are valid TRON format', () => {
      expect(PERMIT2_MAINNET).toMatch(tronAddressPattern)
      expect(PERMIT2_NILE).toMatch(tronAddressPattern)
    })

    it('SunPump addresses are valid TRON format', () => {
      expect(SUNPUMP_MAINNET).toMatch(tronAddressPattern)
      expect(SUNPUMP_NILE).toMatch(tronAddressPattern)
    })

    it('mainnet and testnet addresses are different', () => {
      expect(SUNSWAP_V3_MAINNET_POSITION_MANAGER).not.toBe(SUNSWAP_V3_NILE_POSITION_MANAGER)
      expect(SUNSWAP_V4_MAINNET_CL_POSITION_MANAGER).not.toBe(SUNSWAP_V4_NILE_CL_POSITION_MANAGER)
      expect(PERMIT2_MAINNET).not.toBe(PERMIT2_NILE)
      expect(SUNPUMP_MAINNET).not.toBe(SUNPUMP_NILE)
    })
  })

  describe('ABI constants', () => {
    it('TRC20_MIN_ABI has required functions', () => {
      const functionNames = TRC20_MIN_ABI.map((entry) => entry.name)
      expect(functionNames).toContain('allowance')
      expect(functionNames).toContain('balanceOf')
      expect(functionNames).toContain('approve')
      expect(functionNames).toContain('transfer')
    })

    it('SUNSWAP_V2_FACTORY_MIN_ABI has getPair', () => {
      const functionNames = SUNSWAP_V2_FACTORY_MIN_ABI.map((entry) => entry.name)
      expect(functionNames).toContain('getPair')
    })

    it('SUNSWAP_V2_PAIR_MIN_ABI has required functions', () => {
      const functionNames = SUNSWAP_V2_PAIR_MIN_ABI.map((entry) => entry.name)
      expect(functionNames).toContain('getReserves')
      expect(functionNames).toContain('token0')
      expect(functionNames).toContain('token1')
      expect(functionNames).toContain('totalSupply')
    })

    it('SUNSWAP_V3_POSITION_MANAGER_MIN_ABI has required functions', () => {
      const functionNames = SUNSWAP_V3_POSITION_MANAGER_MIN_ABI.map((entry) => entry.name)
      expect(functionNames).toContain('mint')
      expect(functionNames).toContain('increaseLiquidity')
      expect(functionNames).toContain('decreaseLiquidity')
      expect(functionNames).toContain('collect')
      expect(functionNames).toContain('positions')
    })

    it('SUNSWAP_V4_CL_POSITION_MANAGER_MIN_ABI has required functions', () => {
      const functionNames = SUNSWAP_V4_CL_POSITION_MANAGER_MIN_ABI.map((entry) => entry.name)
      expect(functionNames).toContain('modifyLiquidities')
      expect(functionNames).toContain('getPoolAndPositionInfo')
      expect(functionNames).toContain('getPositionLiquidity')
    })

    it('SUNPUMP_ABI has required functions', () => {
      const functionNames = SUNPUMP_ABI.map((entry) => entry.name)
      expect(functionNames).toContain('purchaseToken')
      expect(functionNames).toContain('saleToken')
      expect(functionNames).toContain('getTokenState')
      expect(functionNames).toContain('getPrice')
      expect(functionNames).toContain('virtualPools')
    })

    it('V3 mint ABI has tuple components', () => {
      const mintEntry = SUNSWAP_V3_POSITION_MANAGER_MIN_ABI.find((entry) => entry.name === 'mint')
      expect(mintEntry).toBeDefined()
      expect(mintEntry!.inputs[0].type).toBe('tuple')
      const input = mintEntry!.inputs[0] as { type: string; components?: unknown[] }
      expect(input.components).toBeDefined()
      expect(input.components!.length).toBeGreaterThan(0)
    })

    it('V3 collect ABI has payable version for transactions', () => {
      const collectEntry = SUNSWAP_V3_POSITION_MANAGER_MIN_ABI.find((entry) => entry.name === 'collect')
      expect(collectEntry).toBeDefined()
      expect((collectEntry as any).stateMutability).toBe('payable')
    })

    it('V3 collect view ABI has view version for static calls', () => {
      const collectEntry = SUNSWAP_V3_COLLECT_VIEW_ABI.find((entry) => entry.name === 'collect')
      expect(collectEntry).toBeDefined()
      expect((collectEntry as any).stateMutability).toBe('view')
      expect(collectEntry!.inputs[0].type).toBe('tuple')
      const input = collectEntry!.inputs[0] as { type: string; components?: unknown[] }
      expect(input.components).toBeDefined()
      expect(input.components!.length).toBe(4)
    })
  })
})
