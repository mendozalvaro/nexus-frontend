select id, full_name, email, organization_id
from public.profiles
where full_name ilike 'Paola%'
   or email ilike '%paola%'
order by updated_at desc nulls last, created_at desc nulls last
limit 10;
