update public.organizations
set logo_url = 'http://localhost:3000/og-image.jpg'
where slug = 'demo-retail-producto';

select id, name, slug, logo_url
from public.organizations
where slug = 'demo-retail-producto';
