select organization_id, business_type
from public.organization_business_types
where organization_id in (
  '11111111-1111-4111-8111-111111111111',
  '12222222-2222-4222-8222-222222222222',
  '13333333-3333-4333-8333-333333333333'
)
order by organization_id, business_type;
