import type { Abi } from 'viem'

export const safeProxyFactoryAbi = [
  {
    type: 'function',
    name: 'createProxyWithNonce',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_singleton', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' }
    ],
    outputs: [{ name: 'proxy', type: 'address' }]
  },
  {
    type: 'event',
    name: 'ProxyCreation',
    inputs: [
      { name: 'proxy', type: 'address', indexed: false },
      { name: 'singleton', type: 'address', indexed: false }
    ],
    anonymous: false
  }
] as const satisfies Abi

export const safeAbi = [
  {
    type: 'function',
    name: 'setup',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_owners', type: 'address[]' },
      { name: '_threshold', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'fallbackHandler', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint256' },
      { name: 'paymentReceiver', type: 'address' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'enableModule',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'module', type: 'address' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'isModuleEnabled',
    stateMutability: 'view',
    inputs: [{ name: 'module', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'nonce',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'getTransactionHash',
    stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' }
    ],
    outputs: [{ name: 'safeTxHash', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'execTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
  }
] as const satisfies Abi

export const moduleProxyFactoryAbi = [
  {
    type: 'function',
    name: 'deployModule',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'masterCopy', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' }
    ],
    outputs: [{ name: 'proxy', type: 'address' }]
  },
  {
    type: 'event',
    name: 'ModuleProxyCreation',
    inputs: [
      { name: 'proxy', type: 'address', indexed: true },
      { name: 'masterCopy', type: 'address', indexed: true }
    ],
    anonymous: false
  }
] as const satisfies Abi

export const rolesAbi = [
  {
    type: 'function',
    name: 'setUp',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'initParams', type: 'bytes' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'assignRoles',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'module', type: 'address' },
      { name: 'roleKeys', type: 'bytes32[]' },
      { name: 'memberOf', type: 'bool[]' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'setDefaultRole',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'module', type: 'address' },
      { name: 'roleKey', type: 'bytes32' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'allowTarget',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleKey', type: 'bytes32' },
      { name: 'targetAddress', type: 'address' },
      { name: 'options', type: 'uint8' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'scopeTarget',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleKey', type: 'bytes32' },
      { name: 'targetAddress', type: 'address' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'allowFunction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleKey', type: 'bytes32' },
      { name: 'targetAddress', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      { name: 'options', type: 'uint8' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'scopeFunction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleKey', type: 'bytes32' },
      { name: 'targetAddress', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      {
        name: 'conditions',
        type: 'tuple[]',
        components: [
          { name: 'parent', type: 'uint8' },
          { name: 'paramType', type: 'uint8' },
          { name: 'operator', type: 'uint8' },
          { name: 'compValue', type: 'bytes' }
        ]
      },
      { name: 'options', type: 'uint8' }
    ],
    outputs: []
  }
] as const satisfies Abi

export const p2pSuperformProxyFactoryAbi = [
  {
    type: 'function',
    name: 'predictP2pYieldProxyAddress',
    stateMutability: 'view',
    inputs: [
      { name: '_client', type: 'address' },
      { name: '_clientBasisPointsOfDeposit', type: 'uint48' },
      { name: '_clientBasisPointsOfProfit', type: 'uint48' }
    ],
    outputs: [{ name: '', type: 'address' }]
  }
] as const satisfies Abi

export const p2pSuperformProxyAbi = [
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_superformCalldata', type: 'bytes' }],
    outputs: []
  }
] as const satisfies Abi

export const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const satisfies Abi

export const p2pSuperformProxyFactoryFunctions = {
  deposit: 'function deposit(bytes,uint48,uint48,uint256,bytes)'
}

export const rolesExecutionOptions = {
  None: 0,
  Send: 1,
  DelegateCall: 2,
  Both: 3
} as const

export const multiSendCallOnlyAbi = [
  {
    type: 'function',
    name: 'multiSend',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'transactions', type: 'bytes' }],
    outputs: []
  }
] as const satisfies Abi
