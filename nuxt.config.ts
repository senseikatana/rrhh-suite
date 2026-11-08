export default defineNuxtConfig({
  compatibilityDate: '2026-11-08',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  ui: {
    colorMode: false,
  },

  runtimeConfig: {
    // Nunca fallback a un secreto conocido: si falta en producción, fallar en
    // alto en vez de firmar cookies con un secreto público del repo.
    betterAuthSecret: (() => {
      const secret = process.env.BETTER_AUTH_SECRET
      if (secret) return secret
      if (process.env.NODE_ENV === 'production') {
        throw new Error('BETTER_AUTH_SECRET is required in production')
      }
      // Secreto efímero solo para desarrollo.
      return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    })(),
    betterAuthUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || 'RRHH Suite <rrhh@localhost>',
      secure: process.env.SMTP_SECURE === 'true',
    },
    public: {
      appName: 'RRHH Suite',
      requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true',
    },
  },

  typescript: {
    strict: true,
  },

  app: {
    head: {
      title: 'RRHH Suite',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f172a' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
      ],
    },
  },
})
