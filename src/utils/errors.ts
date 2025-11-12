export const isContractFunctionZeroDataError = (error: unknown): boolean => {
  if (error instanceof Error) {
    if (error.name === 'ContractFunctionZeroDataError') {
      return true
    }

    const message = error.message ?? ''
    if (message.includes('ContractFunctionZeroDataError')) {
      return true
    }
    if (message.includes('returned no data')) {
      return true
    }
  } else if (typeof error === 'string') {
    if (error.includes('ContractFunctionZeroDataError')) {
      return true
    }
    if (error.includes('returned no data')) {
      return true
    }
  }

  return false
}

export const normalizeContractFunctionZeroDataError = (error: unknown): Error => {
  if (error instanceof Error) {
    if (error.name === 'ContractFunctionZeroDataError') {
      return error
    }

    const normalized = new Error(error.message)
    normalized.name = 'ContractFunctionZeroDataError'
    return normalized
  }

  const normalized = new Error(typeof error === 'string' ? error : 'Contract function returned no data')
  normalized.name = 'ContractFunctionZeroDataError'
  return normalized
}

