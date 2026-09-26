-- PermitAIO Email Agent — Gmail OAuth connection storage.
--
-- This is a single, platform-level connection (the one authorized mailbox,
-- agent@permitaio.com), not per-organization like crm_connections — so it's
-- a small table meant to hold exactly one row. Tokens are stored encrypted
-- at rest (encrypted in application code with GMAIL_TOKEN_ENCRYPTION_KEY
-- before insert, decrypted only server-side) and RLS is left with no
-- permissive policies at all: every read/write goes through the service-role
-- client from the API routes under /api/integrations/gmail/*, never a
-- client-side Supabase call, so anon/authenticated access is denied outright.
create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  google_email text not null,
  refresh_token_encrypted text,
  access_token_encrypted text,
  access_token_expires_at timestamptz,
  granted_scopes text[] not null default '{}',
  gmail_history_id text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;
-- No policies: only the service-role key (which bypasses RLS) can read or
-- write this table. It is never queried from client-side Supabase code.

create unique index if not exists gmail_connections_google_email_key
  on public.gmail_connections (google_email);

create or replace function public.set_gmail_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gmail_connections_set_updated_at on public.gmail_connections;
create trigger gmail_connections_set_updated_at
  before update on public.gmail_connections
  for each row
  execute function public.set_gmail_connections_updated_at();

-- Log of Gmail messages the agent has already tagged Unprocessed, so a
-- re-run of the poll/webhook handler never double-labels the same message
-- (Gmail history entries can be redelivered, and Pub/Sub push delivery is
-- at-least-once).
create table if not exists public.gmail_processed_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text,
  detected_at timestamptz not null default now()
);

alter table public.gmail_processed_messages enable row level security;
-- Same as above: service-role only, no client-side access.
