import { config as loadDotEnv } from 'dotenv'
import { z } from 'zod'

const envSchema = z.object({
  RPC_URL: z
    .string()
    .url({ message: 'RPC_URL must be a valid http(s) URL' })
    .optional(),
  PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/u, {
      message: 'PRIVATE_KEY must be a 0x-prefixed 32-byte hex string',
    })
    .optional(),
  P2P_API_URL: z.string().url({ message: 'P2P_API_URL must be a valid URL' }),
  P2P_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message: 'P2P_ADDRESS must be a valid EVM address',
    }),
  P2P_SUPERFORM_PROXY_FACTORY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message:
        'P2P_SUPERFORM_PROXY_FACTORY_ADDRESS must be a valid EVM address',
    }),
  ROLES_MASTER_COPY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message: 'ROLES_MASTER_COPY_ADDRESS must be a valid EVM address',
    })
    .optional(),
  ROLES_INTEGRITY_LIBRARY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message: 'ROLES_INTEGRITY_LIBRARY_ADDRESS must be a valid EVM address',
    })
    .optional(),
  ROLES_PACKER_LIBRARY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message: 'ROLES_PACKER_LIBRARY_ADDRESS must be a valid EVM address',
    })
    .optional(),
  P2P_API_TOKEN: z.string().optional(),
  SAFE_SINGLETON_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message: 'SAFE_SINGLETON_ADDRESS must be a valid EVM address',
    })
    .optional(),
  SAFE_PROXY_FACTORY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message: 'SAFE_PROXY_FACTORY_ADDRESS must be a valid EVM address',
    })
    .optional(),
  SAFE_MULTI_SEND_CALL_ONLY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, {
      message:
        'SAFE_MULTI_SEND_CALL_ONLY_ADDRESS must be a valid EVM address',
    })
    .optional(),
})

export type EnvConfig = z.infer<typeof envSchema>

export const loadEnv = (params?: { path?: string; override?: boolean }) => {
  loadDotEnv(params)
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')}`
    )
  }
  return result.data
}

