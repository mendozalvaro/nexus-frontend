


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."admin_role" AS ENUM (
    'admin',
    'admin branch',
    'employee',
    'client'
);


ALTER TYPE "public"."admin_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_company_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()::uuid;
$$;


ALTER FUNCTION "public"."current_user_company_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_company_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()::uuid
      AND role = 'company_admin'
  );
$$;


ALTER FUNCTION "public"."is_current_user_company_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_sales_receipt_number_seq_to_year"("curr_year" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM setval('public.sales_receipt_number_seq', 0, false);
  UPDATE public.sales
  SET receipt_year = curr_year
  WHERE receipt_year < curr_year;
END;
$$;


ALTER FUNCTION "public"."reset_sales_receipt_number_seq_to_year"("curr_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sales_receipt_number_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.receipt_year IS NULL THEN
    NEW.receipt_year := EXTRACT(YEAR FROM now())::integer;
  END IF;

  IF NEW.receipt_number IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sales_receipt_number_seq') THEN
      CREATE SEQUENCE public.sales_receipt_number_seq;
    END IF;

    NEW.receipt_number := nextval('public.sales_receipt_number_seq');
  END IF;

  NEW.receipt_code := to_char(NEW.receipt_year, 'FM0000') || '-' || lpad(NEW.receipt_number::text, 6, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sales_receipt_number_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sales_receipt_number_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.receipt_year IS NULL THEN
    NEW.receipt_year := EXTRACT(YEAR FROM NEW.sale_date)::integer;
  END IF;

  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := nextval('public.sales_receipt_number_seq');
  END IF;

  NEW.receipt_code := CONCAT(NEW.receipt_year, '-', LPAD(NEW.receipt_number::text, 6, '0'));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sales_receipt_number_trigger"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "updated_by" "uuid"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" character varying NOT NULL,
    "address" "text",
    "phone" character varying,
    "email" character varying,
    "manager_id" "uuid",
    "logo_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "business_name" "text",
    "tax_id" "text",
    "company_id" "uuid" NOT NULL,
    "auth_user_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "slogan" "text",
    "logo_url" "text",
    "description" "text",
    "address" "text",
    "phone" character varying,
    "email" character varying,
    "website" "text",
    "tax_id" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid"
);


ALTER TABLE "public"."employee_branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_rate_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "delivery_date" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "updated_by" "uuid"
);


ALTER TABLE "public"."product_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "description" "text",
    "stock_quantity" integer DEFAULT 0,
    "price" numeric NOT NULL,
    "tax_rate_id" "uuid",
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "company_id" "uuid" NOT NULL,
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "tax_id" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "user_role" "public"."admin_role" DEFAULT 'admin'::"public"."admin_role" NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "payment_method" "text",
    "subtotal" numeric DEFAULT 0,
    "tax_amount" numeric DEFAULT 0,
    "total_amount" numeric DEFAULT 0,
    "description" "text",
    "receipt_year" integer NOT NULL,
    "receipt_number" integer NOT NULL,
    "receipt_code" "text",
    "sale_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_bookings" (
    "sale_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL
);


ALTER TABLE "public"."sales_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_product_orders" (
    "sale_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_rate_id" "uuid"
);


ALTER TABLE "public"."sales_product_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_products" (
    "sale_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_rate_id" "uuid"
);


ALTER TABLE "public"."sales_products" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sales_receipt_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sales_receipt_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_services" (
    "sale_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_rate_id" "uuid"
);


ALTER TABLE "public"."sales_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."service_branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric NOT NULL,
    "duration_minutes" integer DEFAULT 30,
    "is_global" boolean DEFAULT false,
    "tax_rate_id" "uuid",
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tax_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "rate" numeric NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "tax_rates_rate_check" CHECK (("rate" >= (0)::numeric))
);


