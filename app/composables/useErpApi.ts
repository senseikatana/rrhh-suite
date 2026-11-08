import { useFetch, type FetchResult } from 'katanakit-js'
import '../api/erp.config'

/**
 * Cliente de la capa ERP sobre katanakit-js.
 *
 * Cada método devuelve un `SafeResult` tipado (`{ ok, data, error }`) y nunca
 * lanza: un fallo de red o un `409` de una transición inválida son resultados,
 * no excepciones. El componente decide con `if (result.ok)`.
 *
 * Se usa `useFetch` (y no `useGet`/`usePost`/…) porque es el único que acepta
 * `FetchOptions` (extiende `RequestInit`), donde caben `credentials`, `method`
 * y `body`. Los helpers `useGet`/`usePost` solo admiten `UrlOptions`
 * (`params`/`query`), sin `credentials`.
 *
 * La sesión viaja como cookie de better-auth, por eso `credentials: 'include'`.
 * El scoping por organización viaja como query `org`: cada fila de negocio está
 * acotada a una empresa y hacerlo explícito evita que una petición corra contra
 * "lo que usó la petición anterior".
 */
export function useErpApi() {
  const orgId = useState<string | null>('erp-active-org', () => null)

  function request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    options?: {
      params?: Record<string, string | number>
      query?: Record<string, unknown>
      body?: unknown
    },
  ): Promise<FetchResult<T>> {
    const hasBody = options?.body !== undefined && method !== 'GET' && method !== 'DELETE'
    return useFetch<T>('erp', endpoint, {
      method,
      params: options?.params,
      query: { ...(orgId.value ? { org: orgId.value } : {}), ...(options?.query ?? {}) },
      ...(hasBody
        ? {
            body: JSON.stringify(options!.body),
            headers: { 'Content-Type': 'application/json' },
          }
        : {}),
      credentials: 'include',
    })
  }

  return {
    orgId,

    /** Fija la organización activa para todas las llamadas siguientes. */
    setOrg(id: string | null) {
      orgId.value = id
    },

    get<T>(
      endpoint: string,
      options?: { params?: Record<string, string | number>; query?: Record<string, unknown> },
    ): Promise<FetchResult<T>> {
      return request<T>('GET', endpoint, options)
    },

    post<T>(
      endpoint: string,
      body?: unknown,
      options?: { params?: Record<string, string | number>; query?: Record<string, unknown> },
    ): Promise<FetchResult<T>> {
      return request<T>('POST', endpoint, { ...options, body })
    },

    patch<T>(
      endpoint: string,
      body?: unknown,
      options?: { params?: Record<string, string | number>; query?: Record<string, unknown> },
    ): Promise<FetchResult<T>> {
      return request<T>('PATCH', endpoint, { ...options, body })
    },

    del<T>(
      endpoint: string,
      options?: { params?: Record<string, string | number>; query?: Record<string, unknown> },
    ): Promise<FetchResult<T>> {
      return request<T>('DELETE', endpoint, options)
    },
  }
}
