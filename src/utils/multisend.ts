import type { Hex } from 'viem'
import { concatHex, numberToHex, padHex } from 'viem'

import type { SafeContractCall } from '../core/types'
import { SafeTransactionOperation } from '../core/types'

const hexDataLength = (data: Hex): number => (data.length - 2) / 2

const normalizeCall = (call: SafeContractCall): Required<SafeContractCall> => ({
  to: call.to,
  value: call.value ?? 0n,
  data: call.data,
  operation: call.operation ?? SafeTransactionOperation.Call
})

export const encodeMultiSendCallData = (calls: SafeContractCall[]): Hex => {
  if (calls.length === 0) {
    throw new Error('encodeMultiSendCallData requires at least one call')
  }
  const encoded = calls.map((call) => {
    const { to, value, data, operation } = normalizeCall(call)

    const operationHex = padHex(numberToHex(operation, { size: 1 }), { size: 1 })
    const toHex = padHex(to, { size: 20 })
    const valueHex = padHex(numberToHex(value, { size: 32 }), { size: 32 })
    const dataLengthHex = padHex(numberToHex(hexDataLength(data), { size: 32 }), { size: 32 })

    return concatHex([operationHex, toHex, valueHex, dataLengthHex, data])
  })

  return concatHex(encoded)
}

