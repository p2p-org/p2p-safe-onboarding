import type { Chain, PublicClient, Transport, WalletClient } from 'viem'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { PrivateKeyAccount } from 'viem/accounts'

export interface PrivateKeyClientOptions<TChain extends Chain> {
  rpcUrl: string
  privateKey: `0x${string}`
  chain: TChain
  batch?: boolean
}

export interface PrivateKeyClients<TChain extends Chain> {
  publicClient: PublicClient<Transport, TChain>
  walletClient: WalletClient<Transport, TChain, PrivateKeyAccount>
}

export const createClientsFromPrivateKey = <TChain extends Chain>({
  rpcUrl,
  privateKey,
  chain,
  batch = false
}: PrivateKeyClientOptions<TChain>): PrivateKeyClients<TChain> => {
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

