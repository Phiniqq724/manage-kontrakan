-- Notification type mutes (2026-10-17)
-- Each user's muted notification types live next to their push token, so the
-- server can skip them. Owners already have update rights on their row.
-- Nothing is deleted.

alter table public.push_tokens
  add column if not exists muted_types text[] not null default '{}';

-- Daily piket reminder: skip people who muted "piket".
create or replace function public.send_piket_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', 'Piket hari ini',
    'body', 'Kamu hari ini jadi PIC kontrakan, semangat!',
    'data', jsonb_build_object('type', 'piket_reminder', 'day', today)
  ))
  into messages
  from public.pikets p
  join public.push_tokens t on t.user_id = p.assign_to
  where p.day = today
    and p.status <> 'done'
    and not ('piket' = any(t.muted_types));

  if messages is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
end;
$$;

revoke execute on function public.send_piket_reminders() from public, anon, authenticated;
