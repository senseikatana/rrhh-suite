/**
 * Formateo para la capa ERP.
 *
 * La moneda y el locale se derivan de la organización activa de la sesión ERP
 * (`useErpSession().company`). Antes se guardaban en estado suelto y había que
 * llamar `setCompanyCurrency` a mano: ningún componente lo hacía, así que todo
 * se formateaba en EUR/es-ES fuera de la moneda real de la empresa.
 */
export function useErpFormat() {
  const session = useErpSession()

  /** Moneda de la organización activa (EUR por defecto). */
  const currency = computed(() => session.company.value?.currency ?? 'EUR')
  /** Locale de la organización activa (es-ES por defecto). */
  const locale = computed(() => session.company.value?.locale ?? 'es-ES')

  /** Dinero con símbolo de moneda y 2 decimales. */
  function money(value: number | string | null | undefined): string {
    const n = Number(value ?? 0)
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currency.value,
      minimumFractionDigits: 2,
    }).format(n)
  }

  /** Número con separadores de miles. */
  function number(value: number | string | null | undefined, digits = 0): string {
    const n = Number(value ?? 0)
    return new Intl.NumberFormat(locale.value, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n)
  }

  /** Fecha y hora legibles. */
  function dateTime(value: string | null | undefined): string {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  }

  /** Fecha legible. */
  function date(value: string | null | undefined): string {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(d)
  }

  return { money, number, dateTime, date, currency, locale }
}
