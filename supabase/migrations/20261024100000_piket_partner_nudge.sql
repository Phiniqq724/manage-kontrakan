-- Piket partner nudge (2026-10-24)
-- When someone finishes their scheduled piket, the other person on that day's
-- schedule (if still not done) gets "X udah piket loh, semales itu kah?" with
-- two buttons, answered straight from the notification (the app's background
-- task calls respond_piket_partner, the app never opens):
--   10 menit lagi  the same push again in 10 minutes while still not done;
--                  can be snoozed again
--   Malas          X hears about it, and the 16:30 / 19:30 "malas" reminders
--                  turn on for today (same as Malas on the morning plan)
--
-- Also: every scheduled reminder (piket slots, 07:00 report, shopping) now
-- arrives a random 10-20 minutes after its slot, per message, so they don't
-- all land at once. Instant pushes (events, the partner nudge) are unchanged.

create table if not exists public.piket_partner_snoozes (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  -- null once sent or cancelled (rows are kept; nothing is ever deleted)
  due_at timestamptz,
  primary key (user_id, day)
);

alter table public.piket_partner_snoozes enable row level security;
revoke all on public.piket_partner_snoozes from anon, authenticated;

/**
 * The partner push for `p_user` on `p_day`, or null when there is nothing to
 * say: their own scheduled piket is done, nobody else has finished yet, they
 * muted piket notifications, or they have no push token.
 */
