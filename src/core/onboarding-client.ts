import { Address, Hex, encodeFunctionData, keccak256, stringToHex } from 'viem'

import {
  deploySafe as deploySafeContract,
  executeSafeTransaction,
  prepareSafeTransaction
} from './safe'
import { prepareRolesModuleDeployment, prepareRolesPermissions } from './roles'
import { fetchFeeConfig, predictP2pProxyAddress } from './p2p'
import type {
  DeploymentResult,
  DeploySafeParams,
  DeploySafeResult,
  FeeConfig,
  OnboardClientParams,
  OnboardingConfig,
  SafeContractCall,
  SetPermissionsParams,
  SetPermissionsResult,
  TokenTransfer,
  TransferAssetParams,
  TransferAssetResult
} from './types'
import { SafeTransactionOperation } from './types'
import { erc20Abi, multiSendCallOnlyAbi, safeAbi } from '../utils/abis'
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
  private lastSafeAddress?: Address
  private lastMultiSendCallOnly?: Address

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

  private normalizeTokenAmount(amount: TokenTransfer['amount']): bigint {
    if (typeof amount === 'bigint') {
      return amount
    }
    if (typeof amount === 'number') {
      if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
        throw new Error('Token transfer amount must be an integer')
      }
      if (!Number.isSafeInteger(amount)) {
        this.log(
          '⚠️  Token transfer amount exceeds JS safe integer range; supply a string or bigint for exact precision'
        )
      }
      return BigInt(amount)
    }
    if (typeof amount === 'string') {
      const normalized = amount.trim()
      if (!normalized) {
        throw new Error('Token transfer amount cannot be empty')
      }
      if (!/^(0x)?[0-9a-fA-F]+$/.test(normalized)) {
        throw new Error('Token transfer amount must be a numeric string')
      }
      return BigInt(normalized)
    }
    throw new Error('Token transfer amount must be a bigint, number, or numeric string')
  }

  async deploySafe(params: DeploySafeParams = {}): Promise<DeploySafeResult> {
    const account = this.config.walletClient.account
    if (!account) {
      throw new Error('Wallet client must have an active account')
    }

    const clientAddress = params.clientAddress ?? (account.address as Address)
    this.log(`➡️  Deploying Safe for owner ${clientAddress}`)

    const result = await deploySafeContract({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      ownerAddress: clientAddress,
      saltNonce: this.config.safeSaltNonce,
      singletonAddress: this.config.safeSingletonAddress,
      factoryAddress: this.config.safeProxyFactoryAddress,
      multiSendAddress: this.config.safeMultiSendCallOnlyAddress,
      logger: this.log
    })

    this.lastSafeAddress = result.safeAddress
    this.lastMultiSendCallOnly = result.multiSendCallOnly
    this.log(`✅  Safe deployed at ${result.safeAddress}`)

    return {
      safeAddress: result.safeAddress,
      transactionHash: result.transactionHash,
      multiSendCallOnly: result.multiSendCallOnly
    }
  }

  async setPermissions(params: SetPermissionsParams = {}): Promise<SetPermissionsResult> {
    const account = this.config.walletClient.account
    if (!account) {
      throw new Error('Wallet client must have an active account')
    }

    const safeAddress = params.safeAddress ?? this.lastSafeAddress
    if (!safeAddress) {
      throw new Error('Safe address is required; call deploySafe() first or provide safeAddress')
    }
    this.lastSafeAddress = safeAddress

    const clientAddress = params.clientAddress ?? (account.address as Address)
    const multiSendCallOnly =
      params.multiSendCallOnlyAddress ??
      this.lastMultiSendCallOnly ??
      this.config.safeMultiSendCallOnlyAddress

    if (!multiSendCallOnly) {
      throw new Error('Could not resolve MultiSendCallOnly address for Safe transaction batching')
    }

    this.log(`➡️  Configuring Roles for Safe ${safeAddress}`)

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

    const transactionHash = await executeSafeTransaction({
      walletClient: this.config.walletClient,
      publicClient: this.config.publicClient,
      safeAddress,
      transaction: preparedTx
    })
    this.log(`✅  Roles deployment, permissions & enablement executed via Safe tx ${transactionHash}`)

    return {
      rolesAddress,
      predictedProxyAddress,
      roleKey,
      transactionHash
    }
  }

  async transferAsset(params: TransferAssetParams): Promise<TransferAssetResult> {
    const account = this.config.walletClient.account
    if (!account) {
      throw new Error('Wallet client must have an active account')
    }

    const safeAddress = params.safeAddress ?? this.lastSafeAddress
    if (!safeAddress) {
      throw new Error('Safe address is required; call deploySafe() first or provide safeAddress')
    }

    const amount = this.normalizeTokenAmount(params.amount)
    this.log(`➡️  Transferring token ${params.address} -> Safe ${safeAddress} amount=${amount}`)

    const transactionHash = await this.config.walletClient.writeContract({
      address: params.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [safeAddress, amount],
      account,
      chain: this.config.walletClient.chain
    })

    await this.config.publicClient.waitForTransactionReceipt({ hash: transactionHash })
    this.log(`✅  Transfer confirmed: ${transactionHash}`)

    return { transactionHash }
  }

  async onboardClient(
    paramsOrTokenTransfers: OnboardClientParams | TokenTransfer[] = {}
  ): Promise<DeploymentResult> {
    const params: OnboardClientParams = Array.isArray(paramsOrTokenTransfers)
      ? { tokenTransfers: paramsOrTokenTransfers }
      : paramsOrTokenTransfers ?? {}

    const { safeAddress, transactionHash: safeDeployment, multiSendCallOnly } = await this.deploySafe(
      { clientAddress: params.clientAddress }
    )
    const { rolesAddress, predictedProxyAddress, roleKey, transactionHash: rolesSetup } =
      await this.setPermissions({
        safeAddress,
        clientAddress: params.clientAddress,
        multiSendCallOnlyAddress: multiSendCallOnly
      })

    const assetTransfers: Hex[] = []
    for (const transfer of params.tokenTransfers ?? []) {
      const { transactionHash } = await this.transferAsset({ ...transfer, safeAddress })
      assetTransfers.push(transactionHash)
    }

    const transactions: DeploymentResult['transactions'] = {
      safeDeployment,
      rolesSetup
    }
    if (assetTransfers.length > 0) {
      transactions.assetTransfers = assetTransfers
    }

    return {
      safeAddress,
      rolesAddress,
      predictedProxyAddress,
      roleKey,
      transactions
    }
  }
}
