import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  DEBUG: z.string().optional(),
  API_URL: z.string().url('API_URL must be a valid URL'),
  ALT_GAMES_API_KEY: z.string().min(1, 'ALT_GAMES_API_KEY is required'),
});

type EnvConfig = z.infer<typeof envSchema>;

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(
    _env.error.errors
      .map((error) => {
        return `${error.path}: ${error.message}`;
      })
      .join('\n')
  );
  process.exit(1);
}

export const env: EnvConfig = _env.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';