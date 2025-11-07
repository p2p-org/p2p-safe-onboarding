import type { Chain } from 'viem'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export interface PrivateKeyClientOptions<TChain extends Chain> {
  rpcUrl: string
  privateKey: `0x${string}`
  chain: TChain
  batch?: boolean
}

export const createClientsFromPrivateKey = <TChain extends Chain>({
  rpcUrl,
  privateKey,
  chain,
  batch = false
}: PrivateKeyClientOptions<TChain>) => {
  const account = privateKeyToAccount(privateKey)
  const transport = http(rpcUrl, {
    batch
  })

  const publicClient = createPublicClient({
    chain,
    transport
  })

  const walletClient = createWalletClient({
    account,
    chain,
    transport
  })

  return { publicClient, walletClient }
}

