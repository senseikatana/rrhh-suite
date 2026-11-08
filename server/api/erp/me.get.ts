import { eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { requireUser } from '../../utils/session'
import { useDb } from '../../utils/db'

/**
 * Identidad y contexto ERP del usuario autenticado.
 * Expone el rol por organización (de `user_company_access`) y la lista de
 * empresas a las que tiene acceso, para que el frontend sepa qué módulos y
 * acciones mostrar. La seguridad real la re-aplica cada endpoint.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const db = useDb()

  const grants = await db
    .select({
      orgId: schema.userCompanyAccess.orgId,
      role: schema.userCompanyAccess.role,
      name: schema.organizations.name,
      slug: schema.organizations.slug,
      currency: schema.organizations.currency,
      locale: schema.organizations.locale,
      defaultLanguage: schema.organizations.defaultLanguage,
      qualityCheckRequired: schema.organizations.qualityCheckRequired,
      modulesEnabled: schema.organizations.modulesEnabled,
    })
    .from(schema.userCompanyAccess)
    .innerJoin(
      schema.organizations,
      eq(schema.userCompanyAccess.orgId, schema.organizations.id),
    )
    // Solo las concesiones del usuario autenticado. Sin este filtro se filtra el
    // inventario de organizaciones y roles de todos los usuarios.
    .where(eq(schema.userCompanyAccess.userId, session.user.id))

  return {
    user: session.user,
    companies: grants.map((g) => ({
      code: g.orgId,
      name: g.name,
      currency: g.currency,
      locale: g.locale,
      default_language: g.defaultLanguage,
      quality_check_required: g.qualityCheckRequired,
      modules_enabled: g.modulesEnabled,
    })),
    roles: grants.map((g) => ({ orgId: g.orgId, role: g.role })),
  }
})
