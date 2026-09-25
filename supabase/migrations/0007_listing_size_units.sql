-- Different property types are measured in different units on the
-- Pakistani market (marla/kanal for houses and plots, square feet for
-- flats and commercial space). Add an explicit unit alongside the
-- existing numeric size column instead of assuming marla for everything.

alter table public.listings add column if not exists size_unit text
  not null default 'marla' check (size_unit in ('marla', 'kanal', 'sqft', 'sqyd'));
