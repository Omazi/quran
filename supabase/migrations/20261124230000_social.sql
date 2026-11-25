-- Social lot (docs/specs/social.md, sections 2, 3 and 5; docs/specs/social-database.md).
--
-- What this migration assumes already exists (Supabase provides them; see
-- docs/specs/social-database.md for what is verified and what is not):
--   * table  auth.users (id uuid primary key)
--   * function auth.uid() returning the signed-in user's id, or null
--   * roles  anon (signed-out visitor) and authenticated (signed-in user)
--
-- Design in one paragraph: every table has row level security (RLS) enabled and
-- the privileges of `anon` and `authenticated` are revoked and then granted back one
-- by one, so there are two locks (privileges, then policies). Rows that concern two
-- people, or that must be hidden column by column, are only reachable through
-- functions that check who is calling (security definer, empty search_path).
-- Error messages raised by those functions are short machine codes.

-- ---------------------------------------------------------------------------
-- Private schema: helpers that must never be offered as an API.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Rule 1: display name (also used for group names, rule 8). Returns null when the name is
-- fine, otherwise the reason (the words of the app, in snake_case). The server refuses; it
-- never trims or fixes a value silently. The lists of characters are the ones of
-- src/domain/social/config.ts (EDGE_SPACE_CODE_POINTS, FORBIDDEN_NAME_CODE_POINTS), spelled
-- out and not left to the engine's "space" or "control" classes. Surrogate halves
-- (U+D800-U+DFFF) cannot exist in a UTF8 database, so they need no test here.
-- Length is counted in code points (char_length), on a UTF8 database.
create function private.name_problem(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_name is null then 'name_empty'
    when p_name ~ '^[ \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]*$' then 'name_empty'
    when p_name ~ '[\u0001-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]'
      then 'name_forbidden_character'
    when p_name ~ '^[ \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]'
      or p_name ~ '[ \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]$' then 'name_has_edge_spaces'
    when char_length(p_name) > 30 then 'name_too_long'
  end
$$;

-- Days are UTC days on the server. Apps send their local day where the model says
-- so (see check_days below for the tolerance).
create function private.today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'utc')::date $$;

create function private.friend_request_cooldown_days() returns integer
language sql immutable set search_path = '' as $$ select 7 $$;
create function private.max_group_members() returns integer
language sql immutable set search_path = '' as $$ select 50 $$;
create function private.invite_lifetime_days() returns integer
language sql immutable set search_path = '' as $$ select 7 $$;
create function private.max_active_invites() returns integer
language sql immutable set search_path = '' as $$ select 5 $$;

-- ---------------------------------------------------------------------------
-- Tables (names: the models of section 2, in snake_case)
-- ---------------------------------------------------------------------------

-- Profile
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    constraint profiles_display_name_valid check (private.name_problem(display_name) is null),
  show_garden boolean not null default true,
  show_level boolean not null default true,
  created_on date not null default ((now() at time zone 'utc')::date)
);
comment on table public.profiles is
  'One row per account. Only its owner reads it directly; others use get_public_profiles().';

-- GardenSummary: one row per person, published by their app.
create table public.garden_summaries (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  level integer not null constraint garden_summaries_level_range check (level >= 1),
  hizb_completed integer not null
    constraint garden_summaries_hizb_range check (hizb_completed between 0 and 60),
  health double precision not null
    constraint garden_summaries_health_range check (health between 0 and 1),
  last_watered_on date,
  streak_days integer not null
    constraint garden_summaries_streak_range check (streak_days >= 0),
  badge_count integer not null
    constraint garden_summaries_badge_count_range check (badge_count >= 0),
  updated_on date not null default ((now() at time zone 'utc')::date)
);
comment on table public.garden_summaries is
  'Garden summary. No page number, no time. Friends read it only through list_friends()/get_friend_garden().';

-- Friendship: one row per pair of people, whatever the direction.
create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null
    constraint friendships_status_valid check (status in ('pending', 'accepted', 'declined')),
  created_on date not null default ((now() at time zone 'utc')::date),
  responded_on date,
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_responded_matches_status check ((status = 'pending') = (responded_on is null))
);
create unique index friendships_one_per_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);

