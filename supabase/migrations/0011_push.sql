-- Wordleaf: push notifications for duels.
-- The browser stores its Web Push subscription with save_push_subscription(). Every new row in
-- `notifications` (written by the duel RPCs in 0010) is posted by a trigger, via pg_net, to the
-- `send-push` Edge Function, which sends it to all subscriptions of that user.
--
-- The function URL and a shared secret come from Supabase Vault. Until both are set, the
-- trigger does nothing, so duels work fine without push:
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<random string, same as PUSH_HOOK_SECRET>', 'push_hook_secret');

create extension if not exists pg_net with schema extensions;

-- One row per browser/device. No client access, only the RPCs below.
create table public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  lang        text not null default 'en' check (lang in ('en', 'de', 'fr')),
  updated_at  timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- Store (or move to the caller) a subscription. Called on every app start, since endpoints change.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'en')
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 2000
     or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'invalid_subscription';
  end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth, lang)
  values (p_endpoint, uid, p_p256dh, p_auth, case when p_lang in ('en', 'de', 'fr') then p_lang else 'en' end)
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    lang = excluded.lang, updated_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

grant execute on function
  public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text)
to authenticated;
revoke execute on function
  public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text)
from public, anon;

-- Hand each new notification to the Edge Function (asynchronously, so RPCs never wait on it)
create or replace function public._post_notification()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if v_url is null or v_secret is null then return new; end if;
  if not exists (select 1 from push_subscriptions where user_id = new.user_id) then return new; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'user_id', new.user_id, 'kind', new.kind, 'duel_id', new.duel_id,
      'actor_name', new.actor_name, 'points', new.points),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
  );
  return new;
end $$;
revoke all on function public._post_notification() from public, anon, authenticated;

create trigger post_notification after insert on public.notifications
  for each row execute function public._post_notification();
