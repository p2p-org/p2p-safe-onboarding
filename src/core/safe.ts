import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { decodeEventLog, encodeFunctionData, getAddress, padHex, zeroAddress } from 'viem'
import {
  getMultiSendCallOnlyDeployment,
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment
} from '@safe-global/safe-deployments'
import type { SingletonDeployment } from '@safe-global/safe-deployments'

import { safeAbi, safeProxyFactoryAbi } from '../utils/abis'
import {
  isContractFunctionZeroDataError,
  normalizeContractFunctionZeroDataError
} from '../utils/errors'
import type { NonceManager, PreparedSafeTransaction } from './types'

interface DeploySafeParams {
  walletClient: WalletClient
  publicClient: PublicClient
  ownerAddress: Address
  saltNonce?: bigint
  singletonAddress?: Address
  factoryAddress?: Address
  multiSendAddress?: Address
  logger?: (message: string) => void
  nonceManager?: NonceManager
}

interface DeploySafeResult {
  safeAddress: Address
  transactionHash: Hex
  multiSendCallOnly?: Address
}

export const deploySafe = async ({
  walletClient,
  publicClient,
  ownerAddress,
  saltNonce,
  singletonAddress,
  factoryAddress,
  multiSendAddress,
  logger,
  nonceManager
}: DeploySafeParams): Promise<DeploySafeResult> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

  const chainId = walletClient.chain?.id ?? (await walletClient.getChainId())
  const network = chainId.toString()
  const log = logger ?? (() => {})

  const resolveDeploymentAddress = (deployment?: SingletonDeployment) => {
    if (!deployment) {
      return undefined
    }
    const address = deployment.networkAddresses[network] ?? deployment.defaultAddress
    return address ? getAddress(address) : undefined
  }

  const resolvedSingleton =
    singletonAddress
      ? getAddress(singletonAddress)
      :
    resolveDeploymentAddress(
      getSafeL2SingletonDeployment({ network }) ?? getSafeSingletonDeployment({ network }) ?? undefined
    )

  if (!resolvedSingleton) {
    throw new Error(`No Safe singleton deployment found for chain ${chainId}`)
  }

  const resolvedFactory =
    factoryAddress ? getAddress(factoryAddress) : resolveDeploymentAddress(getProxyFactoryDeployment({ network }) ?? undefined)

  if (!resolvedFactory) {
    throw new Error(`No Safe proxy factory deployment found for chain ${chainId}`)
  }

  const resolvedMultiSend =
    multiSendAddress ? getAddress(multiSendAddress) : resolveDeploymentAddress(getMultiSendCallOnlyDeployment({ network }) ?? undefined)

  log(
    `   • Safe deployments resolved (chain ${chainId}) => singleton=${resolvedSingleton}, factory=${resolvedFactory}, multiSend=${resolvedMultiSend ?? 'auto'}`
  )

  const initializer = encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [
      [ownerAddress],
      BigInt(1),
      zeroAddress,
      '0x',
      zeroAddress,
      zeroAddress,
      0n,
      zeroAddress
    ]
  })

  const nonce =
    saltNonce ?? BigInt(Date.now()) << 32n | BigInt(Math.floor(Math.random() * 1e6))

  log(`   • Sending createProxyWithNonce (nonce=${nonce})`)
  const txNonce = nonceManager?.consumeNonce()
  if (typeof txNonce === 'number') {
    log(`     - EOA nonce ${txNonce}`)
  }
  const txHash = await walletClient.writeContract({
    address: resolvedFactory,
    abi: safeProxyFactoryAbi,
    functionName: 'createProxyWithNonce',
    args: [resolvedSingleton, initializer, nonce],
    account,
    chain: walletClient.chain,
    nonce: txNonce
  })
  log(`   • Safe deployment tx hash ${txHash}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  log(`   • Safe deployment receipt status ${receipt.status} contractAddress=${receipt.contractAddress}`)

  let safeAddress: Address | undefined
  const normalizedFactory = resolvedFactory.toLowerCase()

  receipt.logs.forEach((receiptLog, index) => {
    log(
      `     - Inspecting log #${index} address=${receiptLog.address} topic0=${
        receiptLog.topics[0] ?? '0x'
      }`
    )
  })

  for (const receiptLog of receipt.logs) {
    if (receiptLog.address.toLowerCase() !== normalizedFactory) {
      continue
    }
    try {
      const decoded = decodeEventLog({
        abi: safeProxyFactoryAbi,
        data: receiptLog.data,
        topics: receiptLog.topics
      })
      if (decoded.eventName === 'ProxyCreation') {
        const args = decoded.args
        if (typeof args === 'object' && args !== null && 'proxy' in args) {
          safeAddress = args.proxy as Address
        }
        break
      }
    } catch (error) {
      // ignore non-matching logs
    }
  }

  if (!safeAddress) {
    if (receipt.contractAddress) {
      try {
        safeAddress = getAddress(receipt.contractAddress)
      } catch (error) {
        // fall through to throw below
      }
    }
  }

  if (!safeAddress) {
    log(
      `   • ProxyCreation event not found in receipt (logs inspected: ${receipt.logs.length}). Verify SAFE_PROXY_FACTORY_ADDRESS, SAFE_SINGLETON_ADDRESS, and gas sufficiency.`
    )
    throw new Error(
      'Safe proxy creation event not found in transaction receipt. Verify SAFE_PROXY_FACTORY_ADDRESS, SAFE_SINGLETON_ADDRESS, and gas sufficiency.'
    )
  }

  log(`   • Safe proxy address ${safeAddress}`)

  return { safeAddress, transactionHash: txHash, multiSendCallOnly: resolvedMultiSend }
}

interface PrepareSafeTransactionParams {
  publicClient: PublicClient
  safeAddress: Address
  to: Address
  data: Hex
  value?: bigint
  operation?: number
}

export const prepareSafeTransaction = async ({
  publicClient,
  safeAddress,
  to,
  data,
  value = 0n,
  operation = 0
}: PrepareSafeTransactionParams): Promise<PreparedSafeTransaction> => {
  let nonce: bigint | undefined
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      nonce = (await publicClient.readContract({
        address: safeAddress,
        abi: safeAbi,
        functionName: 'nonce'
      })) as bigint
      break
    } catch (error) {
      if (!isContractFunctionZeroDataError(error)) {
        throw error
      }
      if (attempt === 2) {
        throw normalizeContractFunctionZeroDataError(error)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  if (nonce === undefined) {
    throw new Error('Unable to read Safe nonce after retries')
  }

  const safeTxGas = 0n
  const baseGas = 0n
  const gasPrice = 0n
  const gasToken = zeroAddress
  const refundReceiver = zeroAddress

  const hash = await publicClient.readContract({
    address: safeAddress,
    abi: safeAbi,
    functionName: 'getTransactionHash',
    args: [
      to,
      value,
      data,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce
    ]
  })

  return {
    to,
    value,
    data,
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    nonce,
    hash
  }
}

interface ExecuteSafeTransactionParams {
  walletClient: WalletClient
  publicClient: PublicClient
  safeAddress: Address
  transaction: PreparedSafeTransaction
  nonceManager?: NonceManager
}

export const executeSafeTransaction = async ({
  walletClient,
  publicClient,
  safeAddress,
  transaction,
  nonceManager
}: ExecuteSafeTransactionParams): Promise<Hex> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

  const ownerAddress = getAddress(account.address)
  const r = padHex(ownerAddress, { size: 32 })
  const s = padHex('0x', { size: 32 })
  const approvedHashSignature = (`0x${r.slice(2)}${s.slice(2)}01`) as Hex

  const txNonce = nonceManager?.consumeNonce()
  const txHash = await walletClient.writeContract({
    address: safeAddress,
    abi: safeAbi,
    functionName: 'execTransaction',
    args: [
      transaction.to,
      transaction.value,
      transaction.data,
      transaction.operation,
      transaction.safeTxGas,
      transaction.baseGas,
      transaction.gasPrice,
      transaction.gasToken,
      transaction.refundReceiver,
      approvedHashSignature
    ],
    account,
    chain: walletClient.chain,
    nonce: txNonce
  })

  await publicClient.waitForTransactionReceipt({ hash: txHash })

  return txHash
}

