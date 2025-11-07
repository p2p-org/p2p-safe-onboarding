import { Address, Hex, keccak256, stringToHex } from 'viem'

import {
  deploySafe,
  executeSafeTransaction,
  prepareSafeTransaction
} from './safe'
import { deployRolesModule, configureRolesPermissions } from './roles'
import { fetchFeeConfig, predictP2pProxyAddress } from './p2p'
import type {
  DeploymentResult,
  FeeConfig,
  OnboardClientParams,
  OnboardingConfig
} from './types'
import { safeAbi } from '../utils/abis'
import { encodeFunctionData } from 'viem'

const DEFAULT_ROLE_KEY = keccak256(stringToHex('P2P_SUPERFORM_ROLE')) as Hex

export class OnboardingClient {
  private readonly config: OnboardingConfig

  constructor(config: OnboardingConfig) {
    this.config = config
  }

  private async resolveFeeConfig(client: Address): Promise<FeeConfig> {
    if (this.config.feeConfigFetcher) {
      return this.config.feeConfigFetcher({ client })
    }
    return fetchFeeConfig({
      apiUrl: this.config.p2pApiUrl,
      client,
      apiToken: this.config.p2pApiToken
    })
  }

  async onboardClient(params: OnboardClientParams = {}): Promise<DeploymentResult> {
    const account = this.config.walletClient.account
    if (!account) {
      throw new Error('Wallet client must have an active account')
    }

    const clientAddress = params.clientAddress ?? (account.address as Address)

    const { safeAddress, transactionHash: safeDeploymentHash } = await deploySafe({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      ownerAddress: clientAddress,
      saltNonce: this.config.safeSaltNonce,
      singletonAddress: this.config.safeSingletonAddress,
      factoryAddress: this.config.safeProxyFactoryAddress,
      multiSendAddress: this.config.safeMultiSendCallOnlyAddress
    })

    const { rolesAddress, transactionHash: rolesDeploymentHash } = await deployRolesModule({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      masterCopy: this.config.rolesMasterCopyAddress,
      ownerAddress: clientAddress,
      safeAddress,
      saltNonce: this.config.rolesSaltNonce
    })

    const feeConfig = await this.resolveFeeConfig(clientAddress)

    const predictedProxyAddress = await predictP2pProxyAddress({
      publicClient: this.config.publicClient,
      factoryAddress: this.config.p2pSuperformProxyFactoryAddress,
      client: safeAddress,
      depositBps: feeConfig.clientBasisPointsOfDeposit,
      profitBps: feeConfig.clientBasisPointsOfProfit
    })

    const roleKey = DEFAULT_ROLE_KEY as Hex

    const roleConfigurationHashes = await configureRolesPermissions({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      rolesAddress,
      roleKey,
      p2pModuleAddress: this.config.p2pAddress,
      factoryAddress: this.config.p2pSuperformProxyFactoryAddress,
      predictedProxyAddress
    })

    const enableModuleCalldata = encodeFunctionData({
      abi: safeAbi,
      functionName: 'enableModule',
      args: [rolesAddress]
    })

    const preparedTx = await prepareSafeTransaction({
      publicClient: this.config.publicClient,
      safeAddress,
      to: safeAddress,
      data: enableModuleCalldata,
      value: 0n,
      operation: 0
    })

    const safeModuleEnableHash = await executeSafeTransaction({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      safeAddress,
      transaction: preparedTx
    })

    return {
      safeAddress,
      rolesAddress,
      predictedProxyAddress,
      roleKey,
      transactions: {
        safeDeploymentHash,
        rolesDeploymentHash,
        safeModuleEnableHash,
        roleConfigurationHashes
      }
    }
  }
}

