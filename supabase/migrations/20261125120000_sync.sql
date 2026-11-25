-- Sync lot (docs/specs/sync.md; docs/DECISIONS.md, D43): the account's copy of the progress.
--
-- Depends on 20261124230000_social.sql only for the schema `private` and its grants; the
-- tables point at auth.users, so the sync works before a social profile exists.
--
-- Design in one paragraph: each phone sends events (a page first read, a phone's time on a
-- day, a setting, a bookmark, a pause), identified by their content, and reads back the events
-- of all the person's phones by sequence number. Rows are only ever the owner's: RLS lets a
-- signed-in person read their own rows and nothing else, and nobody writes the tables directly.
-- Writing goes through sync_push, reading through sync_pull: security definer functions with an
-- empty search_path that check who calls, validate every event (a malformed one is skipped and
-- counted, never stored), bound the size of each event, of each request and of each account,
-- and limit the number of calls per minute. An event that another event of the same thing
-- outranks for good (an older time counter of the same phone and day, an older choice of the
-- same setting) is deleted, so that an account holds about one row per page read, per phone and
-- day, per setting and per bookmark. The merge rules are the app's (src/domain/sync): this file
-- only removes what those rules would ignore anyway.

-- ---------------------------------------------------------------------------
-- Settings of the sync (mirror of SYNC_CONFIG, src/domain/sync/config.ts)
-- ---------------------------------------------------------------------------
create function private.sync_max_clock_lead_ms() returns bigint
language sql immutable set search_path = '' as $$ select 86400000::bigint $$;
create function private.sync_max_push() returns integer
language sql immutable set search_path = '' as $$ select 200 $$;
create function private.sync_max_pull() returns integer
language sql immutable set search_path = '' as $$ select 1000 $$;
create function private.sync_max_calls_per_minute() returns integer
language sql immutable set search_path = '' as $$ select 120 $$;
create function private.sync_max_events() returns integer
language sql immutable set search_path = '' as $$ select 100000 $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per account that has synced: the last sequence number given, the number of events
-- kept, and the window of the rate limit. Nobody reads or writes it directly.
create table public.sync_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seq bigint not null default 0 constraint sync_accounts_last_seq_range check (last_seq >= 0),
  event_count integer not null default 0
    constraint sync_accounts_event_count_range check (event_count >= 0),
  window_started_at timestamptz not null default now(),
  window_calls integer not null default 0
    constraint sync_accounts_window_calls_range check (window_calls >= 0)
);

-- The events of one person's phones. `id` is the content of the event (eventId in
-- src/domain/sync/events.ts); `seq` orders them per account; `merge_key` names the thing the
-- event is about (a page of a khatma, a phone's day, a setting, a bookmark, a pause).
create table public.sync_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null constraint sync_events_id_format check (id ~ '^[A-Za-z0-9._-]{1,160}$'),
  seq bigint not null constraint sync_events_seq_range check (seq >= 1),
  kind text not null
    constraint sync_events_kind_valid check (kind in ('page', 'time', 'setting', 'bookmark', 'pause')),
  merge_key text not null constraint sync_events_merge_key_size check (char_length(merge_key) <= 200),
  event jsonb not null
    constraint sync_events_event_is_object check (jsonb_typeof(event) = 'object')
    constraint sync_events_event_size check (octet_length(event::text) <= 2048),
  received_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint sync_events_one_seq unique (user_id, seq)
);
create index sync_events_merge_idx on public.sync_events (user_id, merge_key);
comment on table public.sync_events is
  'Progress of one person, as events. Owner only: read by policy, written by sync_push().';

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------

-- The server clock in milliseconds since 1970 (the transaction's time).
create function private.sync_now_ms() returns bigint
language sql stable set search_path = '' as $$
  select (extract(epoch from now()) * 1000)::bigint
$$;

-- A whole JSON number from 0 written with at most 16 digits, or null.
create function private.sync_int(p_value jsonb) returns bigint
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_value) = 'number' and p_value::text ~ '^[0-9]{1,16}$'
      then p_value::text::bigint
  end
$$;

-- A real day written YYYY-MM-DD, from 2020-01-01 to the server's UTC day + 1, or null.
create function private.sync_date(p_value jsonb) returns date
language plpgsql immutable set search_path = '' as $$
declare
  v_text text;
  v_day date;
