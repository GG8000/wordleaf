-- Wordleaf: the player map also shows where people played before, not only who is playing now.
-- player_locations.updated_at is the last time a player joined from that spot. Locations are
-- kept for a year instead of 7 days. player_map() now returns, per rounded spot, how many
-- players are there right now, how many played there in the last 7 days, and how many in total.

create or replace function public.set_location(p_lat double precision, p_lon double precision)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'invalid_location';
  end if;
  insert into player_locations (user_id, lat, lon)
  values (uid, round(p_lat::numeric, 1), round(p_lon::numeric, 1))
  on conflict (user_id) do update set lat = excluded.lat, lon = excluded.lon, updated_at = now();
  delete from player_locations where updated_at < now() - interval '1 year';
end $$;

drop function public.player_map();

create function public.player_map()
returns table (lat real, lon real, players_now int, players_week int, players_total int)
language sql stable security definer set search_path = public as $$
  with active as (
    select distinct user_id from heartbeats where last_seen >= now() - _player_timeout()
  )
  select l.lat, l.lon,
         count(a.user_id)::int,
         count(*) filter (where a.user_id is not null or l.updated_at >= now() - interval '7 days')::int,
         count(*)::int
  from player_locations l
  left join active a on a.user_id = l.user_id
  group by l.lat, l.lon
$$;

grant execute on function public.player_map() to anon, authenticated;
