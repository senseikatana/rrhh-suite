import {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
  numeric,
  jsonb,
  date,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'employee'])
export const leaveStatusEnum = pgEnum('leave_status', [
  'draft',
  'pending',
  'approved',
  'rejected',
  'cancelled',
])
export const leaveUnitEnum = pgEnum('leave_unit', ['days', 'hours'])
export const holidayScopeEnum = pgEnum('holiday_scope', ['nacional', 'autonomico', 'local'])
export const overtimeTypeEnum = pgEnum('overtime_type', ['accrued', 'used', 'adjustment'])
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed'])
export const clockDirectionEnum = pgEnum('clock_direction', ['in', 'out'])
export const clockSourceEnum = pgEnum('clock_source', ['web', 'mobile', 'kiosk', 'fingerprint'])
export const expenseStatusEnum = pgEnum('expense_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'reimbursed',
])
export const payrollStatusEnum = pgEnum('payroll_status', ['open', 'closed'])
export const jobStatusEnum = pgEnum('job_status', ['draft', 'published', 'closed'])
export const candidateStageEnum = pgEnum('candidate_stage', [
  'new',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
])
export const whistleStatusEnum = pgEnum('whistle_status', ['new', 'in_review', 'resolved', 'closed'])
export const whistleAuthorEnum = pgEnum('whistle_author', ['reporter', 'company'])

/* Enums del módulo ERP (migrados desde SQLAlchemy). */

/** Roles de la aplicación ERP. Coarse a propósito: compras, logística, calidad y admin. */
export const erpRoleEnum = pgEnum('erp_role', ['admin', 'buyer', 'logistics', 'quality'])
export const salesOrderStatusEnum = pgEnum('sales_order_status', [
  'OPEN',
  'PICKING',
  'SHIPPED',
  'INVOICED',
  'CANCELLED',
])
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'OPEN',
  'RECEIVED',
  'QC_PENDING',
  'QC_APPROVED',
  'REJECTED',
  'CLOSED',
])
export const qualityStatusEnum = pgEnum('quality_status', ['PENDING', 'PASSED', 'FAILED'])
export const demandSourceEnum = pgEnum('demand_source', ['SALES_ORDER', 'MIN_STOCK', 'FORECAST'])
export const demandActionEnum = pgEnum('demand_action', ['PENDING', 'ORDERED', 'IGNORED'])
export const routeStatusEnum = pgEnum('route_status', ['PLANNED', 'IN_TRANSIT', 'DELIVERED'])

/* ------------------------------------------------------------------ */
/* Autenticación (better-auth)                                        */
/* ------------------------------------------------------------------ */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('employee'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

/* Relaciones de autenticación. Necesarias para activar las "joins" del
   adaptador Drizzle de Better Auth (`advanced.database.joins`), que usa
   `db.query[model].findMany({ with })` en lugar de varias consultas sueltas. */

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

/* ------------------------------------------------------------------ */
/* Núcleo de la organización                                          */
/* ------------------------------------------------------------------ */

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull().default('Europe/Madrid'),

  /* Campos de empresa aportados por el módulo ERP (ex modelo Company). */
  currency: text('currency').notNull().default('EUR'),
  locale: text('locale').notNull().default('es_ES'),
  defaultLanguage: text('defaultLanguage').notNull().default('es'),
  logoPath: text('logoPath').notNull().default(''),
  /** Si es true, la mercancía recibida queda en QC_PENDING hasta que Calidad la apruebe. */
  qualityCheckRequired: boolean('qualityCheckRequired').notNull().default(true),
  /** Módulos visibles para esta empresa. */
  modulesEnabled: jsonb('modulesEnabled')
    .notNull()
    .default(['dashboard', 'sales', 'purchases', 'warehouse', 'demand', 'routes']),

  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
})

/** Configuración flexible por empresa (JSON en value). */
export const settings = pgTable(
  'settings',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('settings_org_key_uq').on(t.orgId, t.key)],
)

export const departments = pgTable(
  'departments',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#0ea5e9'),
    /** Personas mínimas que deben seguir trabajando cuando alguien coge vacaciones. */
    minCoverage: integer('minCoverage').notNull().default(0),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('departments_org_name_uq').on(t.orgId, t.name)],
)

