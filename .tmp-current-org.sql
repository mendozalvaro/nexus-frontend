select id, name, slug, logo_url
from public.organizations
where slug = 'mi-empresa' or name ilike 'Mi Empresa%'
order by slug;
