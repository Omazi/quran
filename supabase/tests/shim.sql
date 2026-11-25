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
  created_at timestamptz not null default now()
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

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Supabase hands wide privileges on every new table and function of the public schema
-- to anon and authenticated (from memory). Reproduce that, so the tests prove that the
-- migration closes it by itself instead of relying on a quiet default.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
