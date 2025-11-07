import type { Address, Chain } from 'viem'

import { OnboardingClient } from './core/onboarding-client'
import type { DeploymentResult, OnboardingConfig, OnboardClientParams } from './core/types'
import { loadEnv } from './config/env'
import { createClientsFromPrivateKey } from './adapters'
import * as constants from './constants'

export { OnboardingClient, loadEnv, createClientsFromPrivateKey, constants }
export type { DeploymentResult, OnboardingConfig, OnboardClientParams }

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
    p2pApiUrl: env.P2P_API_URL,
    p2pApiToken: env.P2P_API_TOKEN,
    p2pAddress: env.P2P_ADDRESS as Address,
    p2pSuperformProxyFactoryAddress: env.P2P_SUPERFORM_PROXY_FACTORY_ADDRESS as Address,
    rolesMasterCopyAddress: env.ROLES_MASTER_COPY_ADDRESS as Address,
    rolesIntegrityLibraryAddress: env.ROLES_INTEGRITY_LIBRARY_ADDRESS as Address,
    rolesPackerLibraryAddress: env.ROLES_PACKER_LIBRARY_ADDRESS as Address,
    safeSingletonAddress: env.SAFE_SINGLETON_ADDRESS as Address,
    safeProxyFactoryAddress: env.SAFE_PROXY_FACTORY_ADDRESS as Address,
    safeMultiSendCallOnlyAddress: env.SAFE_MULTI_SEND_CALL_ONLY_ADDRESS as Address
  })
}

