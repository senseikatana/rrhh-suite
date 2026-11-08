CREATE TYPE "public"."candidate_stage" AS ENUM('new', 'screening', 'interview', 'offer', 'hired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."clock_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."clock_source" AS ENUM('web', 'mobile', 'kiosk', 'fingerprint');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'reimbursed');--> statement-breakpoint
CREATE TYPE "public"."holiday_scope" AS ENUM('nacional', 'autonomico', 'local');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_unit" AS ENUM('days', 'hours');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."overtime_type" AS ENUM('accrued', 'used', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'employee');--> statement-breakpoint
CREATE TYPE "public"."whistle_author" AS ENUM('reporter', 'company');--> statement-breakpoint
CREATE TYPE "public"."whistle_status" AS ENUM('new', 'in_review', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"departmentId" text,
	"approverEmployeeId" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text,
	"actorUserId" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entityId" text,
	"before" text,
	"after" text,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"jobPostingId" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"cvPath" text,
	"stage" "candidate_stage" DEFAULT 'new' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clock_events" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"employeeId" text NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"direction" "clock_direction" NOT NULL,
	"source" "clock_source" DEFAULT 'web' NOT NULL,
	"ip" text,
	"userAgent" text,
	"corrected" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"employeeId" text NOT NULL,
	"type" text DEFAULT 'indefinido' NOT NULL,
	"startDate" text NOT NULL,
	"endDate" text,
	"weeklyHours" double precision DEFAULT 40 NOT NULL,
	"convenio" text,
	"notes" text,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#0ea5e9' NOT NULL,
	"minCoverage" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"departmentId" text,
	"userId" text,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"pin" text,
	"position" text,
	"startDate" text NOT NULL,
	"endDate" text,
	"weeklyHours" double precision DEFAULT 40 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "employees_pin_unique" UNIQUE("pin")
);
--> statement-breakpoint
CREATE TABLE "expense_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"reportId" text NOT NULL,
	"date" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"amount" double precision NOT NULL,
	"tax" double precision DEFAULT 0 NOT NULL,
	"attachmentPath" text
);
--> statement-breakpoint
CREATE TABLE "expense_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"employeeId" text NOT NULL,
	"status" "expense_status" DEFAULT 'draft' NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"submittedAt" timestamp with time zone,
	"approvedBy" text,
	"approvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"scope" "holiday_scope" DEFAULT 'nacional' NOT NULL,
	"year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"departmentId" text,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"publishedAt" timestamp with time zone,
	"closesAt" text
);
--> statement-breakpoint
CREATE TABLE "leave_entitlements" (
	"id" text PRIMARY KEY NOT NULL,
	"employeeId" text NOT NULL,
	"leaveTypeId" text NOT NULL,
	"year" integer NOT NULL,
	"entitledDays" double precision DEFAULT 0 NOT NULL,
	"carriedOverDays" double precision DEFAULT 0 NOT NULL,
	"adjustmentDays" double precision DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"employeeId" text NOT NULL,
	"leaveTypeId" text NOT NULL,
	"startDate" text NOT NULL,
	"endDate" text NOT NULL,
	"days" double precision NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"attachmentPath" text,
	"decidedBy" text,
	"decidedAt" timestamp with time zone,
	"decisionNote" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#22c55e' NOT NULL,
	"paid" boolean DEFAULT true NOT NULL,
	"requiresApproval" boolean DEFAULT true NOT NULL,
	"countsAgainstBalance" boolean DEFAULT true NOT NULL,
	"unit" "leave_unit" DEFAULT 'days' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"employeeId" text,
	"email" text,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"scheduledAt" timestamp with time zone NOT NULL,
	"sentAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "overtime_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"employeeId" text NOT NULL,
	"date" text NOT NULL,
	"hours" double precision NOT NULL,
	"type" "overtime_type" NOT NULL,
	"note" text,
	"leaveRequestId" text,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" "payroll_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" text PRIMARY KEY NOT NULL,
	"periodId" text NOT NULL,
	"employeeId" text NOT NULL,
	"gross" double precision DEFAULT 0 NOT NULL,
	"net" double precision DEFAULT 0 NOT NULL,
	"filePath" text,
	"departmentId" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"employeeId" text NOT NULL,
	"date" text NOT NULL,
	"patternId" text,
	"startTime" text,
	"endTime" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "shift_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"name" text NOT NULL,
	"startTime" text NOT NULL,
	"endTime" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"departmentId" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whistle_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"reportId" text NOT NULL,
	"authorType" "whistle_author" NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whistle_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"trackingCode" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" "whistle_status" DEFAULT 'new' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "whistle_reports_trackingCode_unique" UNIQUE("trackingCode")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_approverEmployeeId_employees_id_fk" FOREIGN KEY ("approverEmployeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_jobPostingId_job_postings_id_fk" FOREIGN KEY ("jobPostingId") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_reportId_expense_reports_id_fk" FOREIGN KEY ("reportId") REFERENCES "public"."expense_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_approvedBy_employees_id_fk" FOREIGN KEY ("approvedBy") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_entitlements" ADD CONSTRAINT "leave_entitlements_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_entitlements" ADD CONSTRAINT "leave_entitlements_leaveTypeId_leave_types_id_fk" FOREIGN KEY ("leaveTypeId") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_leave_types_id_fk" FOREIGN KEY ("leaveTypeId") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decidedBy_employees_id_fk" FOREIGN KEY ("decidedBy") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_ledger" ADD CONSTRAINT "overtime_ledger_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_ledger" ADD CONSTRAINT "overtime_ledger_leaveRequestId_leave_requests_id_fk" FOREIGN KEY ("leaveRequestId") REFERENCES "public"."leave_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_periodId_payroll_periods_id_fk" FOREIGN KEY ("periodId") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employeeId_employees_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_patternId_shift_patterns_id_fk" FOREIGN KEY ("patternId") REFERENCES "public"."shift_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_patterns" ADD CONSTRAINT "shift_patterns_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_patterns" ADD CONSTRAINT "shift_patterns_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whistle_messages" ADD CONSTRAINT "whistle_messages_reportId_whistle_reports_id_fk" FOREIGN KEY ("reportId") REFERENCES "public"."whistle_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whistle_reports" ADD CONSTRAINT "whistle_reports_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_rules_uq" ON "approval_rules" USING btree ("orgId","departmentId","level");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entityId");--> statement-breakpoint
CREATE INDEX "clock_employee_date_idx" ON "clock_events" USING btree ("employeeId","occurredAt");--> statement-breakpoint
CREATE INDEX "contracts_employee_idx" ON "contracts" USING btree ("employeeId");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_org_name_uq" ON "departments" USING btree ("orgId","name");--> statement-breakpoint
CREATE INDEX "employees_org_idx" ON "employees" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "employees_department_idx" ON "employees" USING btree ("departmentId");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_org_email_uq" ON "employees" USING btree ("orgId","email");--> statement-breakpoint
CREATE INDEX "expense_lines_report_idx" ON "expense_lines" USING btree ("reportId");--> statement-breakpoint
CREATE UNIQUE INDEX "holidays_org_date_uq" ON "holidays" USING btree ("orgId","date");--> statement-breakpoint
CREATE INDEX "holidays_year_idx" ON "holidays" USING btree ("orgId","year");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_entitlements_uq" ON "leave_entitlements" USING btree ("employeeId","leaveTypeId","year");--> statement-breakpoint
CREATE INDEX "leave_entitlements_year_idx" ON "leave_entitlements" USING btree ("year");--> statement-breakpoint
CREATE INDEX "leave_requests_employee_idx" ON "leave_requests" USING btree ("employeeId");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("orgId","status");--> statement-breakpoint
CREATE INDEX "leave_requests_dates_idx" ON "leave_requests" USING btree ("orgId","startDate","endDate");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_org_code_uq" ON "leave_types" USING btree ("orgId","code");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status","scheduledAt");--> statement-breakpoint
CREATE INDEX "overtime_employee_idx" ON "overtime_ledger" USING btree ("employeeId");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_periods_uq" ON "payroll_periods" USING btree ("orgId","year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "payslips_uq" ON "payslips" USING btree ("periodId","employeeId");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_org_key_uq" ON "settings" USING btree ("orgId","key");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_assignments_uq" ON "shift_assignments" USING btree ("employeeId","date");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "whistle_messages_report_idx" ON "whistle_messages" USING btree ("reportId");