-- Block
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_on date not null default ((now() at time zone 'utc')::date),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- Invite: 8 characters of INVITE_CODE_ALPHABET (config.ts): 31 characters, no 0 O 1 I L.
create table public.invites (
  code text primary key
    constraint invites_code_format check (code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_on date not null default ((now() at time zone 'utc')::date),
  expires_on date not null,
  constraint invites_expiry_after_creation check (expires_on >= created_on)
);
create index invites_owner_idx on public.invites (owner_id);

-- Failed invite-code attempts, to slow down guessing. Not in the model of section 2;
-- nobody can read or write it directly (RLS on, no policy, no privilege).
create table public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at);

-- Nudge
create table public.nudges (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null constraint nudges_kind_valid check (kind in ('encourage', 'congratulate')),
  sent_on date not null,
  primary key (from_id, to_id, sent_on),
  constraint nudges_not_self check (from_id <> to_id)
);
create index nudges_to_idx on public.nudges (to_id, sent_on desc);

-- Group and GroupMember
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint groups_name_valid check (private.name_problem(name) is null),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_on date not null default ((now() at time zone 'utc')::date)
);
create index groups_owner_idx on public.groups (owner_id);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null constraint group_members_role_valid check (role in ('owner', 'member')),
  joined_on date not null default ((now() at time zone 'utc')::date),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);
create unique index group_members_one_owner on public.group_members (group_id) where role = 'owner';

-- DailyReading: pages read for the first time in their khatma that day (rule 9).
create table public.daily_readings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  new_pages integer not null
    constraint daily_readings_new_pages_range check (new_pages between 0 and 604),
  primary key (user_id, day)
);

-- Badge
create table public.badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  khatm_number integer not null constraint badges_khatm_number_range check (khatm_number >= 1),
  completed_on date not null,
  primary key (user_id, khatm_number)
);

-- ReadingBackup: the full reading journal. Owner only. Open decision for the owner
-- of the project (docs/specs/social-database.md).
create table public.reading_backups (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  journal jsonb not null
    constraint reading_backups_journal_is_object check (jsonb_typeof(journal) = 'object')
    constraint reading_backups_journal_size check (octet_length(journal::text) <= 2000000),
  updated_on date not null default ((now() at time zone 'utc')::date)
);

-- ---------------------------------------------------------------------------
-- Helpers that depend on the tables
-- ---------------------------------------------------------------------------

-- The signed-in user, who must have a profile. Raises otherwise.
create function private.require_profile()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_me) then
    raise exception 'profile_required';
  end if;
  return v_me;
end
$$;

-- True when one of the two people blocks the other.
create function private.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

-- True when the two people are accepted friends and nobody blocks the other.
create function private.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  ) and not private.blocked_between(p_a, p_b)
$$;

-- Used by policies. They answer only about the caller (auth.uid()), so they tell
-- nothing about other people's relations.
create function private.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid()
  )
$$;

