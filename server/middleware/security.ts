/**
 * Cabeceras de seguridad y protección CSRF por Origin.
 *
 * - L-4: cabeceras fijas (X-Frame-Options, CSP frame-ancestors, nosniff,
 *   Referrer-Policy) contra clickjacking y sniffing.
 * - L-1: en mutaciones (todo menos GET/HEAD/OPTIONS) se compara el `Origin`
 *   (o `Referer`) contra el host propio. Es la segunda capa junto al `SameSite`
 *   de las cookies: si un browser laxo o un cambio en la config de cookies
 *   rompiera esa primera barrera, esta corta el request cross-site.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "frame-ancestors 'none'",
  })

  const method = event.method.toUpperCase()
  if (SAFE_METHODS.has(method)) return

  // En same-origin puede no llegar Origin (peticiones de mismo origen a veces
  // solo mandan Referer). Se acepta cuando coincide con el host propio.
  const host = getRequestHeader(event, 'host')
  if (!host) return

  const origin = getRequestHeader(event, 'origin') || getRequestHeader(event, 'referer')
  if (!origin) return

  let originHost: string | null = null
  try {
    originHost = new URL(origin).host
  } catch {
    originHost = null
  }

  if (originHost !== host) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request rejected' })
  }
})
