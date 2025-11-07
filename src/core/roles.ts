import type { Address, Hex } from 'viem'
import { encodeAbiParameters, encodeFunctionData, getFunctionSelector } from 'viem'

import { moduleProxyFactoryAbi, rolesAbi, rolesExecutionOptions } from '../utils/abis'
import {
  getZodiacModuleProxyFactoryAddress,
  predictModuleProxyAddress
} from '../utils/moduleFactory'
import type { SafeContractCall } from './types'
import { SafeTransactionOperation } from './types'

interface PrepareRolesModuleParams {
  masterCopy: Address
  ownerAddress: Address
  safeAddress: Address
  saltNonce?: bigint
  logger?: (message: string) => void
}

interface PrepareRolesModuleResult {
  rolesAddress: Address
  deploymentCall: SafeContractCall
  saltNonce: bigint
  initializer: Hex
}

export const prepareRolesModuleDeployment = ({
  masterCopy,
  ownerAddress,
  safeAddress,
  saltNonce,
  logger
}: PrepareRolesModuleParams): PrepareRolesModuleResult => {
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
    saltNonce ?? (BigInt(Date.now()) << 32n) | BigInt(Math.floor(Math.random() * 1e6))

  const moduleFactoryAddress = getZodiacModuleProxyFactoryAddress()
  const deploymentCall: SafeContractCall = {
    to: moduleFactoryAddress,
    value: 0n,
    data: encodeFunctionData({
      abi: moduleProxyFactoryAbi,
      functionName: 'deployModule',
      args: [masterCopy, initializer, nonce]
    }),
    operation: SafeTransactionOperation.Call
  }

  const rolesAddress = predictModuleProxyAddress({
    factoryAddress: moduleFactoryAddress,
    masterCopy,
    initializer,
    saltNonce: nonce
  })

  log(
    `   • Prepared Roles deployment via ModuleProxyFactory ${moduleFactoryAddress} (saltNonce=${nonce}) -> ${rolesAddress}`
  )

  return { rolesAddress, deploymentCall, saltNonce: nonce, initializer }
}

interface PrepareRolesPermissionsParams {
  rolesAddress: Address
  roleKey: Hex
  p2pModuleAddress: Address
  factoryAddress: Address
  predictedProxyAddress: Address
  logger?: (message: string) => void
}

export const prepareRolesPermissions = ({
  rolesAddress,
  roleKey,
  p2pModuleAddress,
  factoryAddress,
  predictedProxyAddress,
  logger
}: PrepareRolesPermissionsParams): SafeContractCall[] => {
  const log = logger ?? (() => {})
  const selectorDeposit = getFunctionSelector('deposit(bytes,uint48,uint48,uint256,bytes)')
  const selectorWithdraw = getFunctionSelector('withdraw(bytes)')

  log('   • Prepared Roles permission calls')

  return [
    {
      to: rolesAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: rolesAbi,
        functionName: 'scopeTarget',
        args: [roleKey, factoryAddress]
      }),
      operation: SafeTransactionOperation.Call
    },
    {
      to: rolesAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: rolesAbi,
        functionName: 'allowFunction',
        args: [roleKey, factoryAddress, selectorDeposit, rolesExecutionOptions.Send]
      }),
      operation: SafeTransactionOperation.Call
    },
    {
      to: rolesAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: rolesAbi,
        functionName: 'scopeTarget',
        args: [roleKey, predictedProxyAddress]
      }),
      operation: SafeTransactionOperation.Call
    },
    {
      to: rolesAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: rolesAbi,
        functionName: 'allowFunction',
        args: [roleKey, predictedProxyAddress, selectorWithdraw, rolesExecutionOptions.None]
      }),
      operation: SafeTransactionOperation.Call
    },
    {
      to: rolesAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: rolesAbi,
        functionName: 'assignRoles',
        args: [p2pModuleAddress, [roleKey], [true]]
      }),
      operation: SafeTransactionOperation.Call
    },
    {
      to: rolesAddress,
      value: 0n,
      data: encodeFunctionData({
        abi: rolesAbi,
        functionName: 'setDefaultRole',
        args: [p2pModuleAddress, roleKey]
      }),
      operation: SafeTransactionOperation.Call
    }
  ]
}