-- Rule 4: a friend sees my level and badges if show_level.
create function private.can_view_level(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_owner <> auth.uid()
    and private.are_friends(auth.uid(), p_owner)
    and coalesce((select p.show_level from public.profiles p where p.id = p_owner), false)
$$;

-- Days sent by an app must be plausible: not after the server's UTC day + 1 (time zones).
-- args: the earliest accepted day ('' for none), then the columns to check. The floor on
-- daily readings keeps one person from filling the table with centuries of days.
create function private.check_days()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today();
  v_floor date := nullif(tg_argv[0], '')::date;
  v_day date;
  i integer;
begin
  for i in 1 .. tg_nargs - 1 loop
    v_day := (to_jsonb(new) ->> tg_argv[i])::date;
    if v_day is null then
      continue;
    end if;
    if v_day > v_today + 1 then
      raise exception 'day_in_future' using errcode = '23514', detail = tg_argv[i];
    end if;
    if v_floor is not null and v_day < v_floor then
      raise exception 'day_too_old' using errcode = '23514', detail = tg_argv[i];
    end if;
  end loop;
  return new;
end
$$;

create trigger garden_summaries_check_days
  before insert or update on public.garden_summaries
  for each row execute function private.check_days('', 'last_watered_on', 'updated_on');
create trigger daily_readings_check_days
  before insert or update on public.daily_readings
  for each row execute function private.check_days('2020-01-01', 'day');
create trigger badges_check_days
  before insert or update on public.badges
  for each row execute function private.check_days('', 'completed_on');

-- Rule 10: a group whose owner goes passes to the oldest member, or disappears if the
-- owner was alone. Done in a trigger on profiles so it also holds when the account is
-- deleted by an administrator or by an Edge Function, not only by delete_my_account().
create function private.hand_over_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_next uuid;
begin
  for v_group in select id from public.groups where owner_id = old.id for update loop
    select user_id into v_next
    from public.group_members
    where group_id = v_group and user_id <> old.id
    order by joined_on, user_id
    limit 1;
    if v_next is null then
      delete from public.groups where id = v_group;
    else
      update public.group_members set role = 'member' where group_id = v_group and user_id = old.id;
      update public.group_members set role = 'owner' where group_id = v_group and user_id = v_next;
      update public.groups set owner_id = v_next where id = v_group;
    end if;
  end loop;
  return old;
end
$$;

-- A group has exactly one owner member, and it is groups.owner_id. Checked at the end of
-- the transaction, so that a group and its owner membership can be written in any order.
create function private.check_group_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_owner uuid;
begin
  if tg_table_name = 'groups' then
    v_group := new.id;
  elsif tg_op = 'DELETE' then
    v_group := old.group_id;
  else
    v_group := new.group_id;
  end if;
  select owner_id into v_owner from public.groups where id = v_group;
  if not found then
    return null; -- the group is gone (closed, or its last member left)
  end if;
  if (select count(*) from public.group_members where group_id = v_group and role = 'owner') <> 1
     or not exists (select 1 from public.group_members
                    where group_id = v_group and role = 'owner' and user_id = v_owner) then
    raise exception 'group_owner_mismatch' using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger groups_owner_is_member
  after insert or update of owner_id on public.groups
  deferrable initially deferred
  for each row execute function private.check_group_owner();
create constraint trigger group_members_one_owner_check
  after insert or update or delete on public.group_members
  deferrable initially deferred
  for each row execute function private.check_group_owner();

create trigger profiles_hand_over_groups
  before delete on public.profiles
  for each row execute function private.hand_over_groups();

-- ---------------------------------------------------------------------------
-- Privileges and row level security (deny by default)
-- ---------------------------------------------------------------------------

-- Supabase grants wide default privileges on new tables to anon and authenticated
-- (NOT VERIFIED here, see the doc); start from nothing whatever the defaults are.
revoke all on
  public.profiles, public.garden_summaries, public.friendships, public.blocks,
  public.invites, public.invite_attempts, public.nudges, public.groups,
  public.group_members, public.daily_readings, public.badges, public.reading_backups
from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.garden_summaries enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.invites enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.nudges enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.daily_readings enable row level security;
alter table public.badges enable row level security;
alter table public.reading_backups enable row level security;

-- profiles: I read, create and change my own row; others go through get_public_profiles().
grant select on public.profiles to authenticated;
grant insert (id, display_name, show_garden, show_level) on public.profiles to authenticated;
grant update (display_name, show_garden, show_level) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- garden_summaries: mine only. Friends use list_friends(), which hides column by column.
grant select, delete on public.garden_summaries to authenticated;
grant insert (user_id, level, hizb_completed, health, last_watered_on, streak_days, badge_count, updated_on)
  on public.garden_summaries to authenticated;
grant update (level, hizb_completed, health, last_watered_on, streak_days, badge_count, updated_on)
  on public.garden_summaries to authenticated;
create policy garden_summaries_select_own on public.garden_summaries for select to authenticated
  using (user_id = (select auth.uid()));
create policy garden_summaries_insert_own on public.garden_summaries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy garden_summaries_update_own on public.garden_summaries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy garden_summaries_delete_own on public.garden_summaries for delete to authenticated
  using (user_id = (select auth.uid()));

-- friendships: both people read the row; every change goes through a function.
grant select on public.friendships to authenticated;
create policy friendships_select_parties on public.friendships for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- blocks: only the blocker sees it (the blocked person must not find out). Blocking and
-- unblocking go through block_user() and unblock_user().
grant select on public.blocks to authenticated;
create policy blocks_select_blocker on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

-- invites: only the owner reads or revokes; codes are made by create_invite() and
-- used through accept_invite(). Nobody can list or look up another person's code.
grant select, delete on public.invites to authenticated;
create policy invites_select_owner on public.invites for select to authenticated
  using (owner_id = (select auth.uid()));
create policy invites_delete_owner on public.invites for delete to authenticated
  using (owner_id = (select auth.uid()));

-- invite_attempts: no policy and no privilege: reachable by the functions only.

-- nudges: sender and recipient read; sending goes through send_nudge().
grant select on public.nudges to authenticated;
create policy nudges_select_parties on public.nudges for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));

