import { describe, expect, it } from 'vitest'
import {
  canTransition,
  TransitionError,
} from '../../server/services/erp-sales'
import {
  assertAllowed,
  WorkflowError,
} from '../../server/services/erp-purchasing'

/**
 * Tests de la lógica de negocio ERP: máquina de estados de ventas y
 * permisos por rol de compras. Son funciones puras, sin DB.
 */

describe('sales · máquina de estados', () => {
  it('permite el flujo feliz OPEN → PICKING → SHIPPED → INVOICED', () => {
    expect(canTransition('OPEN', 'PICKING', 'logistics').allowed).toBe(true)
    expect(canTransition('PICKING', 'SHIPPED', 'logistics').allowed).toBe(true)
    expect(canTransition('SHIPPED', 'INVOICED', 'admin').allowed).toBe(true)
  })

  it('solo admin puede reabrir de PICKING a OPEN; cualquiera con permiso cancela desde OPEN', () => {
    // El grafo permite PICKING → OPEN, pero mover a OPEN es solo-admin
    // (ROLE_PERMISSIONS.OPEN = ['admin']), fiel al backend original.
    expect(canTransition('PICKING', 'OPEN', 'admin').allowed).toBe(true)
    expect(canTransition('PICKING', 'OPEN', 'logistics').allowed).toBe(false)
    expect(canTransition('OPEN', 'CANCELLED', 'admin').allowed).toBe(true)
  })

  it('rechaza saltos fuera del grafo', () => {
    // OPEN → INVOICED sin pasar por PICKING/SHIPPED.
    const r = canTransition('OPEN', 'INVOICED', 'admin')
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('Cannot move an order from OPEN to INVOICED')
  })

  it('rechaza transiciones desde estados terminales', () => {
    expect(canTransition('INVOICED', 'OPEN', 'admin').allowed).toBe(false)
    expect(canTransition('CANCELLED', 'OPEN', 'admin').allowed).toBe(false)
  })

  it('aplica permisos por rol: quality no puede enviar', () => {
    // El grafo permite PICKING → SHIPPED, pero el rol no.
    const r = canTransition('PICKING', 'SHIPPED', 'quality')
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('cannot set status SHIPPED')
  })

  it('solo admin factura (INVOICED)', () => {
    expect(canTransition('SHIPPED', 'INVOICED', 'admin').allowed).toBe(true)
    expect(canTransition('SHIPPED', 'INVOICED', 'logistics').allowed).toBe(false)
  })

  it('compras (buyer) no sirve pedidos de venta', () => {
    expect(canTransition('OPEN', 'PICKING', 'buyer').allowed).toBe(false)
    expect(canTransition('PICKING', 'SHIPPED', 'buyer').allowed).toBe(false)
  })
})

describe('purchases · permisos por rol', () => {
  it('compras y admin abren pedidos', () => {
    expect(() => assertAllowed('OPEN', 'buyer')).not.toThrow()
    expect(() => assertAllowed('OPEN', 'admin')).not.toThrow()
  })

  it('logística recibe; quality decide calidad', () => {
    expect(() => assertAllowed('RECEIVED', 'logistics')).not.toThrow()
    expect(() => assertAllowed('QC_PENDING', 'quality')).not.toThrow()
  })

  it('rechaza un rol no autorizado con mensaje claro', () => {
    // quality no puede abrir pedidos.
    expect(() => assertAllowed('OPEN', 'quality')).toThrow(WorkflowError)
    expect(() => assertAllowed('OPEN', 'quality')).toThrow(
      /Role 'quality' cannot set status OPEN/,
    )
  })

  it('logística no aprueba calidad', () => {
    expect(() => assertAllowed('QC_PENDING', 'logistics')).toThrow(WorkflowError)
  })

  it('solo admin cierra (CLOSED) y aprueba QC (QC_APPROVED)', () => {
    expect(() => assertAllowed('CLOSED', 'admin')).not.toThrow()
    expect(() => assertAllowed('CLOSED', 'buyer')).toThrow(WorkflowError)
    expect(() => assertAllowed('QC_APPROVED', 'admin')).not.toThrow()
    expect(() => assertAllowed('QC_APPROVED', 'quality')).toThrow(WorkflowError)
  })
})

describe('tipos de error del workflow', () => {
  it('TransitionError y WorkflowError son Error', () => {
    expect(new TransitionError('x')).toBeInstanceOf(Error)
    expect(new WorkflowError('x')).toBeInstanceOf(Error)
  })
})
