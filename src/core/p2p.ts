import type { Address, PublicClient } from 'viem'

import { p2pSuperformProxyFactoryAbi } from '../utils/abis'
import type { FeeConfig } from './types'

const FALLBACK_FEE_CONFIG: FeeConfig = {
  clientBasisPointsOfDeposit: 10000,
  clientBasisPointsOfProfit: 9700
}

interface FetchFeeConfigParams {
  apiUrl: string
  client: Address
  apiToken?: string
}

export const fetchFeeConfig = async ({
  apiUrl,
  client,
  apiToken
}: FetchFeeConfigParams): Promise<FeeConfig> => {
  // Temporary fallback while the P2P API is not available.
  if (!apiUrl || apiUrl === 'dummy') {
    return FALLBACK_FEE_CONFIG
  }

  try {
    const url = new URL(apiUrl)
    url.searchParams.set('client', client)

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
      }
    })

    if (!response.ok) {
      return FALLBACK_FEE_CONFIG
    }

    const payload = (await response.json()) as Partial<FeeConfig>

    if (
      typeof payload.clientBasisPointsOfDeposit !== 'number' ||
      typeof payload.clientBasisPointsOfProfit !== 'number'
    ) {
      return FALLBACK_FEE_CONFIG
    }

    return {
      clientBasisPointsOfDeposit: payload.clientBasisPointsOfDeposit,
      clientBasisPointsOfProfit: payload.clientBasisPointsOfProfit
    }
  } catch (error) {
    return FALLBACK_FEE_CONFIG
  }
}

interface PredictProxyParams {
  publicClient: PublicClient
  factoryAddress: Address
  client: Address
  depositBps: number
  profitBps: number
}

export const predictP2pProxyAddress = async ({
  publicClient,
  factoryAddress,
  client,
  depositBps,
  profitBps
}: PredictProxyParams): Promise<Address> => {
  if (depositBps > 10_000 || profitBps > 10_000) {
    throw new Error('Basis points must be <= 10_000')
  }

  const proxyAddress = (await publicClient.readContract({
    address: factoryAddress,
    abi: p2pSuperformProxyFactoryAbi,
    functionName: 'predictP2pYieldProxyAddress',
    args: [client, depositBps, profitBps]
  })) as Address

  return proxyAddress
}

