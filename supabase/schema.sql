-- Optional starter schema. Review and configure RLS before production use.
create extension if not exists pgcrypto;

create table if not exists public.initiatives (
  id text primary key,
  title text not null,
  category text not null,
  description text not null,
  goal_amount numeric(12,2) not null default 0 check (goal_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.donation_transactions (
  id uuid primary key default gen_random_uuid(),
  paypal_order_id text unique not null,
  paypal_capture_id text unique,
  initiative_id text not null references public.initiatives(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  status text not null check (status in ('CREATED','COMPLETED','FAILED','REFUNDED')),
  is_sandbox boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.initiatives enable row level security;
alter table public.donation_transactions enable row level security;

-- No public write policies are intentionally included. Perform writes through a
-- trusted backend using a server-only service role key, and add reviewed policies
-- before exposing any user-facing data access.
