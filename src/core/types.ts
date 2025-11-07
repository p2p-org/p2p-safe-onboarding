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

export interface OnboardingConfig extends WalletContext {
  p2pApiUrl: string
  p2pApiToken?: string
  p2pAddress: Address
  p2pSuperformProxyFactoryAddress: Address
  rolesMasterCopyAddress: Address
  rolesIntegrityLibraryAddress: Address
  rolesPackerLibraryAddress: Address
  safeSingletonAddress: Address
  safeProxyFactoryAddress: Address
  safeMultiSendCallOnlyAddress?: Address
  chainId?: number
  feeConfigFetcher?: (params: { client: Address }) => Promise<FeeConfig>
  safeSaltNonce?: bigint
  rolesSaltNonce?: bigint
}

export interface OnboardClientParams {
  clientAddress?: Address
}

export interface DeploymentResult {
  safeAddress: Address
  rolesAddress: Address
  predictedProxyAddress: Address
  roleKey: Hex
  transactions: {
    safeDeploymentHash: Hex
    rolesDeploymentHash: Hex
    safeModuleEnableHash: Hex
    roleConfigurationHashes: Hex[]
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

