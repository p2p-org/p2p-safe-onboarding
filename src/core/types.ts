import type {
  Account,
  Address,
  Chain,
  Hex,
  PublicClient,
  Transport,
  WalletClient
} from 'viem'

export interface WalletContext<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined
> {
  walletClient: WalletClient<TTransport, TChain, TAccount>
  publicClient: PublicClient<TTransport, TChain>
}

export interface FeeConfig {
  clientBasisPointsOfDeposit: number
  clientBasisPointsOfProfit: number
}

export enum SafeTransactionOperation {
  Call = 0,
  DelegateCall = 1
}

export interface SafeContractCall {
  to: Address
  value?: bigint
  data: Hex
  operation?: SafeTransactionOperation
}

export interface TokenTransfer {
  address: Address
  amount: bigint | number | string
}

export interface TransferAssetFromCallerToSafeParams {
  safeAddress?: Address
  assetAddress: Address
  amount: bigint | number | string
}

export interface TransferAssetFromSafeToOwnerParams {
  safeAddress?: Address
  assetAddress: Address
  amount: bigint | number | string
  ownerAddress?: Address
}

export interface DeploySafeParams {
  clientAddress?: Address
}

export interface DeploySafeResult {
  safeAddress: Address
  transactionHash: Hex
  multiSendCallOnly?: Address
}

export interface SetPermissionsParams {
  safeAddress?: Address
  clientAddress?: Address
  multiSendCallOnlyAddress?: Address
}

export interface SetPermissionsResult {
  rolesAddress: Address
  predictedProxyAddress: Address
  roleKey: Hex
  transactionHash: Hex
}

export interface TransferAssetParams extends TokenTransfer {
  safeAddress?: Address
}

export interface TransferAssetResult {
  transactionHash: Hex
}

export interface OnboardingConfig extends WalletContext {
  p2pApiUrl?: string
  p2pApiToken?: string
  p2pAddress?: Address
  p2pSuperformProxyFactoryAddress?: Address
  rolesMasterCopyAddress?: Address
  rolesIntegrityLibraryAddress?: Address
  rolesPackerLibraryAddress?: Address
  safeSingletonAddress?: Address
  safeProxyFactoryAddress?: Address
  safeMultiSendCallOnlyAddress?: Address
  chainId?: number
  feeConfigFetcher?: (params: { client: Address }) => Promise<FeeConfig>
  safeSaltNonce?: bigint
  rolesSaltNonce?: bigint
  logger?: (message: string) => void
}

export interface OnboardClientParams {
  clientAddress?: Address
  tokenTransfers?: TokenTransfer[]
}

export interface DeploymentResult {
  safeAddress: Address
  rolesAddress: Address
  predictedProxyAddress: Address
  roleKey: Hex
  transactions: {
    safeDeployment: Hex
    rolesSetup: Hex
    assetTransfers?: Hex[]
  }
}

export interface PreparedSafeTransaction {
  to: Address
  value: bigint
  data: Hex
  operation: number
  safeTxGas: bigint
  baseGas: bigint
  gasPrice: bigint
  gasToken: Address
  refundReceiver: Address
  nonce: bigint
  hash: Hex
}

export interface NonceManager {
  consumeNonce: () => number
  peekNonce: () => number
}