-- groups: members read; the owner renames; creation goes through create_group().
grant select on public.groups to authenticated;
grant update (name) on public.groups to authenticated;
create policy groups_select_members on public.groups for select to authenticated
  using (private.is_group_member(id));
create policy groups_update_owner on public.groups for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- group_members: members of the group read; changes go through functions.
grant select on public.group_members to authenticated;
create policy group_members_select_members on public.group_members for select to authenticated
  using (private.is_group_member(group_id));

-- daily_readings: mine only. Group members see sums through group_leaderboard().
grant select, delete on public.daily_readings to authenticated;
grant insert (user_id, day, new_pages) on public.daily_readings to authenticated;
grant update (new_pages) on public.daily_readings to authenticated;
create policy daily_readings_select_own on public.daily_readings for select to authenticated
  using (user_id = (select auth.uid()));
create policy daily_readings_insert_own on public.daily_readings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy daily_readings_update_own on public.daily_readings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy daily_readings_delete_own on public.daily_readings for delete to authenticated
  using (user_id = (select auth.uid()));

-- badges: I write mine; a friend reads them when I show my level (rule 4).
grant select, delete on public.badges to authenticated;
grant insert (user_id, khatm_number, completed_on) on public.badges to authenticated;
grant update (completed_on) on public.badges to authenticated;
create policy badges_select_own_or_friend on public.badges for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_level(user_id));
create policy badges_insert_own on public.badges for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy badges_update_own on public.badges for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy badges_delete_own on public.badges for delete to authenticated
  using (user_id = (select auth.uid()));

-- reading_backups: owner only, whatever the relation to anyone else.
grant select, delete on public.reading_backups to authenticated;
grant insert (user_id, journal, updated_on) on public.reading_backups to authenticated;
grant update (journal, updated_on) on public.reading_backups to authenticated;
create policy reading_backups_select_own on public.reading_backups for select to authenticated
  using (user_id = (select auth.uid()));
create policy reading_backups_insert_own on public.reading_backups for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy reading_backups_update_own on public.reading_backups for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reading_backups_delete_own on public.reading_backups for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Functions offered to the app (public schema = callable by the API)
-- Errors are raised as short codes: the reasons of src/domain/social/errors.ts, with
-- underscores. A blocked person gets person_unavailable, the answer for an account that
-- does not exist; the person who blocked gets you_blocked_them (they can undo it).
-- ---------------------------------------------------------------------------

-- Raises the right refusal when one of the two people blocks the other.
create function private.assert_no_block(p_me uuid, p_other uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.blocks where blocker_id = p_me and blocked_id = p_other) then
    raise exception 'you_blocked_them';
  end if;
  if exists (select 1 from public.blocks where blocker_id = p_other and blocked_id = p_me)
     or not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'person_unavailable';
  end if;
end
$$;

