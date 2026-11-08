import nodemailer from 'nodemailer'

export interface AuthEmailInput {
  to: string
  subject: string
  text: string
}

/**
 * Email transaccional de autenticación (verificación, reset, avisos).
 * Sin SMTP configurado se escribe en consola para poder probar en local.
 */
export async function sendAuthEmail(input: AuthEmailInput) {
  const config = useRuntimeConfig()

  if (!config.smtp.host) {
    console.info(`[auth:mail] → ${input.to} · ${input.subject}\n${input.text}`)
    return
  }

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  })

  await transport.sendMail({
    from: config.smtp.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  })
}
