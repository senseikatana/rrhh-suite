import { z } from 'zod'
import * as schema from '../database/schema'

/**
 * Esquemas de validación compartidos de la capa ERP.
 *
 * Validar en el boundary convierte una sorpresa de runtime (un `NaN` que llega
 * a `numeric`, un enum que revienta en Postgres) en un 400 claro. El módulo HR
 * ya usa zod; estos esquemas unifican el estilo en el ERP.
 */

/** Cuerpos de texto comunes. */
export const codeSchema = z.string().trim().min(1).max(60)
export const nameSchema = z.string().trim().min(1).max(120)
export const noteSchema = z.string().trim().max(500).nullable().optional()

/** Cantidades y precios: finitos y con signo acotado. */
export const positiveQuantity = z.number().finite().positive()
export const nonNegativeAmount = z.number().finite().min(0)

/** IDs: texto no vacío (UUIDs). */
export const idSchema = z.string().trim().min(1)

export const salesLineInput = z.object({
  itemId: idSchema,
  quantity: positiveQuantity,
  unitPrice: nonNegativeAmount,
})

export const salesOrderCreate = z.object({
  customerId: idSchema,
  deliveryDate: z.string().trim().min(1).nullable().optional(),
  notes: noteSchema,
  lines: z.array(salesLineInput).min(1),
})

export const salesStatusChange = z.object({
  status: z.enum(schema.erpSalesOrders.status.enumValues as [string, ...string[]]),
  note: noteSchema,
})

export const purchaseLineInput = z.object({
  itemId: idSchema,
  quantity: positiveQuantity,
  unitCost: nonNegativeAmount,
})

export const purchaseOrderCreate = z.object({
  vendorId: idSchema,
  expectedDate: z.string().trim().min(1).nullable().optional(),
  lines: z.array(purchaseLineInput).min(1),
})

export const receiptRequest = z.object({
  reference: noteSchema,
  lines: z
    .array(
      z.object({
        lineId: idSchema,
        quantityReceived: nonNegativeAmount,
      }),
    )
    .optional()
    .nullable(),
})

export const qualityDecision = z.object({
  passed: z.boolean(),
  note: noteSchema,
  lines: z
    .array(
      z.object({
        lineId: idSchema,
        status: z.enum(schema.qualityStatusEnum.enumValues as [string, ...string[]]),
      }),
    )
    .optional()
    .nullable(),
})

export const demandGenerate = z.object({
  coverageRatio: z.number().finite().min(0.1).max(10).default(1),
  horizonDays: z.number().int().min(1).max(365).default(30),
})

export const itemCreate = z.object({
  code: codeSchema,
  description: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(10).default('EA'),
  unitCost: nonNegativeAmount.default(0),
  unitPrice: nonNegativeAmount.default(0),
  stock: nonNegativeAmount.default(0),
  minStock: nonNegativeAmount.default(0),
  location: z.string().trim().max(20).default('A-01'),
  category: z.string().trim().max(50).nullable().optional(),
})

export const itemUpdate = itemCreate.partial()

export const stockAdjust = z.object({
  quantity: z.number().finite().refine((v) => v !== 0, 'must be non-zero'),
  reason: z.string().trim().min(1).max(500),
})

export const customerCreate = z.object({
  code: codeSchema,
  name: nameSchema,
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  postalCode: z.string().trim().max(10).nullable().optional(),
  country: z.string().trim().max(60).default('Spain'),
  taxId: z.string().trim().max(30).nullable().optional(),
})

export const customerUpdate = customerCreate.partial()

export const vendorCreate = z.object({
  code: codeSchema,
  name: nameSchema,
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  leadTimeDays: z.number().int().min(0).max(365).default(7),
  qualityRating: z.number().finite().min(0).max(10).default(5),
})

export const vendorUpdate = vendorCreate.partial()

export const routeCreate = z.object({
  code: codeSchema,
  carrier: z.string().trim().min(1).max(60),
  date: z.string().trim().min(1),
  status: z
    .enum(schema.routeStatusEnum.enumValues as [string, ...string[]])
    .default('PLANNED')
    .transform((v) => v as (typeof schema.routeStatusEnum.enumValues)[number]),
  stops: z.number().int().min(0).default(0),
})

/** Filtros de listado: enums y paginación acotados. */
export function enumFilter<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.enum(values), z.array(z.enum(values))])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional()
}

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Parsea y devuelve los datos o lanza un 400 con los errores de zod.
 * Uso: `const body = parseOrThrow(schema, await readBody(event))`.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(
  schemaToUse: T,
  input: unknown,
  label = 'Invalid payload',
): z.infer<T> {
  const result = schemaToUse.safeParse(input)
  if (!result.success) {
    const first = result.error.issues[0]
    const detail = first ? `${first.path.join('.') || 'value'}: ${first.message}` : 'invalid'
    throw createError({ statusCode: 400, statusMessage: `${label} — ${detail}` })
  }
  return result.data
}
