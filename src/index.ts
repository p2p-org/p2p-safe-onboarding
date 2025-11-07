import type { Address, Chain } from 'viem'
import { getAddress } from 'viem'

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

  const requiredAddress = (value: string | undefined, label: string): Address => {
    if (!value) {
      throw new Error(`${label} must be defined in .env`)
    }
    return toAddress(value, label)
  }

  const toAddress = (value: string, label: string): Address => {
    try {
      return getAddress(value.trim())
    } catch (error) {
      throw new Error(`${label} must be a valid checksummed address`)
    }
  }

  const optionalAddress = (value: string | undefined, label: string): Address | undefined =>
    value ? toAddress(value, label) : undefined

  return new OnboardingClient({
    walletClient,
    publicClient,
    p2pApiUrl: env.P2P_API_URL,
    p2pApiToken: env.P2P_API_TOKEN,
    p2pAddress: requiredAddress(env.P2P_ADDRESS, 'P2P_ADDRESS'),
    p2pSuperformProxyFactoryAddress: requiredAddress(
      env.P2P_SUPERFORM_PROXY_FACTORY_ADDRESS,
      'P2P_SUPERFORM_PROXY_FACTORY_ADDRESS'
    ),
    rolesMasterCopyAddress: requiredAddress(env.ROLES_MASTER_COPY_ADDRESS, 'ROLES_MASTER_COPY_ADDRESS'),
    rolesIntegrityLibraryAddress: requiredAddress(
      env.ROLES_INTEGRITY_LIBRARY_ADDRESS,
      'ROLES_INTEGRITY_LIBRARY_ADDRESS'
    ),
    rolesPackerLibraryAddress: requiredAddress(
      env.ROLES_PACKER_LIBRARY_ADDRESS,
      'ROLES_PACKER_LIBRARY_ADDRESS'
    ),
    safeSingletonAddress: optionalAddress(env.SAFE_SINGLETON_ADDRESS, 'SAFE_SINGLETON_ADDRESS'),
    safeProxyFactoryAddress: optionalAddress(env.SAFE_PROXY_FACTORY_ADDRESS, 'SAFE_PROXY_FACTORY_ADDRESS'),
    safeMultiSendCallOnlyAddress: optionalAddress(
      env.SAFE_MULTI_SEND_CALL_ONLY_ADDRESS,
      'SAFE_MULTI_SEND_CALL_ONLY_ADDRESS'
    )
  })
}