create or replace function public.piket_partner_message(p_user uuid, p_day date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with done_names as (
    select array_agg(distinct split_part(u.fullname, ' ', 1)) as names
    from public.pikets p
    join public.users u on u.id = p.assign_to
    where p.day = p_day and not p.extra and p.status = 'done' and p.assign_to <> p_user
  )
  select jsonb_build_object(
    'to', t.token,
    'title', 'Partner piketmu udah beres',
    'body', public.join_names(d.names) || ' udah piket loh, semales itu kah?',
    'categoryId', 'piket_partner',
    'data', jsonb_build_object('type', 'piket_nudge', 'day', p_day, 'slot', 'partner')
  )
  from done_names d
  join public.push_tokens t on t.user_id = p_user
  where d.names is not null
    and not ('piket' = any(coalesce(t.muted_types, '{}')))
    and exists (
      select 1 from public.pikets p
      where p.day = p_day and not p.extra and p.assign_to = p_user
        and p.status in ('pending', 'izin', 'rejected'))
  limit 1;
$$;

revoke execute on function public.piket_partner_message(uuid, date) from public, anon, authenticated;

-- Scheduled sends (cron jobs that set app.push_jitter = on) don't go out at
-- once: each message waits a random 10-20 minutes in this queue, so a slot's
-- pushes don't all land at the same moment.
create table if not exists public.push_queue (
  id bigserial primary key,
  send_at timestamptz not null,
  message jsonb not null,
  sent_at timestamptz
);
create index if not exists push_queue_due_idx on public.push_queue (send_at) where sent_at is null;
alter table public.push_queue enable row level security;
revoke all on public.push_queue from anon, authenticated;

/**
 * Sends a batch of Expo push messages (no-op for an empty batch). Inside a
 * scheduled job (app.push_jitter = on) each message is queued for a random
 * 10-20 minutes later instead.
 */
create or replace function public.send_expo_pushes(p_messages jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_messages is null or jsonb_array_length(p_messages) = 0 then
    return;
  end if;
  if current_setting('app.push_jitter', true) = 'on' then
    insert into public.push_queue (send_at, message)
    select now() + (10 + random() * 10) * interval '1 minute', m
    from jsonb_array_elements(p_messages) m;
    return;
  end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := p_messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
end;
$$;

revoke execute on function public.send_expo_pushes(jsonb) from public, anon, authenticated;

/** Same as before, but sends through send_expo_pushes so scheduled jobs get the delay. */
create or replace function public.push_users(
  p_ids uuid[],
  p_title text,
  p_body text,
  p_type text,
  p_data jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.send_expo_pushes((
    select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', p_title,
      'body', p_body,
      'data', p_data || jsonb_build_object('type', p_type)
    ))
    from public.push_tokens t
    where t.user_id = any(p_ids)
      and not (p_type = any(coalesce(t.muted_types, '{}')))
  ));
end;
$$;

-- Piket reminders now send through send_expo_pushes too (body otherwise unchanged).
create or replace function public.send_piket_nudge(p_slot text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
  weekend boolean := extract(isodow from today) >= 6;
  pools text[];
  messages jsonb;
begin
  pools := case p_slot
    when 'dawn'      then array['dawn']
    when 'depart'    then array['depart']
    when 'lunch'     then array['midday']
    when 'afternoon' then array['afternoon']
    when 'malas_1'   then array['midday', 'afternoon']
    when 'evening'   then array['evening']
    when 'malas_2'   then array['midday', 'evening']
    when 'night'     then array['night']
    when 'last'      then array['last']
  end;
  if pools is null then
    raise exception 'Unknown piket nudge slot: %', p_slot;
  end if;

  if (p_slot = 'depart' and weekend) or (p_slot = 'lunch' and not weekend) then
    return;
  end if;

  with targets as (
    select distinct on (p.assign_to)
      p.assign_to as user_id,
      t.token,
      (select split_part(u.fullname, ' ', 1)
         from public.pikets p2
         join public.users u on u.id = p2.assign_to
        where p2.day = today and not p2.extra and p2.assign_to <> p.assign_to
        limit 1) as partner
    from public.pikets p
    join public.push_tokens t on t.user_id = p.assign_to
    left join public.piket_plan_responses r on r.user_id = p.assign_to and r.day = today
    where p.day = today
      and not p.extra
      and p.status in ('pending', 'izin', 'rejected')
      and not ('piket' = any(coalesce(t.muted_types, '{}')))
      and not exists (
        select 1 from public.piket_nudge_log l
        where l.user_id = p.assign_to and l.day = today and l.slot = p_slot)
      and case p_slot
        when 'afternoon' then r.response is distinct from 'ya'
        when 'malas_1'   then r.response = 'malas'
        when 'malas_2'   then r.response = 'malas'
        else true
      end
  ),
  picked as (
    select tg.user_id, tg.token, tg.partner, tpl.key, tpl.title, tpl.body, tpl.category_id
    from targets tg
    cross join lateral (
      select x.*
      from public.piket_nudge_templates x
      where x.pool = any(pools)
        and (tg.partner is not null or (x.title || x.body) not like '%{partner}%')
        and not exists (
          select 1 from public.piket_nudge_log l
          where l.user_id = tg.user_id and l.day = today and l.template_key = x.key)
      order by
        exists (
          select 1 from public.piket_nudge_log l
          where l.user_id = tg.user_id and l.template_key = x.key and l.day > today - 14),
        random()
      limit 1
    ) tpl
  ),
  logged as (
    insert into public.piket_nudge_log (user_id, day, slot, template_key)
    select user_id, today, p_slot, key from picked
    on conflict do nothing
    returning user_id
  )
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'to', pk.token,
    'title', replace(pk.title, '{partner}', coalesce(pk.partner, '')),
    'body', replace(pk.body, '{partner}', coalesce(pk.partner, '')),
    'categoryId', pk.category_id,
    'data', jsonb_build_object('type', 'piket_nudge', 'day', today, 'slot', p_slot)
  )))
  into messages
  from picked pk
  join logged lg on lg.user_id = pk.user_id;

  perform public.send_expo_pushes(messages);
end;
$$;

/**
 * Every minute: sends queued messages that are due. A piket reminder is
 * dropped if that person finished their piket while it waited.
 */
create or replace function public.flush_push_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
begin
  with due as (
    update public.push_queue set sent_at = now()
    where sent_at is null and send_at <= now()
    returning message
  )
  select jsonb_agg(q.message) into messages
  from due q
  where q.message->'data'->>'type' is distinct from 'piket_nudge'
     or exists (
       select 1
       from public.push_tokens t
       join public.pikets p on p.assign_to = t.user_id
       where t.token = q.message->>'to'
         and p.day = (q.message->'data'->>'day')::date
         and not p.extra
         and p.status in ('pending', 'izin', 'rejected'));
  perform public.send_expo_pushes(messages);
end;
$$;

