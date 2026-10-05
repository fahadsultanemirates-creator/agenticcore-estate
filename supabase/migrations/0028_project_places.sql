-- ============================================================
-- 0028 — More places for projects (outside the six main cities).
--
-- Developers launch projects in Murree, the Galiyat, Gilgit-Baltistan and
-- smaller cities of Punjab and Khyber Pakhtunkhwa. These places are added
-- for PROJECTS ONLY: property listings stay in the six main cities.
--
--  1. cities.projects_only (+ region, for grouping in the dropdown).
--  2. enforce_active_city(): a listing can't use a projects-only place;
--     a project can use any active place.
--  3. The places, live now (no launch date), and a few well-known areas.
-- Safe to run more than once.
-- ============================================================

alter table public.cities add column if not exists projects_only boolean not null default false;
alter table public.cities add column if not exists region text;

update public.cities set region = 'Islamabad Capital Territory' where name = 'Islamabad' and region is null;
update public.cities set region = 'Punjab' where name in ('Rawalpindi', 'Lahore', 'Faisalabad', 'Sialkot') and region is null;
update public.cities set region = 'Sindh' where name = 'Karachi' and region is null;

create or replace function public.enforce_active_city()
returns trigger language plpgsql set search_path = public
as $function$
begin
  if not exists (
    select 1 from public.cities
     where name = new.city and active = true
       and (tg_table_name <> 'listings' or not projects_only)
  ) then
    raise exception 'This city is not yet open for listings.';
  end if;
  return new;
end;
$function$;

insert into public.cities (name, active, sort_order, launch_at, projects_only, region) values
  -- Punjab
  ('Murree', true, 101, null, true, 'Punjab'),
  ('Gujranwala', true, 102, null, true, 'Punjab'),
  ('Multan', true, 103, null, true, 'Punjab'),
  ('Bahawalpur', true, 104, null, true, 'Punjab'),
  ('Sargodha', true, 105, null, true, 'Punjab'),
  ('Gujrat', true, 106, null, true, 'Punjab'),
  ('Jhelum', true, 107, null, true, 'Punjab'),
  ('Chakwal', true, 108, null, true, 'Punjab'),
  ('Attock', true, 109, null, true, 'Punjab'),
  ('Taxila / Wah Cantt', true, 110, null, true, 'Punjab'),
  ('Sheikhupura', true, 111, null, true, 'Punjab'),
  ('Sahiwal', true, 112, null, true, 'Punjab'),
  ('Okara', true, 113, null, true, 'Punjab'),
  ('Kasur', true, 114, null, true, 'Punjab'),
  ('Mandi Bahauddin', true, 115, null, true, 'Punjab'),
  ('Kharian', true, 116, null, true, 'Punjab'),
  ('Rahim Yar Khan', true, 117, null, true, 'Punjab'),
  ('Dera Ghazi Khan', true, 118, null, true, 'Punjab'),
  -- Khyber Pakhtunkhwa
  ('Peshawar', true, 201, null, true, 'Khyber Pakhtunkhwa'),
  ('Galiyat (Nathia Gali / Ayubia)', true, 202, null, true, 'Khyber Pakhtunkhwa'),
  ('Abbottabad', true, 203, null, true, 'Khyber Pakhtunkhwa'),
  ('Mansehra', true, 204, null, true, 'Khyber Pakhtunkhwa'),
  ('Naran / Kaghan', true, 205, null, true, 'Khyber Pakhtunkhwa'),
  ('Swat', true, 206, null, true, 'Khyber Pakhtunkhwa'),
  ('Haripur', true, 207, null, true, 'Khyber Pakhtunkhwa'),
  ('Mardan', true, 208, null, true, 'Khyber Pakhtunkhwa'),
  ('Nowshera', true, 209, null, true, 'Khyber Pakhtunkhwa'),
  ('Kohat', true, 210, null, true, 'Khyber Pakhtunkhwa'),
  ('Dera Ismail Khan', true, 211, null, true, 'Khyber Pakhtunkhwa'),
  ('Chitral', true, 212, null, true, 'Khyber Pakhtunkhwa'),
  -- Gilgit-Baltistan
  ('Gilgit', true, 301, null, true, 'Gilgit-Baltistan'),
  ('Hunza', true, 302, null, true, 'Gilgit-Baltistan'),
  ('Skardu', true, 303, null, true, 'Gilgit-Baltistan'),
  -- Azad Jammu & Kashmir
  ('Muzaffarabad', true, 401, null, true, 'Azad Jammu & Kashmir'),
  ('Mirpur (AJK)', true, 402, null, true, 'Azad Jammu & Kashmir'),
  -- Other
  ('Gwadar', true, 501, null, true, 'Balochistan'),
  ('Quetta', true, 502, null, true, 'Balochistan'),
  ('Hyderabad', true, 503, null, true, 'Sindh')