export const employees = pgTable(
  'employees',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    departmentId: text('departmentId').references(() => departments.id, { onDelete: 'set null' }),
    userId: text('userId').references(() => user.id, { onDelete: 'set null' }),
    firstName: text('firstName').notNull(),
    lastName: text('lastName').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    /** PIN único de 4-6 dígitos para fichaje. */
    pin: text('pin').unique(),
    position: text('position'),
    startDate: text('startDate').notNull(),
    endDate: text('endDate'),
    weeklyHours: doublePrecision('weeklyHours').notNull().default(40),
    /** Horario contractual del empleado (HH:mm). Si es null, usa el de la empresa. */
    scheduleStart: text('scheduleStart'),
    scheduleEnd: text('scheduleEnd'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('employees_org_idx').on(t.orgId),
    index('employees_department_idx').on(t.departmentId),
    uniqueIndex('employees_org_email_uq').on(t.orgId, t.email),
  ],
)

export const contracts = pgTable(
  'contracts',
  {
    id: text('id').primaryKey(),
    employeeId: text('employeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('indefinido'),
    startDate: text('startDate').notNull(),
    endDate: text('endDate'),
    weeklyHours: doublePrecision('weeklyHours').notNull().default(40),
    convenio: text('convenio'),
    notes: text('notes'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  },
  (t) => [index('contracts_employee_idx').on(t.employeeId)],
)

export const holidays = pgTable(
  'holidays',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    name: text('name').notNull(),
    scope: holidayScopeEnum('scope').notNull().default('nacional'),
    year: integer('year').notNull(),
  },
  (t) => [
    uniqueIndex('holidays_org_date_uq').on(t.orgId, t.date),
    index('holidays_year_idx').on(t.orgId, t.year),
  ],
)

/* ------------------------------------------------------------------ */
/* Vacaciones y ausencias                                             */
/* ------------------------------------------------------------------ */

export const leaveTypes = pgTable(
  'leave_types',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#22c55e'),
    paid: boolean('paid').notNull().default(true),
    requiresApproval: boolean('requiresApproval').notNull().default(true),
    countsAgainstBalance: boolean('countsAgainstBalance').notNull().default(true),
    unit: leaveUnitEnum('unit').notNull().default('days'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('leave_types_org_code_uq').on(t.orgId, t.code)],
)

export const leaveEntitlements = pgTable(
  'leave_entitlements',
  {
    id: text('id').primaryKey(),
    employeeId: text('employeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leaveTypeId: text('leaveTypeId')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    entitledDays: doublePrecision('entitledDays').notNull().default(0),
    carriedOverDays: doublePrecision('carriedOverDays').notNull().default(0),
    adjustmentDays: doublePrecision('adjustmentDays').notNull().default(0),
    notes: text('notes'),
  },
  (t) => [
    uniqueIndex('leave_entitlements_uq').on(t.employeeId, t.leaveTypeId, t.year),
    index('leave_entitlements_year_idx').on(t.year),
  ],
)

export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    employeeId: text('employeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leaveTypeId: text('leaveTypeId')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'restrict' }),
    startDate: text('startDate').notNull(),
    endDate: text('endDate').notNull(),
    /** Días laborables o naturales según la configuración de la empresa. */
    days: doublePrecision('days').notNull(),
    status: leaveStatusEnum('status').notNull().default('pending'),
    reason: text('reason'),
    attachmentPath: text('attachmentPath'),
    decidedBy: text('decidedBy').references(() => employees.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decidedAt', { withTimezone: true }),
    decisionNote: text('decisionNote'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('leave_requests_employee_idx').on(t.employeeId),
    index('leave_requests_status_idx').on(t.orgId, t.status),
    index('leave_requests_dates_idx').on(t.orgId, t.startDate, t.endDate),
  ],
)

export const overtimeLedger = pgTable(
  'overtime_ledger',
  {
    id: text('id').primaryKey(),
    employeeId: text('employeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    hours: doublePrecision('hours').notNull(),
    type: overtimeTypeEnum('type').notNull(),
    note: text('note'),
    leaveRequestId: text('leaveRequestId').references(() => leaveRequests.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  },
  (t) => [index('overtime_employee_idx').on(t.employeeId)],
)

export const approvalRules = pgTable(
  'approval_rules',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** null = regla por defecto para toda la empresa. */
    departmentId: text('departmentId').references(() => departments.id, { onDelete: 'cascade' }),
    approverEmployeeId: text('approverEmployeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    level: integer('level').notNull().default(1),
  },
  (t) => [uniqueIndex('approval_rules_uq').on(t.orgId, t.departmentId, t.level)],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId'),
    actorUserId: text('actorUserId'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entityId'),
    before: text('before'),
    after: text('after'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  },
  (t) => [index('audit_entity_idx').on(t.entity, t.entityId)],
)

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    employeeId: text('employeeId').references(() => employees.id, { onDelete: 'cascade' }),
    email: text('email'),
    type: text('type').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: notificationStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    error: text('error'),
    scheduledAt: timestamp('scheduledAt', { withTimezone: true }).notNull(),
    sentAt: timestamp('sentAt', { withTimezone: true }),
  },
  (t) => [index('notifications_status_idx').on(t.status, t.scheduledAt)],
)

/* ------------------------------------------------------------------ */
/* Control horario y turnos (F2)                                      */
/* ------------------------------------------------------------------ */

export const clockEvents = pgTable(
  'clock_events',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    employeeId: text('employeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurredAt', { withTimezone: true }).notNull(),
    direction: clockDirectionEnum('direction').notNull(),
    source: clockSourceEnum('source').notNull().default('web'),
    ip: text('ip'),
    userAgent: text('userAgent'),
    corrected: boolean('corrected').notNull().default(false),
    note: text('note'),
  },
  (t) => [
    index('clock_employee_date_idx').on(t.employeeId, t.occurredAt),
    index('clock_org_date_idx').on(t.orgId, t.occurredAt),
  ],
)

export const shiftPatterns = pgTable('shift_patterns', {
  id: text('id').primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startTime: text('startTime').notNull(),
  endTime: text('endTime').notNull(),
  color: text('color').notNull().default('#6366f1'),
  departmentId: text('departmentId').references(() => departments.id, { onDelete: 'set null' }),
})

export const shiftAssignments = pgTable(
  'shift_assignments',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    employeeId: text('employeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    patternId: text('patternId').references(() => shiftPatterns.id, { onDelete: 'set null' }),
    startTime: text('startTime'),
    endTime: text('endTime'),
    notes: text('notes'),
  },
  (t) => [uniqueIndex('shift_assignments_uq').on(t.employeeId, t.date)],
)

/* ------------------------------------------------------------------ */
/* Gastos (F3)                                                        */
/* ------------------------------------------------------------------ */

export const expenseReports = pgTable('expense_reports', {
  id: text('id').primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: text('employeeId')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  status: expenseStatusEnum('status').notNull().default('draft'),
  total: doublePrecision('total').notNull().default(0),
  notes: text('notes'),
  submittedAt: timestamp('submittedAt', { withTimezone: true }),
  approvedBy: text('approvedBy').references(() => employees.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approvedAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
})

export const expenseLines = pgTable(
  'expense_lines',
  {
    id: text('id').primaryKey(),
    reportId: text('reportId')
      .notNull()
      .references(() => expenseReports.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    amount: doublePrecision('amount').notNull(),
    tax: doublePrecision('tax').notNull().default(0),
    attachmentPath: text('attachmentPath'),
  },
  (t) => [index('expense_lines_report_idx').on(t.reportId)],
)

/* ------------------------------------------------------------------ */
/* Nóminas (F3)                                                       */
/* ------------------------------------------------------------------ */

export const payrollPeriods = pgTable(
  'payroll_periods',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    status: payrollStatusEnum('status').notNull().default('open'),
  },
  (t) => [uniqueIndex('payroll_periods_uq').on(t.orgId, t.year, t.month)],
)

export const payslips = pgTable(
  'payslips',
  {
    id: text('id').primaryKey(),
    periodId: text('periodId')
      .notNull()
      .references(() => payrollPeriods.id, { onDelete: 'cascade' }),
    employeeId: text('employeeId')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    gross: doublePrecision('gross').notNull().default(0),
    net: doublePrecision('net').notNull().default(0),
    filePath: text('filePath'),
    departmentId: text('departmentId').references(() => departments.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('payslips_uq').on(t.periodId, t.employeeId)],
)

/* ------------------------------------------------------------------ */
/* Reclutamiento (F4)                                                 */
/* ------------------------------------------------------------------ */

export const jobPostings = pgTable('job_postings', {
  id: text('id').primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  departmentId: text('departmentId').references(() => departments.id, { onDelete: 'set null' }),
  status: jobStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('publishedAt', { withTimezone: true }),
  closesAt: text('closesAt'),
})

export const candidates = pgTable('candidates', {
  id: text('id').primaryKey(),
  jobPostingId: text('jobPostingId')
    .notNull()
    .references(() => jobPostings.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  cvPath: text('cvPath'),
  stage: candidateStageEnum('stage').notNull().default('new'),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
})

/* ------------------------------------------------------------------ */
/* Canal de denuncias (F4)                                            */
/* ------------------------------------------------------------------ */

export const whistleReports = pgTable('whistle_reports', {
  id: text('id').primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  trackingCode: text('trackingCode').notNull().unique(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  status: whistleStatusEnum('status').notNull().default('new'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
})

export const whistleMessages = pgTable(
  'whistle_messages',
  {
    id: text('id').primaryKey(),
    reportId: text('reportId')
      .notNull()
      .references(() => whistleReports.id, { onDelete: 'cascade' }),
    authorType: whistleAuthorEnum('authorType').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  },
  (t) => [index('whistle_messages_report_idx').on(t.reportId)],
)

/* ================================================================== */
/* Módulo ERP (migrado desde FastAPI + SQLAlchemy)                     */
/* Multi-tenant: cada fila va ligada a una organización (ex company).   */
/* ================================================================== */

/** Concesión que liga un usuario con una organización en la que puede operar. */
export const userCompanyAccess = pgTable(
  'user_company_access',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: erpRoleEnum('role').notNull().default('buyer'),
  },
  (t) => [
    uniqueIndex('uq_user_company').on(t.userId, t.orgId),
    index('user_company_access_org_idx').on(t.orgId),
  ],
)

/** Clientes. */
export const erpCustomers = pgTable(
  'erp_customers',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    city: text('city'),
    postalCode: text('postalCode'),
    country: text('country').notNull().default('Spain'),
    taxId: text('taxId'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('erp_customers_org_idx').on(t.orgId),
    uniqueIndex('erp_customers_org_code_uq').on(t.orgId, t.code),
  ],
)

/** Proveedores. */
export const erpVendors = pgTable(
  'erp_vendors',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    /** Lead time de planificación para la hoja de demanda. */
    leadTimeDays: integer('leadTimeDays').notNull().default(7),
    qualityRating: doublePrecision('qualityRating').notNull().default(5),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('erp_vendors_org_idx').on(t.orgId),
    uniqueIndex('erp_vendors_org_code_uq').on(t.orgId, t.code),
  ],
)

/**
 * Partidas monetarias y de cantidad.
 * Money fija 2 decimales, Quantity 3: los floats binarios descuadran céntimos.
 */
export const money = numeric('money', { precision: 14, scale: 2 })
export const quantity = numeric('quantity', { precision: 14, scale: 3 })

/** Artículos de inventario. */
export const erpItems = pgTable(
  'erp_items',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    description: text('description').notNull(),
    unit: text('unit').notNull().default('EA'),
    unitCost: numeric('unitCost', { precision: 14, scale: 2 }).notNull().default('0'),
    unitPrice: numeric('unitPrice', { precision: 14, scale: 2 }).notNull().default('0'),
    stock: numeric('stock', { precision: 14, scale: 3 }).notNull().default('0'),
    minStock: numeric('minStock', { precision: 14, scale: 3 }).notNull().default('0'),
    location: text('location').notNull().default('A-01'),
    category: text('category'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('erp_items_org_idx').on(t.orgId),
    index('erp_items_location_idx').on(t.orgId, t.location),
    uniqueIndex('erp_items_org_code_uq').on(t.orgId, t.code),
  ],
)

/** Pedidos de venta. OPEN -> PICKING -> SHIPPED -> INVOICED. */
export const erpSalesOrders = pgTable(
  'erp_sales_orders',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    customerId: text('customerId')
      .notNull()
      .references(() => erpCustomers.id),
    orderDate: date('orderDate').notNull(),
    deliveryDate: date('deliveryDate'),
    status: salesOrderStatusEnum('status').notNull().default('OPEN'),
    total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('erp_sales_orders_org_idx').on(t.orgId),
    index('erp_sales_orders_status_idx').on(t.orgId, t.status),
    uniqueIndex('erp_sales_orders_org_number_uq').on(t.orgId, t.number),
  ],
)

/** Líneas de pedido de venta. */
export const erpSalesOrderLines = pgTable(
  'erp_sales_order_lines',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId')
      .notNull()
      .references(() => erpSalesOrders.id, { onDelete: 'cascade' }),
    itemId: text('itemId')
      .notNull()
      .references(() => erpItems.id),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull().default('1'),
    unitPrice: numeric('unitPrice', { precision: 14, scale: 2 }).notNull().default('0'),
    qtyPicked: numeric('qtyPicked', { precision: 14, scale: 3 }).notNull().default('0'),
    qtyShipped: numeric('qtyShipped', { precision: 14, scale: 3 }).notNull().default('0'),
  },
  (t) => [
    index('erp_sales_order_lines_order_idx').on(t.orderId),
    index('erp_sales_order_lines_item_idx').on(t.itemId),
  ],
)

/**
 * Pedidos de compra. OPEN -> RECEIVED -> QC_PENDING -> QC_APPROVED -> CLOSED.
 * Un rechazo devuelve la orden a OPEN para que el proveedor la retrabaje.
 */
export const erpPurchaseOrders = pgTable(
  'erp_purchase_orders',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    vendorId: text('vendorId')
      .notNull()
      .references(() => erpVendors.id),
    orderDate: date('orderDate').notNull(),
    expectedDate: date('expectedDate'),
    status: purchaseOrderStatusEnum('status').notNull().default('OPEN'),
    total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('erp_purchase_orders_org_idx').on(t.orgId),
    index('erp_purchase_orders_status_idx').on(t.orgId, t.status),
    uniqueIndex('erp_purchase_orders_org_number_uq').on(t.orgId, t.number),
  ],
)

/** Líneas de pedido de compra con la puerta de control de calidad. */
export const erpPurchaseOrderLines = pgTable(
  'erp_purchase_order_lines',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId')
      .notNull()
      .references(() => erpPurchaseOrders.id, { onDelete: 'cascade' }),
    itemId: text('itemId')
      .notNull()
      .references(() => erpItems.id),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull().default('1'),
    unitCost: numeric('unitCost', { precision: 14, scale: 2 }).notNull().default('0'),
    qtyReceived: numeric('qtyReceived', { precision: 14, scale: 3 }).notNull().default('0'),
    qcStatus: qualityStatusEnum('qcStatus').notNull().default('PENDING'),
    /** Marca si la cantidad recibida ya se ha volcado al stock (evita doble conteo). */
    stockPosted: boolean('stockPosted').notNull().default(false),
  },
  (t) => [
    index('erp_purchase_order_lines_order_idx').on(t.orderId),
    index('erp_purchase_order_lines_item_idx').on(t.itemId),
  ],
)

/**
 * Líneas de la hoja de demanda (datos derivados).
 * Se reconstruyen desde pedidos de venta y stock mínimo, no se editan a mano.
 */
export const erpDemandLines = pgTable(
  'erp_demand_lines',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    itemId: text('itemId')
      .notNull()
      .references(() => erpItems.id),
    requiredDate: date('requiredDate').notNull(),
    quantityNeeded: numeric('quantityNeeded', { precision: 14, scale: 3 }).notNull().default('0'),
    source: demandSourceEnum('source').notNull(),
    action: demandActionEnum('action').notNull().default('PENDING'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('erp_demand_lines_org_idx').on(t.orgId),
    index('erp_demand_lines_item_idx').on(t.itemId),
    index('erp_demand_lines_action_idx').on(t.orgId, t.action),
  ],
)

/** Rutas de transporte. */
export const erpRoutes = pgTable(
  'erp_routes',
  {
    id: text('id').primaryKey(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    carrier: text('carrier').notNull(),
    date: date('date').notNull(),
    status: routeStatusEnum('status').notNull().default('PLANNED'),
    stops: integer('stops').notNull().default(0),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('erp_routes_org_idx').on(t.orgId),
    index('erp_routes_date_idx').on(t.orgId, t.date),
    uniqueIndex('erp_routes_org_code_uq').on(t.orgId, t.code),
  ],
)

/**
 * Log de eventos append-only (auditoría + KPIs).
 * Sin updated_at a propósito: los contadores dicen "cuánto" pero no "cuándo".
 * payload guarda el detalle como JSON para no ensanchar el esquema con cada campo.
 */
export const erpActivityEvents = pgTable(
  'erp_activity_events',
  {
    id: text('id').primaryKey(),
    occurredAt: timestamp('occurredAt', { withTimezone: true }).notNull(),
    orgId: text('orgId')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Actor desnormalizado: el histórico debe seguir mostrando quién hizo el trabajo. */
    actorId: text('actorId').references(() => user.id, { onDelete: 'set null' }),
    actorUsername: text('actorUsername').notNull(),
    /** p.ej. "sales_order", "purchase_order", "item". */
    entity: text('entity').notNull(),
    entityId: text('entityId'),
    /** p.ej. "created", "status_changed", "received", "qc_approved". */
    action: text('action').notNull(),
    summary: text('summary'),
    payload: jsonb('payload'),
  },
  (t) => [
    index('ix_activity_company_time').on(t.orgId, t.occurredAt),
    index('ix_activity_entity_action_time').on(t.entity, t.action, t.occurredAt),
  ],
)

/* Relaciones del módulo ERP (para joins de Better Auth y consultas Drizzle). */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(userCompanyAccess),
  customers: many(erpCustomers),
  vendors: many(erpVendors),
  items: many(erpItems),
  salesOrders: many(erpSalesOrders),
  purchaseOrders: many(erpPurchaseOrders),
  demandLines: many(erpDemandLines),
  routes: many(erpRoutes),
  activityEvents: many(erpActivityEvents),
}))

