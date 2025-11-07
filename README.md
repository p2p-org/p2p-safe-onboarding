# P2P Safe Onboarding SDK

TypeScript helpers for automating P2P.org client onboarding:

- Deploy a single-owner Safe for the client
- Instantiate the Zodiac Roles modifier
- Fetch P2P fee configuration and deterministically predict the client's `P2pSuperformProxy`
- Configure Roles so `P2P_ADDRESS` can only call the `deposit` function on the factory and the `withdraw` function on the predicted proxy

The package targets Node 18+/Browser environments with [viem](https://viem.sh/).

## Installation

```bash
npm install @p2p-org/safe-onboarding-sdk
```

## Environment

Copy `.env.sample` to `.env` and fill in the values (addresses are checksummed strings):

```
RPC_URL=
PRIVATE_KEY=
P2P_API_URL=
P2P_API_TOKEN=
P2P_ADDRESS=
P2P_SUPERFORM_PROXY_FACTORY_ADDRESS=
ROLES_MASTER_COPY_ADDRESS=
ROLES_INTEGRITY_LIBRARY_ADDRESS=
ROLES_PACKER_LIBRARY_ADDRESS=
```

## Quick start (backend)

```ts
import { base } from 'viem/chains'
import { createOnboardingClientFromEnv } from '@p2p-org/safe-onboarding-sdk'

async function main() {
  const client = createOnboardingClientFromEnv({ chain: base })
  const result = await client.onboardClient()

  console.log('Safe:', result.safeAddress)
  console.log('Roles modifier:', result.rolesAddress)
  console.log('Predicted P2pSuperformProxy:', result.predictedProxyAddress)
}

main().catch(console.error)
```

## Custom wiring (frontend / serverless)

```ts
import { base } from 'viem/chains'
import { createWalletClient, http } from 'viem'
import { OnboardingClient } from '@p2p-org/safe-onboarding-sdk'

const walletClient = /* wagmi or WalletConnect wallet client */
const publicClient = /* viem public client for the same chain */

const onboarding = new OnboardingClient({
  walletClient,
  publicClient,
  p2pApiUrl: 'https://api.p2p.org/clients',
  p2pAddress: '0x...',
  p2pSuperformProxyFactoryAddress: '0x...',
  rolesMasterCopyAddress: '0x...',
  rolesIntegrityLibraryAddress: '0x...',
  rolesPackerLibraryAddress: '0x...'
})

await onboarding.onboardClient({ clientAddress: walletClient.account.address })
```

## Testing

```bash
npm run build
```

## Notes

- The SDK assumes Safe v1.3 deployments. Override the configuration if you need different versions or custom deployments.
- `onboardClient` executes live transactions (deploy Safe, deploy Roles, configure roles, enable module). Ensure the wallet has enough funds to cover gas.
- Transactions are executed sequentially; future iterations can batch Safe configuration via MultiSend.

