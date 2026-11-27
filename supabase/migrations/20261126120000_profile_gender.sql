-- The gender a person says they have, so that friends are spoken of correctly ("Lire avec lui" /
-- "Lire avec elle", and the Arabic agreement). Decision of the owner, 26 November 2026: the app
-- asks for it, optionally; null means "not said" and every text then has a neutral wording.
--
-- Same rules as the rest of the profile (rule 4 of docs/specs/social.md): its owner reads and
-- changes it through the table; an accepted friend who is not blocked reads it through
-- list_friends() / get_friend_garden(), whatever the person hides of the garden and the level;
-- anyone else gets the name only (get_public_profiles() and search_profiles() are unchanged).
-- Nothing else about the policies changes: the new column is added to the two column grants.

alter table public.profiles
  add column gender text
    constraint profiles_gender_valid check (gender in ('male', 'female'));
comment on column public.profiles.gender is
  'male, female, or null when not said. Friends read it through list_friends(); nobody else.';

grant insert (gender) on public.profiles to authenticated;
grant update (gender) on public.profiles to authenticated;

-- list_friends() answers one column more. A function cannot change its columns in place: both
-- (get_friend_garden() is built on list_friends()) are dropped and made again, with the same
-- body as before plus the gender, and the same right to run them (signed-in users only).
drop function public.get_friend_garden(uuid);
drop function public.list_friends();

create function public.list_friends()
returns table (
  friend_id uuid,
  display_name text,
  gender text,
  garden_visible boolean,
  level_visible boolean,
  level integer,
  hizb_completed integer,
  health double precision,
  last_watered_on date,
  streak_days integer,
  badge_count integer,
  words_read bigint,
  verses_read bigint,
  hasanat_estimate bigint,
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
    select p.id, p.display_name, p.gender, p.show_garden, p.show_level,
           case when p.show_level then g.level end,
           case when p.show_garden then g.hizb_completed end,
           case when p.show_garden then g.health end,
           case when p.show_garden then g.last_watered_on end,
           case when p.show_garden then g.streak_days end,
           case when p.show_level then g.badge_count end,
           case when p.show_level then g.words_read end,
           case when p.show_level then g.verses_read end,
           case when p.show_level then g.hasanat_estimate end,
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

create function public.get_friend_garden(p_friend uuid)
returns table (
  friend_id uuid,
  display_name text,
  gender text,
  garden_visible boolean,
  level_visible boolean,
  level integer,
  hizb_completed integer,
  health double precision,
  last_watered_on date,
  streak_days integer,
  badge_count integer,
  words_read bigint,
  verses_read bigint,
  hasanat_estimate bigint,
  updated_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.list_friends() l where l.friend_id = p_friend
$$;

-- Postgres gives EXECUTE to everyone on a new function: the same lines as the end of the social
-- migration, for these two functions only.
revoke all on function public.list_friends(), public.get_friend_garden(uuid)
  from public, anon, authenticated;
grant execute on function public.list_friends(), public.get_friend_garden(uuid) to authenticated;
