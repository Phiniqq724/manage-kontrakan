-- Daily piket reminder (2026-10-16)
-- Every day at 07:00 WIB, push a reminder to each member on piket that day.
-- Nothing is deleted.

create extension if not exists pg_net;

/**
 * Sends "it's your piket day" pushes for today (Asia/Jakarta) to everyone
 * assigned and not done yet, naming their partner. Posts straight to the
 * Expo push API with pg_net, using the owner-only push_tokens table.
 */
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
    'title', 'Hari ini giliran piket kamu',
    'body', case
      when partner.name is null then 'Jangan lupa piket hari ini dan upload buktinya ya.'
      else 'Kamu piket bareng ' || partner.name || ' hari ini. Jangan lupa upload buktinya ya.'
    end,
    'data', jsonb_build_object('type', 'piket_reminder', 'day', today)
  ))
  into messages
  from public.pikets p
  join public.push_tokens t on t.user_id = p.assign_to
  left join lateral (
    select split_part(u.fullname, ' ', 1) as name
    from public.pikets p2
    join public.users u on u.id = p2.assign_to
    where p2.day = p.day and p2.id <> p.id
    limit 1
  ) partner on true
  where p.day = today
    and p.status <> 'done';

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

-- 00:00 UTC = 07:00 WIB. Re-running this replaces the job instead of duplicating it.
select cron.schedule(
  'piket-reminder-daily',
  '0 0 * * *',
  'select public.send_piket_reminders();'
);