ALTER TABLE "public"."tax_rates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_branches"
    ADD CONSTRAINT "employee_branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_branches"
    ADD CONSTRAINT "employee_branches_unique" UNIQUE ("profile_id", "branch_id");



ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_bookings"
    ADD CONSTRAINT "sales_bookings_pkey" PRIMARY KEY ("sale_id", "booking_id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_product_orders"
    ADD CONSTRAINT "sales_product_orders_pkey" PRIMARY KEY ("sale_id", "order_id");



ALTER TABLE ONLY "public"."sales_products"
    ADD CONSTRAINT "sales_products_pkey" PRIMARY KEY ("sale_id", "product_id");



ALTER TABLE ONLY "public"."sales_services"
    ADD CONSTRAINT "sales_services_pkey" PRIMARY KEY ("sale_id", "service_id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_unique_receipt" UNIQUE ("receipt_year", "receipt_number");



ALTER TABLE ONLY "public"."service_branches"
    ADD CONSTRAINT "service_branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_branches"
    ADD CONSTRAINT "service_branches_unique" UNIQUE ("service_id", "branch_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tax_rates"
    ADD CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_bookings_branch_id" ON "public"."bookings" USING "btree" ("branch_id");



CREATE INDEX "idx_clients_company_id" ON "public"."clients" USING "btree" ("company_id");



CREATE INDEX "idx_product_orders_branch_id" ON "public"."product_orders" USING "btree" ("branch_id");



CREATE INDEX "idx_products_branch_id" ON "public"."products" USING "btree" ("branch_id");



CREATE INDEX "idx_profiles_company_id" ON "public"."profiles" USING "btree" ("company_id");



CREATE INDEX "idx_sales_branch_id" ON "public"."sales" USING "btree" ("branch_id");



CREATE INDEX "idx_services_company_id" ON "public"."services" USING "btree" ("company_id");



CREATE OR REPLACE TRIGGER "sales_receipt_number_trigger" BEFORE INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."sales_receipt_number_fn"();



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."employee_branches"
    ADD CONSTRAINT "employee_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."employee_branches"
    ADD CONSTRAINT "employee_branches_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."product_orders"
    ADD CONSTRAINT "product_orders_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sales_bookings"
    ADD CONSTRAINT "sales_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."sales_bookings"
    ADD CONSTRAINT "sales_bookings_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sales_product_orders"
    ADD CONSTRAINT "sales_product_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."product_orders"("id");



ALTER TABLE ONLY "public"."sales_product_orders"
    ADD CONSTRAINT "sales_product_orders_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_product_orders"
    ADD CONSTRAINT "sales_product_orders_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id");



ALTER TABLE ONLY "public"."sales_products"
    ADD CONSTRAINT "sales_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sales_products"
    ADD CONSTRAINT "sales_products_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_products"
    ADD CONSTRAINT "sales_products_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id");



ALTER TABLE ONLY "public"."sales_services"
    ADD CONSTRAINT "sales_services_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_services"
    ADD CONSTRAINT "sales_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."sales_services"
    ADD CONSTRAINT "sales_services_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id");



ALTER TABLE ONLY "public"."service_branches"
    ADD CONSTRAINT "service_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."service_branches"
    ADD CONSTRAINT "service_branches_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id");



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_company_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_company_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_company_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_company_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_company_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_company_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_sales_receipt_number_seq_to_year"("curr_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reset_sales_receipt_number_seq_to_year"("curr_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_sales_receipt_number_seq_to_year"("curr_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_receipt_number_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."sales_receipt_number_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_receipt_number_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_receipt_number_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."sales_receipt_number_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_receipt_number_trigger"() TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."employee_branches" TO "anon";
GRANT ALL ON TABLE "public"."employee_branches" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_branches" TO "service_role";



GRANT ALL ON TABLE "public"."product_orders" TO "anon";
GRANT ALL ON TABLE "public"."product_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."product_orders" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."sales_bookings" TO "anon";
GRANT ALL ON TABLE "public"."sales_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."sales_product_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_product_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_product_orders" TO "service_role";



GRANT ALL ON TABLE "public"."sales_products" TO "anon";
GRANT ALL ON TABLE "public"."sales_products" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sales_receipt_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sales_receipt_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sales_receipt_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sales_services" TO "anon";
GRANT ALL ON TABLE "public"."sales_services" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_services" TO "service_role";



GRANT ALL ON TABLE "public"."service_branches" TO "anon";
GRANT ALL ON TABLE "public"."service_branches" TO "authenticated";
GRANT ALL ON TABLE "public"."service_branches" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."tax_rates" TO "anon";
GRANT ALL ON TABLE "public"."tax_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."tax_rates" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







