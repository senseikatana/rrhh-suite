CREATE TYPE "public"."demand_action" AS ENUM('PENDING', 'ORDERED', 'IGNORED');--> statement-breakpoint
CREATE TYPE "public"."demand_source" AS ENUM('SALES_ORDER', 'MIN_STOCK', 'FORECAST');--> statement-breakpoint
CREATE TYPE "public"."erp_role" AS ENUM('admin', 'buyer', 'logistics', 'quality');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('OPEN', 'RECEIVED', 'QC_PENDING', 'QC_APPROVED', 'REJECTED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."quality_status" AS ENUM('PENDING', 'PASSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."route_status" AS ENUM('PLANNED', 'IN_TRANSIT', 'DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."sales_order_status" AS ENUM('OPEN', 'PICKING', 'SHIPPED', 'INVOICED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "erp_activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"orgId" text NOT NULL,
	"actorId" text,
	"actorUsername" text NOT NULL,
	"entity" text NOT NULL,
	"entityId" text,
	"action" text NOT NULL,
	"summary" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "erp_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"postalCode" text,
	"country" text DEFAULT 'Spain' NOT NULL,
	"taxId" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_demand_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"itemId" text NOT NULL,
	"requiredDate" date NOT NULL,
	"quantityNeeded" numeric(14, 3) DEFAULT '0' NOT NULL,
	"source" "demand_source" NOT NULL,
	"action" "demand_action" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_items" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"unit" text DEFAULT 'EA' NOT NULL,
	"unitCost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"unitPrice" numeric(14, 2) DEFAULT '0' NOT NULL,
	"stock" numeric(14, 3) DEFAULT '0' NOT NULL,
	"minStock" numeric(14, 3) DEFAULT '0' NOT NULL,
	"location" text DEFAULT 'A-01' NOT NULL,
	"category" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_purchase_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"itemId" text NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '1' NOT NULL,
	"unitCost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"qtyReceived" numeric(14, 3) DEFAULT '0' NOT NULL,
	"qcStatus" "quality_status" DEFAULT 'PENDING' NOT NULL,
	"stockPosted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"number" text NOT NULL,
	"vendorId" text NOT NULL,
	"orderDate" date NOT NULL,
	"expectedDate" date,
	"status" "purchase_order_status" DEFAULT 'OPEN' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"code" text NOT NULL,
	"carrier" text NOT NULL,
	"date" date NOT NULL,
	"status" "route_status" DEFAULT 'PLANNED' NOT NULL,
	"stops" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_sales_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"itemId" text NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '1' NOT NULL,
	"unitPrice" numeric(14, 2) DEFAULT '0' NOT NULL,
	"qtyPicked" numeric(14, 3) DEFAULT '0' NOT NULL,
	"qtyShipped" numeric(14, 3) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_sales_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"number" text NOT NULL,
	"customerId" text NOT NULL,
	"orderDate" date NOT NULL,
	"deliveryDate" date,
	"status" "sales_order_status" DEFAULT 'OPEN' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"leadTimeDays" integer DEFAULT 7 NOT NULL,
	"qualityRating" double precision DEFAULT 5 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_company_access" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"orgId" text NOT NULL,
	"role" "erp_role" DEFAULT 'buyer' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "locale" text DEFAULT 'es_ES' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "defaultLanguage" text DEFAULT 'es' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logoPath" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "qualityCheckRequired" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "modulesEnabled" jsonb DEFAULT '["dashboard","sales","purchases","warehouse","demand","routes"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "erp_activity_events" ADD CONSTRAINT "erp_activity_events_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_activity_events" ADD CONSTRAINT "erp_activity_events_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_customers" ADD CONSTRAINT "erp_customers_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_demand_lines" ADD CONSTRAINT "erp_demand_lines_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_demand_lines" ADD CONSTRAINT "erp_demand_lines_itemId_erp_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."erp_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_items" ADD CONSTRAINT "erp_items_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_purchase_order_lines" ADD CONSTRAINT "erp_purchase_order_lines_orderId_erp_purchase_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."erp_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_purchase_order_lines" ADD CONSTRAINT "erp_purchase_order_lines_itemId_erp_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."erp_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_purchase_orders" ADD CONSTRAINT "erp_purchase_orders_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_purchase_orders" ADD CONSTRAINT "erp_purchase_orders_vendorId_erp_vendors_id_fk" FOREIGN KEY ("vendorId") REFERENCES "public"."erp_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_routes" ADD CONSTRAINT "erp_routes_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_sales_order_lines" ADD CONSTRAINT "erp_sales_order_lines_orderId_erp_sales_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."erp_sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_sales_order_lines" ADD CONSTRAINT "erp_sales_order_lines_itemId_erp_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."erp_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_sales_orders" ADD CONSTRAINT "erp_sales_orders_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_sales_orders" ADD CONSTRAINT "erp_sales_orders_customerId_erp_customers_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."erp_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_vendors" ADD CONSTRAINT "erp_vendors_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_access" ADD CONSTRAINT "user_company_access_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_access" ADD CONSTRAINT "user_company_access_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_activity_company_time" ON "erp_activity_events" USING btree ("orgId","occurredAt");--> statement-breakpoint
CREATE INDEX "ix_activity_entity_action_time" ON "erp_activity_events" USING btree ("entity","action","occurredAt");--> statement-breakpoint
CREATE INDEX "erp_customers_org_idx" ON "erp_customers" USING btree ("orgId");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_customers_org_code_uq" ON "erp_customers" USING btree ("orgId","code");--> statement-breakpoint
CREATE INDEX "erp_demand_lines_org_idx" ON "erp_demand_lines" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "erp_demand_lines_item_idx" ON "erp_demand_lines" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "erp_demand_lines_action_idx" ON "erp_demand_lines" USING btree ("orgId","action");--> statement-breakpoint
CREATE INDEX "erp_items_org_idx" ON "erp_items" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "erp_items_location_idx" ON "erp_items" USING btree ("orgId","location");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_items_org_code_uq" ON "erp_items" USING btree ("orgId","code");--> statement-breakpoint
CREATE INDEX "erp_purchase_order_lines_order_idx" ON "erp_purchase_order_lines" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "erp_purchase_order_lines_item_idx" ON "erp_purchase_order_lines" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "erp_purchase_orders_org_idx" ON "erp_purchase_orders" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "erp_purchase_orders_status_idx" ON "erp_purchase_orders" USING btree ("orgId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_purchase_orders_org_number_uq" ON "erp_purchase_orders" USING btree ("orgId","number");--> statement-breakpoint
CREATE INDEX "erp_routes_org_idx" ON "erp_routes" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "erp_routes_date_idx" ON "erp_routes" USING btree ("orgId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_routes_org_code_uq" ON "erp_routes" USING btree ("orgId","code");--> statement-breakpoint
CREATE INDEX "erp_sales_order_lines_order_idx" ON "erp_sales_order_lines" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "erp_sales_order_lines_item_idx" ON "erp_sales_order_lines" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "erp_sales_orders_org_idx" ON "erp_sales_orders" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "erp_sales_orders_status_idx" ON "erp_sales_orders" USING btree ("orgId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_sales_orders_org_number_uq" ON "erp_sales_orders" USING btree ("orgId","number");--> statement-breakpoint
CREATE INDEX "erp_vendors_org_idx" ON "erp_vendors" USING btree ("orgId");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_vendors_org_code_uq" ON "erp_vendors" USING btree ("orgId","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_company" ON "user_company_access" USING btree ("userId","orgId");--> statement-breakpoint
CREATE INDEX "user_company_access_org_idx" ON "user_company_access" USING btree ("orgId");