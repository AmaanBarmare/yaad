-- Yaad — Supabase schema
-- Run this in the Supabase SQL editor (or via the CLI) before seeding.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  language text default 'hi',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  amount numeric,
  created_at timestamptz default now()
);

create index if not exists idx_transactions_customer_id
  on transactions (customer_id);

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  name text not null,
  quantity int default 1,
  category text,
  reorder_days int,
  reorder_due_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_items_transaction_id
  on items (transaction_id);
create index if not exists idx_items_reorder_due_at
  on items (reorder_due_at);

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  message_text text,
  audio_url text,
  status text default 'pending',
  created_at timestamptz default now()
);

create index if not exists idx_reminders_customer_id
  on reminders (customer_id);
