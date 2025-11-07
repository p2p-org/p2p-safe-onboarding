import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  getFunctionSelector
} from 'viem'

import { moduleProxyFactoryAbi, rolesAbi, rolesExecutionOptions } from '../utils/abis'
import { getZodiacModuleProxyFactoryAddress } from '../utils/moduleFactory'
import type { NonceManager } from './types'

interface DeployRolesModuleParams {
  walletClient: WalletClient
  publicClient: PublicClient
  masterCopy: Address
  ownerAddress: Address
  safeAddress: Address
  saltNonce?: bigint
  logger?: (message: string) => void
  nonceManager?: NonceManager
}

interface DeployRolesModuleResult {
  rolesAddress: Address
  transactionHash: Hex
}

export const deployRolesModule = async ({
  walletClient,
  publicClient,
  masterCopy,
  ownerAddress,
  safeAddress,
  saltNonce,
  logger,
  nonceManager
}: DeployRolesModuleParams): Promise<DeployRolesModuleResult> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

  const log = logger ?? (() => {})

  const initParams = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'address' }
    ],
    [ownerAddress, safeAddress, safeAddress]
  )

  const initializer = encodeFunctionData({
    abi: rolesAbi,
    functionName: 'setUp',
    args: [initParams]
  })

  const nonce =
    saltNonce ?? BigInt(Date.now()) << 32n | BigInt(Math.floor(Math.random() * 1e6))

  const moduleFactoryAddress = getZodiacModuleProxyFactoryAddress()
  log(`   • Deploying Roles via Zodiac ModuleProxyFactory ${moduleFactoryAddress}`)

  const txNonce = nonceManager?.consumeNonce()
  if (typeof txNonce === 'number') {
    log(`     - EOA nonce ${txNonce}`)
  }
  const txHash = await walletClient.writeContract({
    address: moduleFactoryAddress,
    abi: moduleProxyFactoryAbi,
    functionName: 'deployModule',
    args: [masterCopy, initializer, nonce],
    account,
    chain: walletClient.chain,
    nonce: txNonce
  })
  log(`   • Roles deployment tx hash ${txHash}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  log(`   • Roles deployment receipt status ${receipt.status}`)

  let rolesAddress: Address | undefined
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== moduleFactoryAddress.toLowerCase()) {
      continue
    }
    try {
      const decoded = decodeEventLog({
        abi: moduleProxyFactoryAbi,
        data: log.data,
        topics: log.topics
      })
      if (decoded.eventName === 'ModuleProxyCreation') {
        const args = decoded.args
        if (typeof args === 'object' && args !== null && 'proxy' in args) {
          rolesAddress = args.proxy as Address
        }
        break
      }
    } catch (error) {
      // ignore non-matching logs
    }
  }

  if (!rolesAddress) {
    throw new Error('Roles module creation event not found in transaction receipt')
  }

  log(`   • Roles module address ${rolesAddress}`)
  return { rolesAddress, transactionHash: txHash }
}

interface ConfigureRolesParams {
  walletClient: WalletClient
  publicClient: PublicClient
  rolesAddress: Address
  roleKey: Hex
  p2pModuleAddress: Address
  factoryAddress: Address
  predictedProxyAddress: Address
  logger?: (message: string) => void
  nonceManager?: NonceManager
}

export const configureRolesPermissions = async ({
  walletClient,
  publicClient,
  rolesAddress,
  roleKey,
  p2pModuleAddress,
  factoryAddress,
  predictedProxyAddress,
  logger,
  nonceManager
}: ConfigureRolesParams): Promise<Hex[]> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

  const log = logger ?? (() => {})
  const selectorDeposit = getFunctionSelector('deposit(bytes,uint48,uint48,uint256,bytes)')
  const selectorWithdraw = getFunctionSelector('withdraw(bytes)')

  const txHashes: Hex[] = []

  log(`   • Configuring Roles permissions`)

  const scopeFactoryNonce = nonceManager?.consumeNonce()
  const scopeFactoryHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'scopeTarget',
    args: [roleKey, factoryAddress],
    account,
    chain: walletClient.chain,
    nonce: scopeFactoryNonce
  })
  txHashes.push(scopeFactoryHash)
  await publicClient.waitForTransactionReceipt({ hash: scopeFactoryHash })
  log(
    `     ↳ scopeTarget(factory) tx ${scopeFactoryHash}${
      typeof scopeFactoryNonce === 'number' ? ` (nonce ${scopeFactoryNonce})` : ''
    }`
  )

  const allowDepositNonce = nonceManager?.consumeNonce()
  const allowDepositHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'allowFunction',
    args: [roleKey, factoryAddress, selectorDeposit, rolesExecutionOptions.Send],
    account,
    chain: walletClient.chain,
    nonce: allowDepositNonce
  })
  txHashes.push(allowDepositHash)
  await publicClient.waitForTransactionReceipt({ hash: allowDepositHash })
  log(
    `     ↳ allowFunction(deposit) tx ${allowDepositHash}${
      typeof allowDepositNonce === 'number' ? ` (nonce ${allowDepositNonce})` : ''
    }`
  )

  const scopeProxyNonce = nonceManager?.consumeNonce()
  const scopeProxyHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'scopeTarget',
    args: [roleKey, predictedProxyAddress],
    account,
    chain: walletClient.chain,
    nonce: scopeProxyNonce
  })
  txHashes.push(scopeProxyHash)
  await publicClient.waitForTransactionReceipt({ hash: scopeProxyHash })
  log(
    `     ↳ scopeTarget(proxy) tx ${scopeProxyHash}${
      typeof scopeProxyNonce === 'number' ? ` (nonce ${scopeProxyNonce})` : ''
    }`
  )

  const allowWithdrawNonce = nonceManager?.consumeNonce()
  const allowWithdrawHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'allowFunction',
    args: [roleKey, predictedProxyAddress, selectorWithdraw, rolesExecutionOptions.None],
    account,
    chain: walletClient.chain,
    nonce: allowWithdrawNonce
  })
  txHashes.push(allowWithdrawHash)
  await publicClient.waitForTransactionReceipt({ hash: allowWithdrawHash })
  log(
    `     ↳ allowFunction(withdraw) tx ${allowWithdrawHash}${
      typeof allowWithdrawNonce === 'number' ? ` (nonce ${allowWithdrawNonce})` : ''
    }`
  )

  const assignRoleNonce = nonceManager?.consumeNonce()
  const assignRoleHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'assignRoles',
    args: [p2pModuleAddress, [roleKey], [true]],
    account,
    chain: walletClient.chain,
    nonce: assignRoleNonce
  })
  txHashes.push(assignRoleHash)
  await publicClient.waitForTransactionReceipt({ hash: assignRoleHash })
  log(
    `     ↳ assignRoles tx ${assignRoleHash}${
      typeof assignRoleNonce === 'number' ? ` (nonce ${assignRoleNonce})` : ''
    }`
  )

  const setDefaultRoleNonce = nonceManager?.consumeNonce()
  const setDefaultRoleHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'setDefaultRole',
    args: [p2pModuleAddress, roleKey],
    account,
    chain: walletClient.chain,
    nonce: setDefaultRoleNonce
  })
  txHashes.push(setDefaultRoleHash)
  await publicClient.waitForTransactionReceipt({ hash: setDefaultRoleHash })
  log(
    `     ↳ setDefaultRole tx ${setDefaultRoleHash}${
      typeof setDefaultRoleNonce === 'number' ? ` (nonce ${setDefaultRoleNonce})` : ''
    }`
  )

  return txHashes
}

