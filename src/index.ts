import type { Chain } from 'viem'

import { OnboardingClient } from './core/onboarding-client'
import type {
  DeploymentResult,
  DeploySafeParams,
  DeploySafeResult,
  OnboardingConfig,
  OnboardClientParams,
  SetPermissionsParams,
  SetPermissionsResult,
  TokenTransfer
} from './core/types'
import type { TransferAssetParams, TransferAssetResult } from './core/types'
import { loadEnv } from './config/env'
import { createClientsFromPrivateKey } from './adapters'
import * as constants from './constants'

export { OnboardingClient, loadEnv, createClientsFromPrivateKey, constants }
export type {
  DeploymentResult,
  DeploySafeParams,
  DeploySafeResult,
  OnboardingConfig,
  OnboardClientParams,
  SetPermissionsParams,
  SetPermissionsResult,
  TokenTransfer,
  TransferAssetParams,
  TransferAssetResult
}

export const createOnboardingClientFromEnv = (params: {
  chain: Chain
  batchRpc?: boolean
}) => {
  const env = loadEnv()

  if (!env.RPC_URL) {
    throw new Error('RPC_URL must be defined to create clients from environment')
  }
  if (!env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY must be defined to create clients from environment')
  }

  const { publicClient, walletClient } = createClientsFromPrivateKey({
    rpcUrl: env.RPC_URL,
    privateKey: env.PRIVATE_KEY as `0x${string}`,
    chain: params.chain,
    batch: params.batchRpc
  })

  return new OnboardingClient({
    walletClient,
    publicClient,
    p2pApiToken: env.P2P_API_TOKEN
  })
}
