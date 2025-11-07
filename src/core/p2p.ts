import type { Address, PublicClient } from 'viem'

import { p2pSuperformProxyFactoryAbi } from '../utils/abis'
import type { FeeConfig } from './types'

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
  const url = new URL(apiUrl)
  url.searchParams.set('client', client)

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch P2P fee config: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as Partial<FeeConfig>

  if (
    typeof payload.clientBasisPointsOfDeposit !== 'number' ||
    typeof payload.clientBasisPointsOfProfit !== 'number'
  ) {
    throw new Error('P2P fee config payload is missing required fields')
  }

  return {
    clientBasisPointsOfDeposit: payload.clientBasisPointsOfDeposit,
    clientBasisPointsOfProfit: payload.clientBasisPointsOfProfit
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