revoke execute on function public.flush_push_queue() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: a scheduled piket for today just became done.
-- ---------------------------------------------------------------------------
create or replace function public.piket_partner_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if new.status <> 'done'
     or old.status is not distinct from new.status
     or new.extra
     or new.day <> today
     or current_setting('app.piket_sync', true) = 'on' then
    return new;
  end if;

  perform public.send_expo_pushes((
    select jsonb_agg(m)
    from (
      select public.piket_partner_message(p.assign_to, today) as m
      from public.pikets p
      where p.day = today and not p.extra and p.assign_to <> new.assign_to
        and p.status in ('pending', 'izin', 'rejected')
    ) s
    where m is not null
  ));
  return new;
end;
$$;

create or replace trigger piket_partner_notify
  after update on public.pikets
  for each row execute function public.piket_partner_notify();

-- ---------------------------------------------------------------------------
-- Button answers, from the partner's phone.
-- ---------------------------------------------------------------------------
create or replace function public.respond_piket_partner(p_day date, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Jakarta')::date;
  my_name text;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if p_action not in ('snooze', 'malas') then
    raise exception 'Invalid action: %', p_action;
  end if;
  -- Late taps (another day) or taps after finishing piket do nothing.
  if p_day is distinct from today or not exists (
    select 1 from public.pikets p
    where p.day = today and not p.extra and p.assign_to = me
      and p.status in ('pending', 'izin', 'rejected')) then
    return;
  end if;

  if p_action = 'snooze' then
    insert into public.piket_partner_snoozes (user_id, day, due_at)
    values (me, today, now() + interval '10 minutes')
    on conflict (user_id, day) do update set due_at = excluded.due_at;
    return;
  end if;

  update public.piket_partner_snoozes set due_at = null where user_id = me and day = today;
  insert into public.piket_plan_responses (user_id, day, response)
  values (me, today, 'malas')
  on conflict (user_id, day) do update set response = 'malas', responded_at = now();

  select split_part(fullname, ' ', 1) into my_name from public.users where id = me;
  perform public.push_users(
    array(
      select distinct p.assign_to from public.pikets p
      where p.day = today and not p.extra and p.status = 'done' and p.assign_to <> me),
    'Partner piketmu',
    coalesce(my_name, 'Partnermu') || ' bilang malas piket hari ini.',
    'piket'
  );
end;
$$;

revoke execute on function public.respond_piket_partner(date, text) from public, anon;
grant execute on function public.respond_piket_partner(date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Every minute: resend snoozed nudges that are due (only if still not done).
-- ---------------------------------------------------------------------------
create or replace function public.send_piket_partner_snoozes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
begin
  with due as (
    update public.piket_partner_snoozes set due_at = null
    where due_at <= now()
    returning user_id, day
  )
  select jsonb_agg(m) into messages
  from (
    select public.piket_partner_message(d.user_id, d.day) as m
    from due d
    where d.day = (now() at time zone 'Asia/Jakarta')::date
  ) x
  where m is not null;
  perform public.send_expo_pushes(messages);
end;
$$;

revoke execute on function public.send_piket_partner_snoozes() from public, anon, authenticated;

-- One every-minute job: the delay queue, then due snoozes (snoozes stay exactly 10 minutes).
select cron.schedule('push-every-minute', '* * * * *',
  $$select public.flush_push_queue(); select public.send_piket_partner_snoozes();$$);

-- Scheduled reminders: same times, now with the 10-20 minute spread.
select cron.schedule('piket-reminder-daily', '30 21 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('dawn');$$);
select cron.schedule('piket-nudge-depart', '30 23 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('depart');$$);
select cron.schedule('piket-nudge-lunch', '0 5 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('lunch');$$);
select cron.schedule('piket-nudge-afternoon', '0 8 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('afternoon');$$);
select cron.schedule('piket-nudge-malas-1', '30 9 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('malas_1');$$);
select cron.schedule('piket-nudge-evening', '30 11 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('evening');$$);
select cron.schedule('piket-nudge-malas-2', '30 12 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('malas_2');$$);
select cron.schedule('piket-nudge-night', '30 13 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('night');$$);
select cron.schedule('piket-nudge-last', '0 15 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_nudge('last');$$);
select cron.schedule('piket-report-daily', '0 0 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_piket_report();$$);
select cron.schedule('shopping-reminder-morning', '0 2 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_shopping_reminders();$$);
select cron.schedule('shopping-reminder-afternoon', '0 8 * * *',
  $$select set_config('app.push_jitter', 'on', true); select public.send_shopping_reminders();$$);
