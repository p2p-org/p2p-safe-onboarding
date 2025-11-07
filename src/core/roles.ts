import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  getFunctionSelector
} from 'viem'

import { moduleProxyFactoryAbi, rolesAbi, rolesExecutionOptions } from '../utils/abis'
import { getZodiacModuleProxyFactoryAddress } from '../utils/moduleFactory'

interface DeployRolesModuleParams {
  walletClient: WalletClient
  publicClient: PublicClient
  masterCopy: Address
  ownerAddress: Address
  safeAddress: Address
  saltNonce?: bigint
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
  saltNonce
}: DeployRolesModuleParams): Promise<DeployRolesModuleResult> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

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

  const txHash = await walletClient.writeContract({
    address: moduleFactoryAddress,
    abi: moduleProxyFactoryAbi,
    functionName: 'deployModule',
    args: [masterCopy, initializer, nonce],
    account,
    chain: walletClient.chain
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

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
}

export const configureRolesPermissions = async ({
  walletClient,
  publicClient,
  rolesAddress,
  roleKey,
  p2pModuleAddress,
  factoryAddress,
  predictedProxyAddress
}: ConfigureRolesParams): Promise<Hex[]> => {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet client must have an active account')
  }

  const selectorDeposit = getFunctionSelector('deposit(bytes,uint48,uint48,uint256,bytes)')
  const selectorWithdraw = getFunctionSelector('withdraw(bytes)')

  const txHashes: Hex[] = []

  const scopeFactoryHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'scopeTarget',
    args: [roleKey, factoryAddress],
    account,
    chain: walletClient.chain
  })
  txHashes.push(scopeFactoryHash)
  await publicClient.waitForTransactionReceipt({ hash: scopeFactoryHash })

  const allowDepositHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'allowFunction',
    args: [roleKey, factoryAddress, selectorDeposit, rolesExecutionOptions.Send],
    account,
    chain: walletClient.chain
  })
  txHashes.push(allowDepositHash)
  await publicClient.waitForTransactionReceipt({ hash: allowDepositHash })

  const scopeProxyHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'scopeTarget',
    args: [roleKey, predictedProxyAddress],
    account,
    chain: walletClient.chain
  })
  txHashes.push(scopeProxyHash)
  await publicClient.waitForTransactionReceipt({ hash: scopeProxyHash })

  const allowWithdrawHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'allowFunction',
    args: [roleKey, predictedProxyAddress, selectorWithdraw, rolesExecutionOptions.None],
    account,
    chain: walletClient.chain
  })
  txHashes.push(allowWithdrawHash)
  await publicClient.waitForTransactionReceipt({ hash: allowWithdrawHash })

  const assignRoleHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'assignRoles',
    args: [p2pModuleAddress, [roleKey], [true]],
    account,
    chain: walletClient.chain
  })
  txHashes.push(assignRoleHash)
  await publicClient.waitForTransactionReceipt({ hash: assignRoleHash })

  const setDefaultRoleHash = await walletClient.writeContract({
    address: rolesAddress,
    abi: rolesAbi,
    functionName: 'setDefaultRole',
    args: [p2pModuleAddress, roleKey],
    account,
    chain: walletClient.chain
  })
  txHashes.push(setDefaultRoleHash)
  await publicClient.waitForTransactionReceipt({ hash: setDefaultRoleHash })

  return txHashes
}

