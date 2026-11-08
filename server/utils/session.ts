import type { H3Event } from 'h3'

export type Role = 'admin' | 'manager' | 'employee'

export interface AuthUser {
  id: string
  name: string
  email: string
  emailVerified?: boolean
  role: Role
}

/**
 * Devuelve la sesión activa o lanza 401.
 * Se usa en cada endpoint protegido.
 */
export async function requireUser(event: H3Event) {
  const auth = useAuth()
  const headers = new Headers()

  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (value) headers.set(key, value)
  }

  const session = await auth.api.getSession({ headers })

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const raw = session.user as {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    role?: string
  }
  const role: Role = raw.role === 'admin' || raw.role === 'manager' ? raw.role : 'employee'

  return {
    user: {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      emailVerified: Boolean(raw.emailVerified),
      role,
    },
    session: { id: session.session.id, userId: session.session.userId },
  }
}

export async function requireRole(event: H3Event, roles: Role[]) {
  const session = await requireUser(event)
  if (!roles.includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos para esta acción' })
  }
  return session
}

export function isManagerOrAdmin(role: Role) {
  return role === 'admin' || role === 'manager'
}
