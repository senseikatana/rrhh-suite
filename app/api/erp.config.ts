import { defineApiConfig } from 'katanakit-js'

/**
 * Registro de la API ERP con katanakit-js.
 *
 * Los endpoints son las rutas Nitro same-origin de `server/api/erp/*`. El
 * cliente de katanakit-js devuelve siempre un `SafeResult` (`{ ok, data, error }`)
 * y nunca lanza en trabajo async, así el manejo de errores queda en el `if (ok)`.
 *
 * Los `:param` se rellenan desde `params` en cada llamada. El scoping por
 * organización viaja como query `org` (lo inyecta `useErpApi`).
 */
export default defineApiConfig({
  erp: {
    baseUri: '/api/erp',
    endpoints: {
      // Dashboard
      dashboardSummary: '/dashboard/summary',

      // Ventas
      salesOrders: '/sales/orders',
      salesOrder: '/sales/orders/:id',
      salesOrderStatus: '/sales/orders/:id/status',

      // Compras
      purchaseOrders: '/purchases/orders',
      purchaseOrder: '/purchases/orders/:id',
      purchaseReceive: '/purchases/orders/:id/receive',
      purchaseQuality: '/purchases/orders/:id/quality',

      // Almacén
      items: '/warehouse/items',
      item: '/warehouse/items/:id',
      itemAdjust: '/warehouse/items/:id/adjust',

      // Terceros
      customers: '/customers',
      customer: '/customers/:id',
      vendors: '/vendors',
      vendor: '/vendors/:id',

      // Planificación
      demand: '/demand',
      demandGenerate: '/demand/generate',
      routes: '/routes',

      // Actividad
      activity: '/activity',
    },
  },
})
