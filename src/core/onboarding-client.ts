import { Address, Hex, encodeFunctionData, keccak256, stringToHex } from 'viem'

import { deploySafe, executeSafeTransaction, prepareSafeTransaction } from './safe'
import { prepareRolesModuleDeployment, prepareRolesPermissions } from './roles'
import { fetchFeeConfig, predictP2pProxyAddress } from './p2p'
import type {
  DeploymentResult,
  FeeConfig,
  NonceManager,
  OnboardClientParams,
  OnboardingConfig,
  SafeContractCall
} from './types'
import { SafeTransactionOperation } from './types'
import { safeAbi, multiSendCallOnlyAbi } from '../utils/abis'
import { encodeMultiSendCallData } from '../utils/multisend'
import * as constants from '../constants'

const DEFAULT_ROLE_KEY = keccak256(stringToHex('P2P_SUPERFORM_ROLE')) as Hex

export class OnboardingClient {
  private readonly config: Required<
    Pick<
      OnboardingConfig,
      | 'p2pApiUrl'
      | 'p2pAddress'
      | 'p2pSuperformProxyFactoryAddress'
      | 'rolesMasterCopyAddress'
      | 'rolesIntegrityLibraryAddress'
      | 'rolesPackerLibraryAddress'
      | 'safeSingletonAddress'
      | 'safeProxyFactoryAddress'
      | 'safeMultiSendCallOnlyAddress'
    >
  > &
    OnboardingConfig
  private readonly log: (message: string) => void

  constructor(config: OnboardingConfig) {
    this.config = {
      ...config,
      p2pApiUrl: config.p2pApiUrl ?? constants.P2P_API_URL,
      p2pAddress: config.p2pAddress ?? constants.P2P_ADDRESS,
      p2pSuperformProxyFactoryAddress:
        config.p2pSuperformProxyFactoryAddress ?? constants.P2P_SUPERFORM_PROXY_FACTORY_ADDRESS,
      rolesMasterCopyAddress: config.rolesMasterCopyAddress ?? constants.ROLES_MASTER_COPY_ADDRESS,
      rolesIntegrityLibraryAddress:
        config.rolesIntegrityLibraryAddress ?? constants.ROLES_INTEGRITY_LIBRARY_ADDRESS,
      rolesPackerLibraryAddress:
        config.rolesPackerLibraryAddress ?? constants.ROLES_PACKER_LIBRARY_ADDRESS,
      safeSingletonAddress: config.safeSingletonAddress ?? constants.SAFE_SINGLETON_ADDRESS,
      safeProxyFactoryAddress: config.safeProxyFactoryAddress ?? constants.SAFE_PROXY_FACTORY_ADDRESS,
      safeMultiSendCallOnlyAddress:
        config.safeMultiSendCallOnlyAddress ?? constants.SAFE_MULTI_SEND_CALL_ONLY_ADDRESS
    }
    this.log = this.config.logger ?? ((message: string) => console.info(message))
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
    this.log(`➡️  Onboarding client ${clientAddress}`)

    let nextNonce = await this.config.publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending'
    })
    const nonceManager: NonceManager = {
      consumeNonce: () => {
        const current = nextNonce
        nextNonce += 1
        return current
      },
      peekNonce: () => nextNonce
    }

    const { safeAddress, transactionHash: safeDeploymentHash, multiSendCallOnly } = await deploySafe({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      ownerAddress: clientAddress,
      saltNonce: this.config.safeSaltNonce,
      singletonAddress: this.config.safeSingletonAddress,
      factoryAddress: this.config.safeProxyFactoryAddress,
      multiSendAddress: this.config.safeMultiSendCallOnlyAddress,
      logger: this.log,
      nonceManager
    })
    this.log(`✅  Safe deployed at ${safeAddress}`)

    if (!multiSendCallOnly) {
      throw new Error('Could not resolve MultiSendCallOnly address for Safe transaction batching')
    }

    const {
      rolesAddress,
      deploymentCall,
      saltNonce: rolesSaltNonce
    } = prepareRolesModuleDeployment({
      masterCopy: this.config.rolesMasterCopyAddress,
      ownerAddress: safeAddress,
      safeAddress,
      saltNonce: this.config.rolesSaltNonce,
      logger: this.log
    })
    this.log(`✅  Roles deployment prepared (saltNonce=${rolesSaltNonce}) -> ${rolesAddress}`)

    const feeConfig = await this.resolveFeeConfig(clientAddress)
    this.log(
      `ℹ️  Using fee configuration deposit=${feeConfig.clientBasisPointsOfDeposit}bps profit=${feeConfig.clientBasisPointsOfProfit}bps`
    )

    const predictedProxyAddress = await predictP2pProxyAddress({
      publicClient: this.config.publicClient,
      factoryAddress: this.config.p2pSuperformProxyFactoryAddress,
      client: safeAddress,
      depositBps: feeConfig.clientBasisPointsOfDeposit,
      profitBps: feeConfig.clientBasisPointsOfProfit
    })
    this.log(`ℹ️  Predicted P2P Superform proxy ${predictedProxyAddress}`)

    const roleKey = DEFAULT_ROLE_KEY as Hex

    const permissionCalls = prepareRolesPermissions({
      rolesAddress,
      roleKey,
      p2pModuleAddress: this.config.p2pAddress,
      factoryAddress: this.config.p2pSuperformProxyFactoryAddress,
      predictedProxyAddress,
      logger: this.log
    })

    const enableModuleCall: SafeContractCall = {
      to: safeAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: safeAbi,
        functionName: 'enableModule',
        args: [rolesAddress]
      }),
      operation: SafeTransactionOperation.Call
    }

    const batchedCalls = [deploymentCall, ...permissionCalls, enableModuleCall]
    const encodedTransactions = encodeMultiSendCallData(batchedCalls)
    const multiSendData = encodeFunctionData({
      abi: multiSendCallOnlyAbi,
      functionName: 'multiSend',
      args: [encodedTransactions]
    })

    this.log(
      `➡️  Executing batched Roles setup via MultiSendCallOnly ${multiSendCallOnly} (${batchedCalls.length} calls)`
    )

    const preparedTx = await prepareSafeTransaction({
      publicClient: this.config.publicClient,
      safeAddress,
      to: multiSendCallOnly,
      data: multiSendData,
      value: 0n,
      operation: SafeTransactionOperation.DelegateCall
    })

    const rolesSetupHash = await executeSafeTransaction({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      safeAddress,
      transaction: preparedTx,
      nonceManager
    })
    this.log(`✅  Roles deployment, permissions & enablement executed via Safe tx ${rolesSetupHash}`)

    return {
      safeAddress,
      rolesAddress,
      predictedProxyAddress,
      roleKey,
      transactions: {
        safeDeployment: safeDeploymentHash,
        rolesSetup: rolesSetupHash
      }
    }
  }
}

