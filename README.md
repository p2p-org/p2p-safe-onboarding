# P2P Safe Onboarding SDK

TypeScript helpers for automating P2P.org client onboarding:

- Deploy a single-owner Safe for the client
- Instantiate the Zodiac Roles modifier
- Fetch (or temporarily mock) P2P fee configuration and deterministically predict the client's `P2pSuperformProxy`
- Configure Roles so `P2P_ADDRESS` can only call the `deposit` function on the factory and the `withdraw` function on the predicted proxy

The package targets Node 18+/Browser environments with [viem](https://viem.sh/).

## Installation

```bash
npm install @p2p-org/safe-onboarding-sdk
```

## Environment

Copy `.env.sample` to `.env` and fill in the values:

```
RPC_URL=
PRIVATE_KEY=
P2P_API_TOKEN=
```

The SDK ships with canonical contract addresses baked in and re-exports them from `@p2p-org/safe-onboarding-sdk/constants`:

- `P2P_ADDRESS = 0x588ede4403DF0082C5ab245b35F0f79EB2d8033a`
- `P2P_SUPERFORM_PROXY_FACTORY_ADDRESS = 0x931F03069Bbac8cAb236D548bEB5b3eFcb4f1769`
- `ROLES_MASTER_COPY_ADDRESS = 0x9646fDAD06d3e24444381f44362a3B0eB343D337`
- `ROLES_INTEGRITY_LIBRARY_ADDRESS = 0x6a6Af4b16458Bc39817e4019fB02BD3b26d41049`
- `ROLES_PACKER_LIBRARY_ADDRESS = 0x61C5B1bE435391fDd7BC6703F3740C0d11728a8C`
- `SAFE_SINGLETON_ADDRESS = 0xd9Db270c1B5E3Bd161E8c8503c55ceABeE709552`
- `SAFE_PROXY_FACTORY_ADDRESS = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2`
- `SAFE_MULTI_SEND_CALL_ONLY_ADDRESS = 0x40A2aCCbd92BCA938b02010E17A5b8929b49130D`
- `P2P_API_URL = https://api.p2p.org/clients`

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

### Verbose logging

Provide a `logger` function to capture SDK progress messages:

```ts
const onboarding = new OnboardingClient({
  walletClient,
  publicClient,
  // …rest of config…
  logger: (message) => console.debug('[onboarding]', message)
})
```

## Custom wiring (frontend / serverless)

```ts
import { base } from 'viem/chains'
import { createWalletClient, http } from 'viem'
import { OnboardingClient, constants } from '@p2p-org/safe-onboarding-sdk'

const walletClient = /* wagmi or WalletConnect wallet client */
const publicClient = /* viem public client for the same chain */

const onboarding = new OnboardingClient({
  walletClient,
  publicClient,
  p2pApiUrl: constants.P2P_API_URL,
  p2pAddress: constants.P2P_ADDRESS,
  p2pSuperformProxyFactoryAddress: constants.P2P_SUPERFORM_PROXY_FACTORY_ADDRESS,
  rolesMasterCopyAddress: constants.ROLES_MASTER_COPY_ADDRESS,
  rolesIntegrityLibraryAddress: constants.ROLES_INTEGRITY_LIBRARY_ADDRESS,
  rolesPackerLibraryAddress: constants.ROLES_PACKER_LIBRARY_ADDRESS
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
- Until the P2P API is available, fee terms default to deposit `0` bps and profit share `9700` bps.
- Transactions are executed sequentially; future iterations can batch Safe configuration via MultiSend.

