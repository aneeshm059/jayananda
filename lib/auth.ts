import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { database } from './db/client';
import { users, session, account, verification, rateLimit } from './db/schema';
export function auth() {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database(), {
      provider: 'sqlite',
      schema: { user: users, session, account, verification, rateLimit },
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 8 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      useSecureCookies: env.BETTER_AUTH_URL.startsWith('https:'),
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.BETTER_AUTH_URL.startsWith('https:'),
      },
    },
  });
}
