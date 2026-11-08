/**
 * Vacía el esquema público de PostgreSQL.
 * Solo para desarrollo y entornos de demostración.
 */
import { createPool } from './client'

const connectionString = process.env.DATABASE_URL || ''
const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(connectionString)

if (!isLocal && process.env.ALLOW_DB_RESET !== '1') {
  console.error(
    'db:reset apunta a una base remota. Si es intencionado, repite con ALLOW_DB_RESET=1.',
  )
  process.exit(1)
}

const pool = createPool()

await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
await pool.query('CREATE SCHEMA public')
await pool.end()

console.log('✓ Esquema público y diario de migraciones recreados')
