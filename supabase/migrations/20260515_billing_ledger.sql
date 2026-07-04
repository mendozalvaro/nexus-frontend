-- Billing ledger: historial de transacciones de suscripcion
CREATE TABLE IF NOT EXISTS public.billing_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  event_type text NOT NULL CHECK (event_type IN ('plan_change', 'payment', 'cancellation', 'reactivation', 'trial_start', 'trial_end', 'proration_credit', 'proration_charge')),
  amount numeric(10,2),
  currency text DEFAULT 'USD',
  billing_mode text CHECK (billing_mode IN ('monthly', 'quarterly', 'annual')),
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_billing_ledger_org ON public.billing_ledger(organization_id);
CREATE INDEX idx_billing_ledger_created ON public.billing_ledger(created_at DESC);

ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view billing ledger"
  ON public.billing_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.organization_id = billing_ledger.organization_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

CREATE POLICY "System can insert billing ledger"
  ON public.billing_ledger
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.billing_ledger IS 'Historial de transacciones de suscripcion por organizacion';