export const userCompanyAccessRelations = relations(userCompanyAccess, ({ one }) => ({
  user: one(user, {
    fields: [userCompanyAccess.userId],
    references: [user.id],
  }),
  organization: one(organizations, {
    fields: [userCompanyAccess.orgId],
    references: [organizations.id],
  }),
}))

export const erpCustomersRelations = relations(erpCustomers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [erpCustomers.orgId],
    references: [organizations.id],
  }),
  orders: many(erpSalesOrders),
}))

export const erpVendorsRelations = relations(erpVendors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [erpVendors.orgId],
    references: [organizations.id],
  }),
  orders: many(erpPurchaseOrders),
}))

export const erpItemsRelations = relations(erpItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [erpItems.orgId],
    references: [organizations.id],
  }),
}))

export const erpSalesOrdersRelations = relations(erpSalesOrders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [erpSalesOrders.orgId],
    references: [organizations.id],
  }),
  customer: one(erpCustomers, {
    fields: [erpSalesOrders.customerId],
    references: [erpCustomers.id],
  }),
  lines: many(erpSalesOrderLines),
}))

export const erpSalesOrderLinesRelations = relations(erpSalesOrderLines, ({ one }) => ({
  order: one(erpSalesOrders, {
    fields: [erpSalesOrderLines.orderId],
    references: [erpSalesOrders.id],
  }),
  item: one(erpItems, {
    fields: [erpSalesOrderLines.itemId],
    references: [erpItems.id],
  }),
}))

