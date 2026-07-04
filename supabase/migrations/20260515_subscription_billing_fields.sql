-- Add billing data fields to organization_subscriptions
ALTER TABLE public.organization_subscriptions
ADD COLUMN IF NOT EXISTS invoice_name text,
ADD COLUMN IF NOT EXISTS doc_type text CHECK (doc_type IN ('nit', 'ci', 'pasaporte', 'cedula')),
ADD COLUMN IF NOT EXISTS doc_number text;

COMMENT ON COLUMN public.organization_subscriptions.invoice_name IS 'Nombre que aparece en la factura';
COMMENT ON COLUMN public.organization_subscriptions.doc_type IS 'Tipo de documento para facturacion';
COMMENT ON COLUMN public.organization_subscriptions.doc_number IS 'Numero de documento para facturacion';
