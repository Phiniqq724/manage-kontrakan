-- Piket reminder wording (2026-10-17)
-- Same daily 07:00 WIB job (piket-reminder-daily); only the message changes.

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
