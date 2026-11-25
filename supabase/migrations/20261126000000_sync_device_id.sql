-- A device name (DEVICE_ID_PATTERN), as sync.sql, but never a name that would write onto an
-- object's prototype when a phone files time under it (`__proto__`, `constructor`, `prototype`).
-- The app draws 20 random letters and digits, so no real phone is refused.
create or replace function private.sync_device(p_value jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_value) = 'string'
      and (p_value #>> '{}') ~ '^[A-Za-z0-9_-]{1,40}$'
      and (p_value #>> '{}') not in ('__proto__', 'constructor', 'prototype')
      then p_value #>> '{}'
  end
$$;
