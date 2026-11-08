import { getErpContext } from '../../../utils/erp'
import { generate } from '../../../services/erp-demand'
import { demandGenerate, parseOrThrow } from '../../../utils/erp-schemas'

/**
 * Reconstruye la hoja de demanda pendiente.
 * Las líneas PENDING se descartan y recalculan; las marcadas ORDERED o IGNORED
 * se preservan para no perder decisiones manuales en cada regeneración.
 */
export default defineEventHandler(async (event) => {
  const { db, actor, orgId } = await getErpContext(event)

  // Solo compras o administración pueden reconstruir la hoja (borra las PENDING).
  if (!['admin', 'buyer'].includes(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Role '${actor.role}' is not permitted. Allowed roles: admin, buyer`,
    })
  }

  const params = parseOrThrow(demandGenerate, await readBody(event), 'Invalid demand parameters')

  const created = await db.transaction(async (tx) => {
    return generate(tx, orgId, actor, {
      coverageRatio: params.coverageRatio,
      horizonDays: params.horizonDays,
    })
  })

  return { lines: created.length, items: created }
})
