-- ============================================================
-- STAMP — site_settings (admin-editable site content)
-- Run once in the Supabase SQL editor.
-- Powers the "Landing page intro" feature in the admin panel and
-- the hero video/poster on the storefront home page.
-- ============================================================

-- Key/value settings table
create table if not exists site_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- keep updated_at fresh (reuses set_updated_at() from the main schema)
drop trigger if exists site_settings_updated on site_settings;
create trigger site_settings_updated before update on site_settings
  for each row execute function set_updated_at();

alter table site_settings enable row level security;

-- Public may read (storefront needs the hero URLs)
create policy "public reads site settings" on site_settings
  for select using (true);

-- Only admins may change settings
create policy "admin writes site settings" on site_settings
  for all using (is_admin()) with check (is_admin());

-- Seed the keys the storefront reads (empty = use built-in defaults)
insert into site_settings (key, value) values
  ('hero_video', ''),
  ('hero_poster', ''),
  ('hero_live', '0')   -- '1' = storefront shows the custom intro video
on conflict (key) do nothing;

-- ============================================================
-- Storage bucket for site media (hero video / poster, etc.)
-- Public read, admin-only write.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;

create policy "public reads site media" on storage.objects
  for select using (bucket_id = 'site-media');

create policy "admin writes site media" on storage.objects
  for all
  using  (bucket_id = 'site-media' and is_admin())
  with check (bucket_id = 'site-media' and is_admin());
