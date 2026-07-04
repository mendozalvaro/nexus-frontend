select public.get_organization_capabilities('11111111-1111-4111-8111-111111111111'::uuid) as product_caps,
       public.get_organization_capabilities('12222222-2222-4222-8222-222222222222'::uuid) as service_caps,
       public.get_organization_capabilities('13333333-3333-4333-8333-333333333333'::uuid) as lodging_caps;
