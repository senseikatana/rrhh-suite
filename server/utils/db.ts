import { getDb, type Db } from '../database/client'

/**
 * Conexión PostgreSQL compartida por las rutas de Nitro.
 * En tests y scripts se usa `createDb()` directamente.
 */
export function useDb(): Db {
  return getDb()
}
