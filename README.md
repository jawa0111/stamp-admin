# STAMP Admin

Admin dashboard for the STAMP clothing store. React 19 + Vite + Tailwind CSS 4 +
React Router 7 + Supabase (Auth, PostgreSQL, Storage). Deploys to Vercel as its
own project. All money is displayed in **LKR** (`Rs 4,500.00`).

## Features

- **Auth** — Supabase email/password, every route protected. Roles: `admin`
  (everything) and `staff` (orders + products only — Finances is hidden and
  blocked by both routing and RLS).
- **Dashboard** — today's / this month's revenue, orders, pending payments,
  profit, expenses; 30-day revenue & order charts; best sellers; recent orders
  with one-click status moves; low-stock alerts.
- **Orders** — search (order #, name, email, phone), filter by status and date
  range, sort; detail view with items, sizes/colors, shipping/billing, totals;
  status flow `pending_payment → payment_received → processing → shipped →
  delivered` (+ cancelled / refunded); internal notes (courier tracking etc.);
  printable invoice / packing slip (Print invoice → browser print → PDF).
- **Products** — full CRUD, multi-image upload to Supabase Storage with cover
  ordering, size/color variants with per-variant stock/SKU/price override,
  draft ↔ published toggle, cost price, low-stock badges. Deleting a product
  with order history archives it instead so past orders stay intact.
- **Customers** — auto-created at checkout; search by name/email/phone; total
  orders, total spend and full order history per customer.
- **Finances** (admin only) — founder investments with running totals per
  founder; expenses CRUD (inventory / packaging / ads / delivery / other);
  revenue from paid orders; profit = revenue − expenses (optionally − COGS via
  product cost price); date presets (this month, last month, this year, custom).

---

## 1. One-time Supabase setup

The main schema is already live. Two extra things are needed:

### a) Run the admin migration

Supabase Dashboard → **SQL Editor** → paste and run
[`supabase/admin-migration.sql`](supabase/admin-migration.sql). It adds
`products.cost_price` and `products.is_archived` — both used by this panel.

### b) Create the first admin user

1. Dashboard → **Authentication → Users → Add user**. Enter email + password
   and tick **Auto confirm user**.
2. Copy the new user's UUID (click the user row).
3. SQL Editor:

   ```sql
   insert into admin_users (id, email, full_name, role)
   values ('PASTE-UUID-HERE', 'you@example.com', 'Your Name', 'admin');
   ```

To add **staff** later (no access to Finances), do the same with
`role = 'staff'`. Signing in with an auth user that has no `admin_users` row
shows an "Access denied" screen — RLS blocks all private data for them.

---

## 2. Run locally

```bash
cp .env.example .env        # then fill in your values
npm install
npm run dev                 # http://localhost:5173
```

`.env` values come from Supabase Dashboard → **Settings → API**:

| Variable                 | Value                          |
| ------------------------ | ------------------------------ |
| `VITE_SUPABASE_URL`      | Project URL                    |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` key            |

> ⚠️ Never use the `service_role` key in this app. The anon key + Row Level
> Security is the whole security model.

---

## 3. Deploy to Vercel

1. Push this folder to its own GitHub repo.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
   Vercel auto-detects Vite (build `npm run build`, output `dist`).
3. In **Environment Variables**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (same values as `.env`).
4. Deploy. `vercel.json` already rewrites all routes to `index.html` so React
   Router deep links (e.g. `/orders/123`) work on refresh.

Or with the CLI:

```bash
npm i -g vercel
vercel            # first deploy, answer prompts
vercel --prod
```

---

## Project structure

```
src/
  lib/            supabase client, LKR/date formatting, date-range helpers
  context/        AuthContext (session + admin_users role), ToastContext
  components/     Layout (sidebar), ProtectedRoute, StatusSelect, ui/ kit
  pages/          Login, Dashboard, Orders, OrderDetail, Products,
                  ProductForm, Customers, CustomerDetail, Finances, Settings
supabase/
  admin-migration.sql   extra columns + first-admin instructions
```

## Notes

- **Order status flow** is enforced in the UI (`NEXT_STATUSES` in
  `src/components/ui/StatusBadge.jsx`) — you can only move forward, or to
  cancelled/refunded.
- **Revenue** counts orders in `payment_received / processing / shipped /
  delivered` (`PAID_STATUSES` in the same file).
- **Low stock threshold** is 5 — change `LOW_STOCK_THRESHOLD` in
  `src/pages/Dashboard.jsx` and `src/pages/Products.jsx`.
- **Categories** are managed in Settings (admin only).
