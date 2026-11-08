import { eq } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import type { Db } from '../database/client'
import * as schema from '../database/schema'

export interface QueueEmailInput {
  employeeId?: string | null
  email: string
  type: string
  subject: string
  body: string
}

/** Encola un email. El envío real se hace al final de la petición. */
export async function queueEmail(db: Db, input: QueueEmailInput) {
  await db.insert(schema.notifications).values({
    id: crypto.randomUUID(),
    employeeId: input.employeeId ?? null,
    email: input.email,
    type: input.type,
    subject: input.subject,
    body: input.body,
    status: 'pending',
    attempts: 0,
    scheduledAt: new Date(),
  })
}

/**
 * Procesa la cola. Sin SMTP configurado escribe en consola y marca como enviado,
 * para que la demo funcione sin infraestructura de correo.
 */
export async function flushEmails(db: Db) {
  const pending = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.status, 'pending'))
    .limit(25)

  if (pending.length === 0) return

  const config = useRuntimeConfig()

  const transport = config.smtp.host
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
    : null

  for (const email of pending) {
    if (!email.email) {
      await db
        .update(schema.notifications)
        .set({ status: 'failed', error: 'Sin dirección de email' })
        .where(eq(schema.notifications.id, email.id))
      continue
    }

    try {
      if (transport) {
        await transport.sendMail({
          from: config.smtp.from,
          to: email.email,
          subject: email.subject,
          text: email.body,
        })
      } else {
        console.info(`[mail:dev] → ${email.email} · ${email.subject}\n${email.body}`)
      }

      await db
        .update(schema.notifications)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(schema.notifications.id, email.id))
    } catch (error) {
      const attempts = email.attempts + 1
      await db
        .update(schema.notifications)
        .set({
          attempts,
          status: attempts >= 3 ? 'failed' : 'pending',
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(schema.notifications.id, email.id))
    }
  }
}
