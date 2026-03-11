import type { TronWeb } from 'tronweb'
import { getNetworkConfig } from '../chains'

export async function createReadonlyTronWeb(
  network: string,
  rpcOverride?: string,
  apiKey?: string,
): Promise<TronWeb> {
  const tronwebModule = await import('tronweb')
  const m = tronwebModule as any
  const TronWebCtor =
    m.TronWeb ?? (typeof m.default === 'function' ? m.default : null)
  if (typeof TronWebCtor !== 'function') {
    throw new Error("Unable to load TronWeb constructor from 'tronweb' module")
  }

  const config = getNetworkConfig(network, rpcOverride)

  const tw = new TronWebCtor({
    fullHost: config.fullNode,
    solidityNode: config.solidityNode,
    eventServer: config.eventServer,
    headers: apiKey ? { 'TRON-PRO-API-KEY': apiKey } : undefined,
  }) as TronWeb

  // Constant/view calls require owner_address; use zero address for read-only.
  const zeroHex = '410000000000000000000000000000000000000000'
  const zeroBase58 = (tw as any).address?.fromHex?.(zeroHex) ?? zeroHex
  ;(tw as any).defaultAddress = { hex: zeroHex, base58: zeroBase58 }

  return tw
}
