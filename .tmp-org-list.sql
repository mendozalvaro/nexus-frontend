select id, name, slug, logo_url
from public.organizations
order by created_at desc nulls last
limit 15;
