#!/usr/bin/env node

import { base } from 'viem/chains'

import { createOnboardingClientFromEnv } from '../dist/index.js'

const main = async () => {
  const onboarding = createOnboardingClientFromEnv({ chain: base })

  console.info('Starting onboarding flow on Base…')

  const result = await onboarding.onboardClient()

  console.info('\nOnboarding complete:')
  console.info('  Safe address:              ', result.safeAddress)
  console.info('  Roles modifier address:    ', result.rolesAddress)
  console.info('  Predicted Superform proxy: ', result.predictedProxyAddress)
  console.info('\nTransaction hashes:')
  console.info('  Safe deployment:           ', result.transactions.safeDeploymentHash)
  console.info('  Roles deployment:          ', result.transactions.rolesDeploymentHash)
  console.info('  Module enable:             ', result.transactions.safeModuleEnableHash)
  console.info('  Role configuration steps:')
  result.transactions.roleConfigurationHashes.forEach((hash, index) => {
    console.info(`    [${index + 1}] ${hash}`)
  })

  console.info('\nView them on BaseScan: https://basescan.org/')
}

main().catch((error) => {
  console.error('Onboarding demo failed:', error)
  process.exit(1)
})

