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
  P2P_API_TOKEN: z.string().optional(),
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

