import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { decodeEventLog, encodeFunctionData, zeroAddress } from 'viem'

import { safeAbi, safeProxyFactoryAbi } from '../utils/abis'
import { normalizeSignature } from '../utils/signature'
import type { PreparedSafeTransaction } from './types'

interface DeploySafeParams {
  walletClient: WalletClient
  publicClient: PublicClient
  ownerAddress: Address
  saltNonce?: bigint
  singletonAddress: Address
  factoryAddress: Address
  multiSendAddress?: Address
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
  multiSendAddress
}: DeploySafeParams): Promise<DeploySafeResult> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

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

  const txHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: safeProxyFactoryAbi,
    functionName: 'createProxyWithNonce',
    args: [singletonAddress, initializer, nonce],
    account,
    chain: walletClient.chain
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  let safeAddress: Address | undefined
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
      continue
    }
    try {
      const decoded = decodeEventLog({
        abi: safeProxyFactoryAbi,
        data: log.data,
        topics: log.topics
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
    throw new Error('Safe proxy creation event not found in transaction receipt')
  }

  return { safeAddress, transactionHash: txHash, multiSendCallOnly: multiSendAddress }
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
  const nonce = (await publicClient.readContract({
    address: safeAddress,
    abi: safeAbi,
    functionName: 'nonce'
  })) as bigint

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
}

export const executeSafeTransaction = async ({
  walletClient,
  publicClient,
  safeAddress,
  transaction
}: ExecuteSafeTransactionParams): Promise<Hex> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

  const signature = await walletClient.signMessage({
    account,
    message: { raw: transaction.hash }
  })

  const normalizedSignature = normalizeSignature(signature)

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
      normalizedSignature
    ],
    account,
    chain: walletClient.chain
  })

  await publicClient.waitForTransactionReceipt({ hash: txHash })

  return txHash
}

