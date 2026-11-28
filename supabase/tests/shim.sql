-- TEST ONLY. Never part of a migration: on a real Supabase project these objects are
-- provided by the platform. This file stands in for them so the migration can run on a
-- plain PostgreSQL. What it copies from Supabase is written from memory and is NOT
-- VERIFIED against the documentation (see docs/specs/social-database.md).

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now(),
  -- Columns of the real table read by the anonymous-accounts migration (types read on the
  -- project, 27 November 2026).
  is_anonymous boolean not null default false,
  last_sign_in_at timestamptz
);

-- The sessions of a user (only the columns the anonymous-accounts migration reads; types read
-- on the project, 27 November 2026: refreshed_at has no time zone there).
create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  refreshed_at timestamp
);

-- auth.uid(): the id found in the signed-in user's token claims, or null.
-- The tests put the claims in a setting, as the Supabase API layer does.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- auth.jwt(): all the claims of the token (is_anonymous among them), or null.
create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Supabase hands wide privileges on every new table and function of the public schema
-- to anon and authenticated (from memory). Reproduce that, so the tests prove that the
-- migration closes it by itself instead of relying on a quiet default.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
