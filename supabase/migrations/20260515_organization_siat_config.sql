-- SIAT config: datos fiscales y certificacion para emision de facturas en linea
CREATE TABLE IF NOT EXISTS public.organization_siat_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Datos fiscales
  razon_social text,
  nit text,
  regimen_tributario text CHECK (regimen_tributario IN ('general', 'simplificado', 'especial')),
  actividad_economica text,
  sucursal_siat text,
  direccion_matriz text,
  
  -- Certificacion
  codigo_autorizacion text,
  punto_venta text,
  sistema_facturacion text CHECK (sistema_facturacion IN ('propio', 'terceros', 'siat_linea')),
  codigo_sistema text,
  resolucion_numero text,
  
  -- Estado
  is_active boolean DEFAULT false,
  last_sync_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_org_siat UNIQUE (organization_id)
);

CREATE INDEX idx_siat_config_org ON public.organization_siat_config(organization_id);

ALTER TABLE public.organization_siat_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view SIAT config"
  ON public.organization_siat_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.organization_id = organization_siat_config.organization_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

CREATE POLICY "Org admins can update SIAT config"
  ON public.organization_siat_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.organization_id = organization_siat_config.organization_id
        AND p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.organization_siat_config IS 'Configuracion SIAT para emision de facturas en linea Bolivia';
