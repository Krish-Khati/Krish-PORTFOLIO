-- Fitness Temple: gallery[0] alt text for the new screenshot taken on 07-10-2026
-- (public/projects/fitness-temple.png, 1440x1000). Only the alt changes — url, width and
-- height already match. Safe to run more than once.
update public.projects
set gallery = jsonb_set(
  gallery,
  '{0,alt}',
  '"Fitness Temple gym website design hero section with Unleash Your Inner Power headline and Explore Programs CTA"'::jsonb,
  true
)
where slug = 'fitness-temple'
  and gallery -> 0 is not null
  and gallery -> 0 ->> 'alt' is distinct from
      'Fitness Temple gym website design hero section with Unleash Your Inner Power headline and Explore Programs CTA';

select name, gallery
from public.projects
where slug = 'fitness-temple';