on conflict (name) do nothing;

-- a few well-known areas (anything else can be typed in)
insert into public.areas (city_name, name, sort_order)
select v.city, v.area, v.ord from (values
  ('Murree', 'Murree Expressway', 1), ('Murree', 'Bhurban', 2), ('Murree', 'Patriata (New Murree)', 3), ('Murree', 'Kuldana', 4),
  ('Murree', 'Lower Topa', 5), ('Murree', 'Mall Road', 6), ('Murree', 'Ghora Gali', 7), ('Murree', 'Kashmir Point', 8),
  ('Galiyat (Nathia Gali / Ayubia)', 'Nathia Gali', 1), ('Galiyat (Nathia Gali / Ayubia)', 'Dunga Gali', 2),
  ('Galiyat (Nathia Gali / Ayubia)', 'Ayubia', 3), ('Galiyat (Nathia Gali / Ayubia)', 'Khanspur', 4),
  ('Galiyat (Nathia Gali / Ayubia)', 'Changla Gali', 5), ('Galiyat (Nathia Gali / Ayubia)', 'Bara Gali', 6),
  ('Abbottabad', 'Jinnahabad', 1), ('Abbottabad', 'Supply', 2), ('Abbottabad', 'Thandiani', 3), ('Abbottabad', 'Shimla Hill', 4),
  ('Naran / Kaghan', 'Naran', 1), ('Naran / Kaghan', 'Kaghan', 2), ('Naran / Kaghan', 'Shogran', 3), ('Naran / Kaghan', 'Balakot', 4),
  ('Swat', 'Mingora', 1), ('Swat', 'Kalam', 2), ('Swat', 'Malam Jabba', 3), ('Swat', 'Bahrain', 4),
  ('Gilgit', 'Jutial', 1), ('Gilgit', 'Danyore', 2),
  ('Hunza', 'Karimabad', 1), ('Hunza', 'Aliabad', 2), ('Hunza', 'Gulmit', 3), ('Hunza', 'Passu', 4),
  ('Skardu', 'Shigar', 1), ('Skardu', 'Shangrila', 2), ('Skardu', 'Satpara', 3),
  ('Peshawar', 'Hayatabad', 1), ('Peshawar', 'DHA Peshawar', 2), ('Peshawar', 'Regi Model Town', 3), ('Peshawar', 'University Town', 4),
  ('Gwadar', 'New Town', 1), ('Gwadar', 'Marine Drive', 2), ('Gwadar', 'Coastal Highway', 3),
  ('Multan', 'DHA Multan', 1), ('Multan', 'Bosan Road', 2), ('Multan', 'Gulgasht Colony', 3),
  ('Gujranwala', 'DC Colony', 1), ('Gujranwala', 'Citi Housing', 2), ('Gujranwala', 'Wapda Town', 3)
) as v(city, area, ord)
where not exists (select 1 from public.areas a where a.city_name = v.city and lower(a.name) = lower(v.area));
