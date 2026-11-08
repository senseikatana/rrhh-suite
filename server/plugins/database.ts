import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { resolve } from 'node:path'

/**
 * Aplica las migraciones pendientes al arrancar el servidor.
 * Es idempotente: Drizzle registra lo aplicado en drizzle.__drizzle_migrations.
 */
export default defineNitroPlugin(async () => {
  const db = useDb()
  const folder = process.env.MIGRATIONS_PATH || resolve(process.cwd(), 'server/database/migrations')

  try {
    await migrate(db, { migrationsFolder: folder })
  } catch (error) {
    console.error('[db] No se pudieron aplicar las migraciones:', error)
    throw error
  }
})
