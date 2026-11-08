import { and, eq, isNull, sql } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import * as schema from '../database/schema'
import { useDb } from './db'
import { sendAuthEmail } from './auth-email'

function createAuth() {
  const config = useRuntimeConfig()
  const baseUrl = config.betterAuthUrl.replace(/\/$/, '')
  const requireVerification = process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true'
  const sendVerificationOnSignUp = process.env.AUTH_SEND_VERIFICATION_ON_SIGNUP === 'true'

  const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return betterAuth({
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    trustedOrigins: [config.betterAuthUrl, ...extraOrigins],

    database: drizzleAdapter(useDb(), {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      requireEmailVerification: requireVerification,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, token }) => {
        const url = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
        await sendAuthEmail({
          to: user.email,
          subject: 'Restablece tu contraseña · RRHH Suite',
          text: [
            `Hola ${user.name},`,
            '',
            'Pulsa este enlace para crear una nueva contraseña. Caduca en 1 hora:',
            url,
            '',
            'Si no has solicitado el cambio, ignora este mensaje.',
          ].join('\n'),
        })
      },
      onPasswordReset: async ({ user }) => {
        await sendAuthEmail({
          to: user.email,
          subject: 'Tu contraseña ha cambiado · RRHH Suite',
          text: `Hola ${user.name},\n\nLa contraseña de tu cuenta se ha actualizado correctamente.\n\nSi no has sido tú, contacta con administración de inmediato.`,
        })
      },
    },

    emailVerification: {
      expiresIn: 60 * 60 * 24,
      sendOnSignUp: sendVerificationOnSignUp,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, token }) => {
        const url = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`
        await sendAuthEmail({
          to: user.email,
          subject: 'Verifica tu email · RRHH Suite',
          text: [
            `Hola ${user.name},`,
            '',
            'Confirma tu dirección de email con este enlace:',
            url,
            '',
            'El enlace caduca en 24 horas.',
          ].join('\n'),
        })
      },
    },

    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'employee',
          input: false,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    databaseHooks: {
      user: {
        create: {
          before: async (userData) => {
            const db = useDb()
            const [row] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.user)
            const isFirstUser = (row?.count ?? 0) === 0

            return {
              data: {
                ...userData,
                role: isFirstUser ? 'admin' : 'employee',
              },
            }
          },
          after: async (createdUser) => {
            const db = useDb()
            // Si la empresa ya tenía una ficha con ese email, se vincula sola.
            await db
              .update(schema.employees)
              .set({ userId: createdUser.id, updatedAt: new Date() })
              .where(
                and(
                  eq(schema.employees.email, createdUser.email.toLowerCase()),
                  isNull(schema.employees.userId),
                ),
              )
          },
        },
      },
    },

    advanced: {
      useSecureCookies:
        process.env.NODE_ENV === 'production' && config.betterAuthUrl.startsWith('https://'),
      database: {
        joins: true,
      },
    },
  })
}

let instance: ReturnType<typeof createAuth> | null = null

export function useAuth() {
  if (!instance) instance = createAuth()
  return instance
}
