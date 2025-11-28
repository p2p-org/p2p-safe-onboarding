#!/usr/bin/env node

import { base } from 'viem/chains'

import { createOnboardingClientFromEnv } from '../dist/index.mjs'

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

const main = async () => {
  const onboarding = createOnboardingClientFromEnv({ chain: base })

  console.info('Starting onboarding flow on Base…')

  const safe = await onboarding.deploySafe()
  const permissions = await onboarding.setPermissions({ safeAddress: safe.safeAddress })
  const usdcTransfer = await onboarding.transferAsset({
    address: USDC_BASE,
    amount: 1_000_000n // 1 USDC (6 decimals)
  })

  console.info('\nOnboarding complete:')
  console.info('  Safe address:              ', safe.safeAddress)
  console.info('  Roles modifier address:    ', permissions.rolesAddress)
  console.info('  Predicted Superform proxy: ', permissions.predictedProxyAddress)
  console.info('\nTransaction hashes:')
  console.info('  Safe deployment:           ', safe.transactionHash)
  console.info('  Roles setup (batched):     ', permissions.transactionHash)
  console.info('  USDC transfer:             ', usdcTransfer.transactionHash)

  console.info('\nView them on BaseScan: https://basescan.org/')
}

main().catch((error) => {
  console.error('Onboarding demo failed:', error)
  process.exit(1)
})
