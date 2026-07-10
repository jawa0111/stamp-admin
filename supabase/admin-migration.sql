-- ============================================================
-- STAMP Admin — additional columns required by the admin panel
-- Run once in the Supabase SQL editor (after the main schema).
-- ============================================================

-- Cost price: used for profit / cost-of-goods-sold calculations
alter table products
  add column if not exists cost_price numeric(10,2) check (cost_price >= 0);

-- Archive flag: products with order history are archived instead of deleted
alter table products
  add column if not exists is_archived boolean not null default false;

create index if not exists idx_products_archived on products(is_archived);

-- Expense receipts: optional array of uploaded bill/receipt image URLs
alter table expenses
  add column if not exists receipts text[] not null default '{}';

-- ============================================================
-- Storage bucket for expense bills (public read, admin write)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('expense-bills', 'expense-bills', true)
on conflict (id) do nothing;

create policy "public reads expense bills" on storage.objects
  for select using (bucket_id = 'expense-bills');

create policy "admin writes expense bills" on storage.objects
  for all
  using  (bucket_id = 'expense-bills' and is_admin())
  with check (bucket_id = 'expense-bills' and is_admin());

-- ============================================================
-- Creating the first admin user
-- 1. Supabase Dashboard → Authentication → Users → "Add user"
--    (email + password, check "Auto confirm user")
-- 2. Copy the new user's UUID and run:
--
-- insert into admin_users (id, email, full_name, role)
-- values ('PASTE-AUTH-USER-UUID-HERE', 'you@example.com', 'Your Name', 'admin');
--
-- For staff members (orders + products only, no financials), use role 'staff'.
-- ============================================================
