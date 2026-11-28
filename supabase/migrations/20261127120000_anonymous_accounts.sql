-- Anonymous accounts (decision of the owner, 27 November 2026): no sign-in screen for now. The
-- phone silently gets a Supabase anonymous account (Auth › "Allow anonymous sign-ins"); friends
-- are added by code or QR code only, and the progress syncs with that account.
--
-- An anonymous user is an ordinary row of auth.users (is_anonymous = true) and uses the same
-- `authenticated` role as a permanent user; its token carries the claim `is_anonymous: true`
-- (Supabase documentation, "Anonymous Sign-Ins", read on 27 November 2026). Every policy and
-- function of the social and sync migrations is written for `authenticated` and checks the
-- caller with auth.uid(): they work unchanged for anonymous users, and each still reads and
-- writes only its own rows. Two things change here, nothing else:
--
-- 1. The search by name is refused to anonymous accounts. Anyone can now create an account
--    without an address (30 per hour and per IP address by default), so the limit of 30 searches
--    per minute and per account no longer bounds what one person can list. The app does not
--    search by name (the owner chose code and QR code only, D36 revisited): only a direct call
--    to the API is closed. A permanent account (Apple, Google, e-mail, later) keeps the search.
-- 2. A cleanup of abandoned anonymous accounts, which Supabase does not do by itself: an
--    anonymous account with no profile (it never used the Proches tab) and no sign-in or token
--    refresh for 90 days. An account with a profile is never deleted by it: its friends would
--    lose it. Nobody can call it through the API; see the end of the file to run it every day.
--
-- NOT VERIFIED on the real project: deleting rows of auth.users from a function (the same
-- question as delete_my_account(), docs/specs/social-database.md, section 6, step 7).

-- True when the token of the caller is the one of an anonymous account. A token without the
-- claim (permanent accounts of older tokens, the tests of the other migrations) is not.
create function private.caller_is_anonymous()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- 1. The search by name: the function of the social migration moves to the private schema,
-- untouched, and a guard takes its place in public with the same name, arguments, columns
-- and right to run it (signed-in users only).
alter function public.search_profiles(text) rename to search_profiles_unguarded;
alter function public.search_profiles_unguarded(text) set schema private;
revoke all on function private.search_profiles_unguarded(text) from public, anon, authenticated;

create function public.search_profiles(p_query text)
returns table (id uuid, display_name text, relation text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if private.caller_is_anonymous() then
    raise exception 'permanent_account_required';
  end if;
  return query select * from private.search_profiles_unguarded(p_query);
end
$$;

revoke all on function public.search_profiles(text) from public, anon, authenticated;
grant execute on function public.search_profiles(text) to authenticated;
revoke all on function private.caller_is_anonymous() from public, anon, authenticated;

-- 2. The cleanup. Returns how many accounts it deleted. The last activity of an account is its
-- last sign-in or the last refresh of one of its sessions (the app refreshes its token about
-- every hour while it is open), or its creation. An anonymous account cannot sign in again
-- once its phone lost the token: after 90 days of silence, nobody will ever use it.
-- What is lost: the copy of the progress kept by the sync (the phone still has it, and sends
-- it again to a new account if it ever comes back).
create function private.delete_abandoned_anonymous_users(p_idle_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_idle_days is null or p_idle_days < 30 then
    raise exception 'idle_days_too_short';
  end if;
  with abandoned as (
    select u.id
    from auth.users u
    where u.is_anonymous is true
      and not exists (select 1 from public.profiles p where p.id = u.id)
      and greatest(
            u.created_at,
            u.last_sign_in_at,
            (select max(greatest(s.updated_at, s.refreshed_at at time zone 'utc'))
             from auth.sessions s where s.user_id = u.id)
          ) < now() - make_interval(days => p_idle_days)
  )
  delete from auth.users u using abandoned a where u.id = a.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

revoke all on function private.delete_abandoned_anonymous_users(integer)
  from public, anon, authenticated;

-- To run it every day (after review; pg_cron is offered by Supabase on the free plan, under
-- Database › Extensions, but not enabled on this project on 27 November 2026):
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'delete-abandoned-anonymous-users', '17 3 * * *',
--     $$select private.delete_abandoned_anonymous_users(90)$$
--   );