export const erpPurchaseOrdersRelations = relations(erpPurchaseOrders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [erpPurchaseOrders.orgId],
    references: [organizations.id],
  }),
  vendor: one(erpVendors, {
    fields: [erpPurchaseOrders.vendorId],
    references: [erpVendors.id],
  }),
  lines: many(erpPurchaseOrderLines),
}))

export const erpPurchaseOrderLinesRelations = relations(erpPurchaseOrderLines, ({ one }) => ({
  order: one(erpPurchaseOrders, {
    fields: [erpPurchaseOrderLines.orderId],
    references: [erpPurchaseOrders.id],
  }),
  item: one(erpItems, {
    fields: [erpPurchaseOrderLines.itemId],
    references: [erpItems.id],
  }),
}))

export const erpDemandLinesRelations = relations(erpDemandLines, ({ one }) => ({
  organization: one(organizations, {
    fields: [erpDemandLines.orgId],
    references: [organizations.id],
  }),
  item: one(erpItems, {
    fields: [erpDemandLines.itemId],
    references: [erpItems.id],
  }),
}))

export const erpRoutesRelations = relations(erpRoutes, ({ one }) => ({
  organization: one(organizations, {
    fields: [erpRoutes.orgId],
    references: [organizations.id],
  }),
}))

export const erpActivityEventsRelations = relations(erpActivityEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [erpActivityEvents.orgId],
    references: [organizations.id],
  }),
  actor: one(user, {
    fields: [erpActivityEvents.actorId],
    references: [user.id],
  }),
}))