begin
  if coalesce(jsonb_typeof(p_value), '') <> 'string' then
    return null;
  end if;
  v_text := p_value #>> '{}';
  if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return null;
  end if;
  begin
    v_day := v_text::date;
  exception when others then
    return null;
  end;
  if to_char(v_day, 'YYYY-MM-DD') <> v_text then
    return null;
  end if;
  return v_day;
end
$$;

create function private.sync_day_ok(p_day date) returns boolean
language sql stable set search_path = '' as $$
  select p_day is not null
    and p_day >= date '2020-01-01'
    and p_day <= (now() at time zone 'utc')::date + 1
$$;

-- A device name (DEVICE_ID_PATTERN) or null.
create function private.sync_device(p_value jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^[A-Za-z0-9_-]{1,40}$'
      then p_value #>> '{}'
  end
$$;

-- The event as the server keeps it: checked field by field and rebuilt with its known fields
-- only, the stamp of a setting or bookmark brought back to at most a day ahead of the server's
-- clock. Null for anything malformed.
create function private.sync_clean_event(p_event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_kind text;
  v_khatm bigint;
  v_page bigint;
  v_day date;
  v_from date;
  v_to date;
  v_device text;
  v_app bigint;
  v_reader bigint;
  v_at bigint;
  v_key text;
begin
  if coalesce(jsonb_typeof(p_event), '') <> 'object' or octet_length(p_event::text) > 2048 then
    return null;
  end if;
  v_kind := p_event ->> 'kind';
  if v_kind in ('setting', 'bookmark') then
    v_device := private.sync_device(p_event -> 'device');
    v_at := private.sync_int(p_event -> 'at');
    if v_device is null or v_at is null or v_at > 9007199254740991 then
      return null;
    end if;
    v_at := least(v_at, private.sync_now_ms() + private.sync_max_clock_lead_ms());
  end if;

  if v_kind = 'page' then
    v_khatm := private.sync_int(p_event -> 'khatm');
    v_page := private.sync_int(p_event -> 'page');
    v_day := private.sync_date(p_event -> 'date');
    if v_khatm between 1 and 10000 and v_page between 1 and 604 and private.sync_day_ok(v_day) then
      return jsonb_build_object('kind', 'page', 'khatm', v_khatm, 'page', v_page,
        'date', to_char(v_day, 'YYYY-MM-DD'));
    end if;
  elsif v_kind = 'time' then
    v_device := private.sync_device(p_event -> 'device');
    v_day := private.sync_date(p_event -> 'date');
    v_app := private.sync_int(p_event -> 'app');
    v_reader := private.sync_int(p_event -> 'reader');
    if v_device is not null and private.sync_day_ok(v_day)
      and v_app between 0 and 90000 and v_reader between 0 and v_app then
      return jsonb_build_object('kind', 'time', 'device', v_device,
        'date', to_char(v_day, 'YYYY-MM-DD'), 'app', v_app, 'reader', v_reader);
    end if;
  elsif v_kind = 'setting' then
    v_key := p_event ->> 'key';
    if jsonb_typeof(p_event -> 'key') = 'string' and v_key ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'
      and p_event ? 'value' and octet_length((p_event -> 'value')::text) <= 1024 then
      return jsonb_build_object('kind', 'setting', 'key', v_key, 'value', p_event -> 'value',
        'at', v_at, 'device', v_device);
    end if;
  elsif v_kind = 'bookmark' then
    v_page := private.sync_int(p_event -> 'page');
    if v_page between 1 and 604 and jsonb_typeof(p_event -> 'on') = 'boolean' then
      return jsonb_build_object('kind', 'bookmark', 'page', v_page, 'on', p_event -> 'on',
        'at', v_at, 'device', v_device);
    end if;
  elsif v_kind = 'pause' then
    v_from := private.sync_date(p_event -> 'from');
    v_to := private.sync_date(p_event -> 'to');
    if private.sync_day_ok(v_from) and private.sync_day_ok(v_to) and v_from <= v_to then
      return jsonb_build_object('kind', 'pause', 'from', to_char(v_from, 'YYYY-MM-DD'),
        'to', to_char(v_to, 'YYYY-MM-DD'));
    end if;
  end if;
  return null;
end
$$;

-- What the event is about: two events with the same key are two states of the same thing.
create function private.sync_merge_key(p_id text, p_event jsonb) returns text
language sql immutable set search_path = '' as $$
  select case p_event ->> 'kind'
    when 'page' then 'page:' || (p_event ->> 'khatm') || ':' || (p_event ->> 'page')
    when 'time' then 'time:' || (p_event ->> 'device') || ':' || (p_event ->> 'date')
    when 'setting' then 'setting:' || (p_event ->> 'key')
    when 'bookmark' then 'bookmark:' || (p_event ->> 'page')
    else 'pause:' || p_id
  end
$$;

-- Settings settled by the newest choice (rule `latest` of src/store/sync-bridge.ts): only those
-- are compacted by stamp. The seed (oldest wins) and the introduction (true wins) are kept whole.
create function private.sync_is_latest_setting(p_key text) returns boolean
language sql immutable set search_path = '' as $$
  select p_key not in ('userSeed', 'onboardingCompleted')
$$;

-- The signed-in caller's account row, created at the first call, locked for the transaction (so
-- one account's calls follow each other and sequence numbers are given in commit order), and
-- counted against the limit of calls per minute. Raises not_authenticated, sync_rate_limited.
create function private.sync_enter() returns public.sync_accounts
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_account public.sync_accounts;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.sync_accounts (user_id) values (v_me) on conflict (user_id) do nothing;
  select * into v_account from public.sync_accounts where user_id = v_me for update;
  if v_account.window_started_at <= now() - interval '1 minute' then
    v_account.window_started_at := now();
    v_account.window_calls := 0;
  end if;
  if v_account.window_calls >= private.sync_max_calls_per_minute() then
    raise exception 'sync_rate_limited';
  end if;
  v_account.window_calls := v_account.window_calls + 1;
  update public.sync_accounts
    set window_started_at = v_account.window_started_at, window_calls = v_account.window_calls
    where user_id = v_me;
  return v_account;
end
$$;

-- ---------------------------------------------------------------------------
-- The API
-- ---------------------------------------------------------------------------

-- Sends events: p_events is a list of at most 200 { "id": text, "event": object }. An event
-- already kept, or outranked by one already kept, is not stored again; a malformed one is
-- skipped and counted. Returns { accepted, rejected, server_now }. Errors: not_authenticated,
-- sync_rate_limited, sync_too_many_events, sync_quota_exceeded.
create function public.sync_push(p_events jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.sync_accounts := private.sync_enter();
  v_me uuid := v_account.user_id;
  v_seq bigint := v_account.last_seq;
  v_count integer := v_account.event_count;
  v_item jsonb;
  v_id text;
  v_event jsonb;
  v_key text;
  v_kind text;
  v_removed integer;
  v_inserted integer;
  v_accepted integer := 0;
  v_rejected integer := 0;
begin
  if coalesce(jsonb_typeof(p_events), '') <> 'array'
    or jsonb_array_length(p_events) > private.sync_max_push() then
    raise exception 'sync_too_many_events';
  end if;

  for v_item in select value from jsonb_array_elements(p_events) loop
    v_id := v_item ->> 'id';
    v_event := private.sync_clean_event(v_item -> 'event');
    if coalesce(jsonb_typeof(v_item -> 'id'), '') <> 'string'
      or coalesce(v_id !~ '^[A-Za-z0-9._-]{1,160}$', true)
      or v_event is null then
      v_rejected := v_rejected + 1;
      continue;
    end if;
    v_kind := v_event ->> 'kind';
    v_key := private.sync_merge_key(v_id, v_event);

    -- Outranked by an event already kept: nothing to store (the app would ignore it).
    if exists (
      select 1 from public.sync_events r
      where r.user_id = v_me and r.merge_key = v_key and r.id <> v_id and (
        (v_kind = 'page' and (r.event ->> 'date') <= (v_event ->> 'date'))
        or (v_kind = 'time'
          and (r.event ->> 'app')::bigint >= (v_event ->> 'app')::bigint
          and (r.event ->> 'reader')::bigint >= (v_event ->> 'reader')::bigint)
        or ((v_kind = 'bookmark'
            or (v_kind = 'setting' and private.sync_is_latest_setting(v_event ->> 'key')))
          and ((r.event ->> 'at')::bigint > (v_event ->> 'at')::bigint
            or ((r.event ->> 'at')::bigint = (v_event ->> 'at')::bigint
              and (r.event ->> 'device') collate "C" >= (v_event ->> 'device') collate "C")))
      )
    ) then
      continue;
    end if;

    -- Events this one outranks are gone for good.
    delete from public.sync_events r
    where r.user_id = v_me and r.merge_key = v_key and r.id <> v_id and (
      (v_kind = 'page' and (r.event ->> 'date') > (v_event ->> 'date'))
      or (v_kind = 'time'
        and (r.event ->> 'app')::bigint <= (v_event ->> 'app')::bigint
        and (r.event ->> 'reader')::bigint <= (v_event ->> 'reader')::bigint)
      or ((v_kind = 'bookmark'
          or (v_kind = 'setting' and private.sync_is_latest_setting(v_event ->> 'key')))
        and ((r.event ->> 'at')::bigint < (v_event ->> 'at')::bigint
          or ((r.event ->> 'at')::bigint = (v_event ->> 'at')::bigint
            and (r.event ->> 'device') collate "C" < (v_event ->> 'device') collate "C")))
    );
    get diagnostics v_removed = row_count;
    v_count := v_count - v_removed;

    if v_count >= private.sync_max_events() then
      raise exception 'sync_quota_exceeded';
    end if;
    insert into public.sync_events (user_id, id, seq, kind, merge_key, event)
      values (v_me, v_id, v_seq + 1, v_kind, v_key, v_event)
      on conflict (user_id, id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      v_seq := v_seq + 1;
      v_count := v_count + 1;
      v_accepted := v_accepted + 1;
    end if;
  end loop;

  update public.sync_accounts set last_seq = v_seq, event_count = v_count where user_id = v_me;
  return jsonb_build_object('accepted', v_accepted, 'rejected', v_rejected,
    'server_now', private.sync_now_ms());
end
$$;

-- Reads the caller's events after p_after (0 for all), oldest first, at most p_limit (1 to
-- 1000). Returns { events, cursor, has_more, server_now }. Errors: not_authenticated,
-- sync_rate_limited, sync_invalid_cursor, sync_invalid_limit.
create function public.sync_pull(p_after bigint, p_limit integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.sync_accounts := private.sync_enter();
  v_limit integer;
  v_result jsonb;
begin
  if p_after is null or p_after < 0 then
    raise exception 'sync_invalid_cursor';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'sync_invalid_limit';
  end if;
  v_limit := least(p_limit, private.sync_max_pull());
  with page as (
    select seq, event from public.sync_events
    where user_id = v_account.user_id and seq > p_after
    order by seq
    limit v_limit + 1
  ), kept as (
    select seq, event from page order by seq limit v_limit
  )
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(event order by seq) from kept), '[]'::jsonb),
    'cursor', coalesce((select max(seq) from kept), p_after),
    'has_more', (select count(*) from page) > v_limit,
    'server_now', private.sync_now_ms())
  into v_result;
  return v_result;
end
$$;

-- ---------------------------------------------------------------------------
-- Privileges and row level security (deny by default)
-- ---------------------------------------------------------------------------
revoke all on public.sync_accounts, public.sync_events from public, anon, authenticated;
alter table public.sync_accounts enable row level security;
alter table public.sync_events enable row level security;

-- sync_events: the owner reads their own rows (to look at or export them); nobody writes them
-- directly. sync_accounts: no privilege, no policy: the functions only.
grant select on public.sync_events to authenticated;
create policy sync_events_select_own on public.sync_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Postgres gives EXECUTE to everyone on a new function: take it back, function by function
-- (the social migration's grants stay as they are).
revoke all on function
  private.sync_max_clock_lead_ms(),
  private.sync_max_push(),
  private.sync_max_pull(),
  private.sync_max_calls_per_minute(),
  private.sync_max_events(),
  private.sync_now_ms(),
  private.sync_int(jsonb),
  private.sync_date(jsonb),
  private.sync_day_ok(date),
  private.sync_device(jsonb),
  private.sync_clean_event(jsonb),
  private.sync_merge_key(text, jsonb),
  private.sync_is_latest_setting(text),
  private.sync_enter(),
  public.sync_push(jsonb),
  public.sync_pull(bigint, integer)
from public, anon, authenticated;

grant execute on function public.sync_push(jsonb), public.sync_pull(bigint, integer)
to authenticated;
