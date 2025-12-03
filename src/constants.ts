import type { Address } from 'viem'

export const P2P_API_URL = 'https://api.p2p.org/clients' as const
export const P2P_ADDRESS =
  '0x03264232431031B6484188640ECFF7BdaBDA4b8b' as const satisfies Address
export const P2P_SUPERFORM_PROXY_FACTORY_ADDRESS =
  '0x815B6A7c0b8F4D1c7cdb5031EBe802bf4f7e6d81' as const satisfies Address

export const ROLES_MASTER_COPY_ADDRESS =
  '0x9646fDAD06d3e24444381f44362a3B0eB343D337' as const satisfies Address
export const ROLES_INTEGRITY_LIBRARY_ADDRESS =
  '0x6a6Af4b16458Bc39817e4019fB02BD3b26d41049' as const satisfies Address
export const ROLES_PACKER_LIBRARY_ADDRESS =
  '0x61C5B1bE435391fDd7BC6703F3740C0d11728a8C' as const satisfies Address

export const SAFE_SINGLETON_ADDRESS =
  '0xd9Db270c1B5E3Bd161E8c8503c55ceABeE709552' as const satisfies Address
export const SAFE_PROXY_FACTORY_ADDRESS =
  '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2' as const satisfies Address
export const SAFE_MULTI_SEND_CALL_ONLY_ADDRESS =
  '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D' as const satisfies Address

export const SAFE_RPC_URL = process.env.RPC_URL || ''
export const SAFE_OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY || ''