-- Rule 2. Returns 'pending' or 'accepted'.
create function public.send_friend_request(p_to uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  v_today date := private.today();
  f public.friendships;
begin
  if p_to is null then
    raise exception 'invalid_target';
  end if;
  if p_to = v_me then
    raise exception 'cannot_befriend_yourself';
  end if;
  perform private.assert_no_block(v_me, p_to);

  select * into f from public.friendships
  where (requester_id = v_me and addressee_id = p_to) or (requester_id = p_to and addressee_id = v_me)
  for update;

  if not found then
    insert into public.friendships (requester_id, addressee_id, status) values (v_me, p_to, 'pending');
    return 'pending';
  end if;

  if f.status = 'accepted' then
    raise exception 'already_friends';
  elsif f.status = 'pending' then
    if f.requester_id = v_me then
      raise exception 'request_already_sent';
    end if;
    update public.friendships set status = 'accepted', responded_on = v_today
    where requester_id = f.requester_id and addressee_id = f.addressee_id;
    return 'accepted';
  else
    -- declined: the person who was refused waits (from responded_on, 7 days); the person who
    -- refused does not, and the row changes direction.
    if f.requester_id = v_me and v_today < f.responded_on + private.friend_request_cooldown_days() then
      raise exception 'request_declined_recently';
    end if;
    delete from public.friendships
    where requester_id = f.requester_id and addressee_id = f.addressee_id;
    insert into public.friendships (requester_id, addressee_id, status) values (v_me, p_to, 'pending');
    return 'pending';
  end if;
end
$$;

-- Rule 2: only the addressee accepts or declines. p_other is the person who asked.
-- Returns 'accepted' or 'declined'.
create function public.respond_friend_request(p_other uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  v_status text := case when p_accept then 'accepted' else 'declined' end;
  f public.friendships;
begin
  if p_accept is null then
    raise exception 'invalid_answer';
  end if;
  select * into f from public.friendships
  where (requester_id = v_me and addressee_id = p_other) or (requester_id = p_other and addressee_id = v_me)
  for update;
  if not found or f.status <> 'pending' then
    raise exception 'no_pending_request';
  end if;
  if f.addressee_id <> v_me then
    raise exception 'not_the_addressee';
  end if;
  perform private.assert_no_block(v_me, p_other);
  update public.friendships set status = v_status, responded_on = private.today()
  where requester_id = f.requester_id and addressee_id = f.addressee_id;
  return v_status;
end
$$;

-- Rule 2: either friend ends an accepted friendship. A pending request cannot be taken
-- back, and a declined row is never removed (it holds the sender's waiting period).
create function public.remove_friendship(p_other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  v_count integer;
begin
  delete from public.friendships
  where status = 'accepted'
    and ((requester_id = v_me and addressee_id = p_other)
      or (requester_id = p_other and addressee_id = v_me));
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'not_friends';
  end if;
end
$$;

-- Rule 3: blocking removes an accepted friendship and a pending request (a declined one
-- stays, so that block then unblock does not erase the sender's wait), and the
-- encouragements between the two.
create function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
begin
  if p_target is null then
    raise exception 'invalid_target';
  end if;
  if p_target = v_me then
    raise exception 'cannot_block_yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'person_unavailable';
  end if;
  if exists (select 1 from public.blocks where blocker_id = v_me and blocked_id = p_target) then
    raise exception 'already_blocked';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_me, p_target);
  delete from public.friendships
  where status in ('accepted', 'pending')
    and ((requester_id = v_me and addressee_id = p_target)
      or (requester_id = p_target and addressee_id = v_me));
  delete from public.nudges
  where (from_id = v_me and to_id = p_target) or (from_id = p_target and to_id = v_me);
end
$$;

-- Rule 3: only the blocker lifts their own block; the friendship does not come back.
create function public.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  v_count integer;
begin
  delete from public.blocks where blocker_id = v_me and blocked_id = p_target;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'not_blocked';
  end if;
end
$$;

-- Rule 6: a new code, drawn by the server from a secure source (gen_random_uuid) with
-- rejection sampling (no bias). Returns the code and its last valid day (created + 7).
create function public.create_invite()
returns table (code text, expires_on date)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := private.require_profile();
  v_today date := private.today();
  -- INVITE_CODE_ALPHABET of src/domain/social/config.ts
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  -- bytes 6 and 8 of a version 4 uuid are partly fixed: not used
  v_positions constant integer[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15];
  v_bytes bytea;
  v_byte integer;
  v_code text;
  v_try integer;
  v_position integer;
begin
  if (select count(*) from public.invites i where i.owner_id = v_me and i.expires_on >= v_today)
       >= private.max_active_invites() then
    raise exception 'too_many_invites';
  end if;
  for v_try in 1 .. 5 loop
    v_code := '';
    while char_length(v_code) < 8 loop
      v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      foreach v_position in array v_positions loop
        v_byte := get_byte(v_bytes, v_position);
        if v_byte < 248 and char_length(v_code) < 8 then -- 248 = 8 * 31: the rest is dropped
          v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
        end if;
      end loop;
    end loop;
    begin
      insert into public.invites (code, owner_id, created_on, expires_on)
      values (v_code, v_me, v_today, v_today + private.invite_lifetime_days());
      return query select v_code, v_today + private.invite_lifetime_days();
      return;
    exception when unique_violation then
      null; -- extremely unlikely collision: draw again
    end;
  end loop;
  raise exception 'could_not_create_invite';
end
$$;

create function private.record_failed_attempt(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$ insert into public.invite_attempts (user_id) values (p_user) $$;

-- Rule 6. Returns 'accepted' or the reason of the refusal: invite_code_malformed,
-- invite_not_found, invite_expired, invite_is_yours, you_blocked_them, already_friends,
-- too_many_attempts. It returns the reason instead of raising because a raise would undo
-- the count of failed attempts: 10 per hour per account, then too_many_attempts.
-- When the owner blocked the person, the answer is invite_not_found (never "blocked").
-- A code serves several people until its last day (expires_on included).
create function public.accept_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  v_today date := private.today();
  v_invite public.invites;
  v_refusal text;
begin
  delete from public.invite_attempts
  where user_id = v_me and attempted_at < now() - interval '1 day';
  if (select count(*) from public.invite_attempts
      where user_id = v_me and attempted_at > now() - interval '1 hour') >= 10 then
    return 'too_many_attempts';
  end if;

  if p_code is null or p_code !~ '^[A-HJKMNP-Z2-9]{8}$' then
    v_refusal := 'invite_code_malformed';
  else
    select * into v_invite from public.invites where code = p_code;
    if not found or not exists (select 1 from public.profiles where id = v_invite.owner_id) then
      v_refusal := 'invite_not_found';
    elsif v_invite.expires_on < v_today then
      v_refusal := 'invite_expired';
    elsif v_invite.owner_id = v_me then
      v_refusal := 'invite_is_yours';
    elsif exists (select 1 from public.blocks where blocker_id = v_me and blocked_id = v_invite.owner_id) then
      v_refusal := 'you_blocked_them';
    elsif exists (select 1 from public.blocks where blocker_id = v_invite.owner_id and blocked_id = v_me) then
      v_refusal := 'invite_not_found';
    end if;
  end if;
  if v_refusal is not null then
    perform private.record_failed_attempt(v_me);
    return v_refusal;
  end if;

  perform 1 from public.friendships
  where (requester_id = v_me and addressee_id = v_invite.owner_id)
     or (requester_id = v_invite.owner_id and addressee_id = v_me)
  for update;
  if exists (select 1 from public.friendships
             where status = 'accepted'
               and ((requester_id = v_me and addressee_id = v_invite.owner_id)
                 or (requester_id = v_invite.owner_id and addressee_id = v_me))) then
    return 'already_friends';
  end if;
  -- a pending or declined request between the two is replaced: one row per pair
  delete from public.friendships
  where (requester_id = v_me and addressee_id = v_invite.owner_id)
     or (requester_id = v_invite.owner_id and addressee_id = v_me);
  insert into public.friendships (requester_id, addressee_id, status, created_on, responded_on)
  values (v_me, v_invite.owner_id, 'accepted', v_today, v_today);
  return 'accepted';
end
$$;

-- Rule 7: only toward an accepted friend, one per friend and per day, whatever the kind.
-- p_sent_on is the sender's day (default: the server's UTC day); it must be within one day
-- of it.
create function public.send_nudge(p_to uuid, p_kind text, p_sent_on date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  v_today date := private.today();
  v_day date := coalesce(p_sent_on, v_today);
begin
  if p_kind is null or p_kind not in ('encourage', 'congratulate') then
    raise exception 'invalid_kind';
  end if;
  if abs(v_day - v_today) > 1 then
    raise exception 'day_out_of_range';
  end if;
  if p_to is null or p_to = v_me then
    raise exception 'not_friends';
  end if;
  perform private.assert_no_block(v_me, p_to);
  if not private.are_friends(v_me, p_to) then
    raise exception 'not_friends';
  end if;
  begin
    insert into public.nudges (from_id, to_id, kind, sent_on) values (v_me, p_to, p_kind, v_day);
  exception when unique_violation then
    raise exception 'already_nudged_today';
  end;
end
$$;

-- Rule 8: the creator becomes the owner. Returns the group id.
create function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  v_problem text := private.name_problem(p_name);
  v_id uuid;
begin
  if v_problem is not null then
    raise exception '%', v_problem;
  end if;
  insert into public.groups (name, owner_id) values (p_name, v_me) returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, v_me, 'owner');
  return v_id;
end
$$;

-- Rule 8: a member adds one of their own accepted friends (the model has no pending
-- group invitation, so the person is added at once; they can leave at any time).
-- Someone who is not a member of the group gets group_not_found, whether it exists or not.
create function public.add_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
begin
  perform 1 from public.groups g
  where g.id = p_group
    and exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = v_me)
  for update;
  if not found then
    raise exception 'group_not_found';
  end if;
  if p_user is null or p_user = v_me then
    raise exception 'invalid_target';
  end if;
  perform private.assert_no_block(v_me, p_user);
  if exists (select 1 from public.group_members where group_id = p_group and user_id = p_user) then
    raise exception 'already_a_member';
  end if;
  if not private.are_friends(v_me, p_user) then
    raise exception 'not_friends';
  end if;
  if (select count(*) from public.group_members where group_id = p_group) >= private.max_group_members() then
    raise exception 'group_full';
  end if;
  insert into public.group_members (group_id, user_id, role) values (p_group, p_user, 'member');
end
$$;

-- Rule 8: leave a group. The owner of a group that has other members names who takes
-- over (p_successor); an owner who is alone closes the group.
create function public.leave_group(p_group uuid, p_successor uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_profile();
  g public.groups;
begin
  select * into g from public.groups
  where id = p_group
    and exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = v_me)
  for update;
  if not found then
    raise exception 'group_not_found';
  end if;
  if g.owner_id <> v_me then
    if p_successor is not null then
      raise exception 'invalid_successor';
    end if;
    delete from public.group_members where group_id = p_group and user_id = v_me;
    return;
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id <> v_me) then
    if p_successor is not null then
      raise exception 'successor_not_a_member';
    end if;
    delete from public.groups where id = p_group;
    return;
  end if;
  if p_successor is null then
    raise exception 'owner_must_hand_over';
  end if;
  if p_successor = v_me
     or not exists (select 1 from public.group_members where group_id = p_group and user_id = p_successor) then
    raise exception 'successor_not_a_member';
  end if;
  update public.group_members set role = 'member' where group_id = p_group and user_id = v_me;
  update public.group_members set role = 'owner' where group_id = p_group and user_id = p_successor;
  update public.groups set owner_id = p_successor where id = p_group;
  delete from public.group_members where group_id = p_group and user_id = v_me;
end
$$;

-- Rule 4: the name of other people. Nothing for a person who blocks me or whom I block.
create function public.get_public_profiles(p_ids uuid[])
returns table (id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := private.require_profile();
begin
  if p_ids is null or cardinality(p_ids) > 200 then
    raise exception 'invalid_ids';
  end if;
  return query
    select p.id, p.display_name
    from public.profiles p
    where p.id = any (p_ids)
      and (p.id = v_me or not private.blocked_between(v_me, p.id));
end
$$;

-- Rule 4: my accepted friends (nobody blocked) with their garden. Hidden values are null:
-- everything of the garden when show_garden is false; level and badge_count when
-- show_level is false. garden_visible / level_visible say which.
create function public.list_friends()
returns table (
  friend_id uuid,
  display_name text,
  garden_visible boolean,
  level_visible boolean,
  level integer,
  hizb_completed integer,
  health double precision,
  last_watered_on date,
  streak_days integer,
  badge_count integer,
  updated_on date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := private.require_profile();
begin
  return query
    select p.id, p.display_name, p.show_garden, p.show_level,
           case when p.show_level then g.level end,
           case when p.show_garden then g.hizb_completed end,
           case when p.show_garden then g.health end,
           case when p.show_garden then g.last_watered_on end,
           case when p.show_garden then g.streak_days end,
           case when p.show_level then g.badge_count end,
           case when p.show_garden or p.show_level then g.updated_on end
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester_id = v_me then f.addressee_id else f.requester_id end
    left join public.garden_summaries g on g.user_id = p.id
    where f.status = 'accepted'
      and (f.requester_id = v_me or f.addressee_id = v_me)
      and not private.blocked_between(v_me, p.id)
    order by p.display_name, p.id;
end
$$;

-- The same, for one friend (no row when that person is not my accepted, unblocked friend).
create function public.get_friend_garden(p_friend uuid)
returns table (
  friend_id uuid,
  display_name text,
  garden_visible boolean,
  level_visible boolean,
  level integer,
  hizb_completed integer,
  health double precision,
  last_watered_on date,
  streak_days integer,
  badge_count integer,
  updated_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.list_friends() l where l.friend_id = p_friend
$$;

-- Rule 8: the members of one of my groups, with their names.
create function public.list_group_members(p_group uuid)
returns table (user_id uuid, display_name text, role text, joined_on date)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_profile();
  if not private.is_group_member(p_group) then
    raise exception 'group_not_found';
  end if;
  return query
    select m.user_id, p.display_name, m.role, m.joined_on
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group
    order by m.joined_on, m.user_id;
end
$$;

-- Rule 9: sum of new_pages of each member between two days (included), rank 1 to the
-- largest, equal totals share a rank (1, 1, 3), listed by rank then user id; members with
-- no reading appear with 0. At most 366 days.
create function public.group_leaderboard(p_group uuid, p_from date, p_to date)
returns table (user_id uuid, display_name text, total_pages bigint, rank bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_profile();
  if not private.is_group_member(p_group) then
    raise exception 'group_not_found';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 then
    raise exception 'invalid_period';
  end if;
  return query
    select t.user_id, t.display_name, t.total_pages, rank() over (order by t.total_pages desc)
    from (
      select m.user_id, p.display_name, coalesce(sum(r.new_pages), 0)::bigint as total_pages
      from public.group_members m
      join public.profiles p on p.id = m.user_id
      left join public.daily_readings r
        on r.user_id = m.user_id and r.day between p_from and p_to
      where m.group_id = p_group
      group by m.user_id, p.display_name
    ) t
    order by 4, t.user_id;
end
$$;

-- Rule 10: delete my account. Removing the row of auth.users removes the profile and,
-- by cascade, everything else; the trigger on profiles hands over my groups first.
-- NOT VERIFIED on a real Supabase project: whether the owner of this function may delete
-- from auth.users (see docs/specs/social-database.md for the alternative).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = v_me;
end
$$;

-- ---------------------------------------------------------------------------
-- Who may call what. Postgres gives EXECUTE to everyone on a new function.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean),
  public.remove_friendship(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.create_invite(),
  public.accept_invite(text),
  public.send_nudge(uuid, text, date),
  public.create_group(text),
  public.add_group_member(uuid, uuid),
  public.leave_group(uuid, uuid),
  public.get_public_profiles(uuid[]),
  public.list_friends(),
  public.get_friend_garden(uuid),
  public.list_group_members(uuid),
  public.group_leaderboard(uuid, date, date),
  public.delete_my_account()
to authenticated;

-- Only what policies and check constraints call while the signed-in user runs a query
-- (Postgres checks the caller's right to run them at that moment).
grant execute on function
  private.is_group_member(uuid),
  private.can_view_level(uuid),
  private.name_problem(text)
to authenticated;
