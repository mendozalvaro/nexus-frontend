-- Migration: Add country field and simplify onboarding function
-- Date: 2024-12-14
-- Description: Add country column to organizations and update create_onboarding_organization function

-- Add country column to organizations (if not exists)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS country VARCHAR(2);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_organizations_country ON organizations(country);

-- Update create_onboarding_organization function to simplified version
DROP FUNCTION IF EXISTS public.create_onboarding_organization(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text
);
DROP FUNCTION IF EXISTS public.create_onboarding_organization(
  text,
  text,
  text,
  text,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.create_onboarding_organization(
  p_name text,
  p_country text,
  p_address text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_organization_id uuid;
  v_plan_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Tu sesion no es valida. Inicia sesion nuevamente.';
  END IF;

  -- Check if user already has an organization
  SELECT organization_id INTO v_organization_id
  FROM profiles
  WHERE id = v_user_id;

  IF v_organization_id IS NOT NULL THEN
    RETURN v_organization_id;
  END IF;

  -- Get or create emprende plan
  SELECT id INTO v_plan_id FROM subscription_plans WHERE slug = 'emprende' LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro el plan emprende.';
  END IF;

  -- Create organization with simplified fields
  INSERT INTO organizations (name, country, address)
  VALUES (TRIM(COALESCE(p_name, '')), p_country, p_address)
  RETURNING id INTO v_organization_id;

  -- Create trial subscription
  INSERT INTO organization_subscriptions (organization_id, plan_id, status, current_period_end)
  VALUES (v_organization_id, v_plan_id, 'trial', NOW() + INTERVAL '30 days');

  -- Update user profile
  UPDATE profiles
  SET organization_id = v_organization_id,
      full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
      email = COALESCE(NULLIF(TRIM(LOWER(p_email)), ''), email),
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone)
  WHERE id = v_user_id;

  RETURN v_organization_id;
END;
$$;

-- Add audit log for organization creation
CREATE OR REPLACE FUNCTION public.audit_organization_creation() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, context)
  VALUES (
    auth.uid(),
    'INSERT',
    'organizations',
    new.id,
    jsonb_build_object('name', new.name, 'country', new.country)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS organization_audit_trigger ON organizations;
CREATE TRIGGER organization_audit_trigger
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION audit_organization_creation();
