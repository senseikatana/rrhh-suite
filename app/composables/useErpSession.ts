import type { ErpRole } from '~/types/erp'

interface ErpCompany {
  code: string
  name: string
  currency: string
  locale: string
  default_language: string
  quality_check_required: boolean
  modules_enabled: string[]
}

interface ErpMe {
  user: { id: string; name: string; email: string; role: string }
  companies: ErpCompany[]
  roles: { orgId: string; role: ErpRole }[]
}

/**
 * Sesión de la capa ERP.
 *
 * Resuelve el usuario, sus empresas y el rol ERP por organización desde
 * `/api/erp/me`. El rol ERP (admin/buyer/logistics/quality) es distinto del rol
 * de Better Auth y es el que gobierna la visibilidad de módulos y acciones.
 *
 * Estos checks son de navegación. La API es la frontera de seguridad: cada
 * endpoint re-valida el rol en el servidor.
 */
export function useErpSession() {
  const me = useState<ErpMe | null>('erp-me', () => null)
  const loaded = useState<boolean>('erp-me-loaded', () => false)
  const activeOrg = useState<string | null>('erp-active-org', () => null)
  // useRequestFetch reenvía cookies y funciona durante SSR; $fetch puro no.
  const requestFetch = useRequestFetch()

  async function refresh() {
    try {
      const res = await requestFetch<ErpMe>('/api/erp/me')
      me.value = res
      if (!activeOrg.value && res.companies.length) {
        activeOrg.value = res.companies[0]!.code
      }
    } catch {
      me.value = null
    } finally {
      loaded.value = true
    }
    return me.value
  }

  /** Rol ERP del usuario en la organización activa. */
  const role = computed<ErpRole | null>(() => {
    if (!me.value || !activeOrg.value) return null
    return me.value.roles.find((r) => r.orgId === activeOrg.value)?.role ?? null
  })

  const company = computed(() =>
    me.value?.companies.find((c) => c.code === activeOrg.value) ?? null,
  )

  function hasRole(...roles: ErpRole[]): boolean {
    return role.value ? roles.includes(role.value) : false
  }

  /** Visibilidad de módulos por rol. */
  const navigation = computed(() => {
    const current = role.value
    const all: { key: string; to: string; label: string; roles: ErpRole[] }[] = [
      { key: 'dashboard', to: '/erp', label: 'Panel', roles: ['admin', 'buyer', 'logistics', 'quality'] },
      { key: 'sales', to: '/erp/sales', label: 'Ventas', roles: ['admin', 'buyer', 'logistics'] },
      { key: 'purchases', to: '/erp/purchases', label: 'Compras', roles: ['admin', 'buyer', 'logistics', 'quality'] },
      { key: 'warehouse', to: '/erp/warehouse', label: 'Almacén', roles: ['admin', 'logistics'] },
      { key: 'demand', to: '/erp/demand', label: 'Demanda', roles: ['admin', 'buyer'] },
      { key: 'routes', to: '/erp/routes', label: 'Rutas', roles: ['admin', 'logistics'] },
      { key: 'activity', to: '/erp/activity', label: 'Actividad', roles: ['admin', 'buyer', 'logistics', 'quality'] },
    ]
    if (!current) return []
    return all.filter((entry) => entry.roles.includes(current))
  })

  return { me, loaded, activeOrg, role, company, navigation, refresh, hasRole }
}
