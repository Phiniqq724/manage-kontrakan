-- Piket nudges + next-morning report (2026-10-23)
-- Replaces the single 07:00 reminder with up to 6 rotating reminders a day.
-- Every slot re-checks the piket first, so once it's done nothing more arrives.
-- Nothing is deleted: the old send_piket_reminders() stays, its cron job is
-- repointed to the first slot.
--
-- Slots (WIB):
--   04:30 dawn       every day, rotating morning lines
--   06:30 depart     Mon-Fri, "Pulang sekolah..." with Ya / Malas buttons
--   12:00 lunch      Sat-Sun only (school on weekdays)
--   15:00 afternoon  skipped for whoever answered Ya
--   16:30 malas_1    only for whoever answered Malas
--   18:30 evening
--   19:30 malas_2    only for whoever answered Malas
--   20:30 night
--   22:00 last
-- 07:00 the next morning, everyone else hears who didn't do their piket.

-- ---------------------------------------------------------------------------
-- Tables. Server-only: RLS on, no policies, no client grants.
-- ---------------------------------------------------------------------------
create table if not exists public.piket_nudge_templates (
  key text primary key,
  pool text not null,
  title text not null,
  body text not null,
  category_id text
);

create table if not exists public.piket_nudge_log (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  slot text not null,
  template_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day, slot)
);

create table if not exists public.piket_plan_responses (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  response text not null check (response in ('ya', 'malas')),
  responded_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.piket_nudge_templates enable row level security;
alter table public.piket_nudge_log enable row level security;
alter table public.piket_plan_responses enable row level security;
revoke all on public.piket_nudge_templates from anon, authenticated;
revoke all on public.piket_nudge_log from anon, authenticated;
revoke all on public.piket_plan_responses from anon, authenticated;

-- {partner} is the other person on the schedule that day. Lines using it are
-- skipped when there is no partner.
insert into public.piket_nudge_templates (key, pool, title, body, category_id) values
  ('dawn_pic',       'dawn',      'Piket hari ini',            'Hari ini giliran kamu jadi PIC kontrakan. Semangat!', null),
  ('dawn_partner',   'dawn',      'Hari ini bareng {partner}', 'Piketmu bareng {partner}, jngn lupa jir', null),
  ('dawn_cuma_satu', 'dawn',      'Cuma satu kok',             'Salah satu tugasmu cuma piket loh, masa ga mau ngerjain', null),
  ('dawn_sapuen',    'dawn',      'Lantai memanggil',          'Sapuen, aku (lantai) sapuen', null),
  ('dawn_mwhehe',    'dawn',      'Selamat pagi',              '>:) Mwheeheheh hari ini giliranmu piket jir', null),
  ('dawn_kunci',     'dawn',      'Sebelum berangkat',         'Jangan lupa dikunci habis berangkat', null),
  ('depart_plan',    'depart',    'Nanti sore gimana?',        'Pulang sekolah bakal piket ngga yah', 'piket_plan'),
  ('mid_10_menit',   'midday',    '10 menit doang',            'Masa gaada waktu 10 menit aja buat piket ;(', null),
  ('mid_lantai',     'midday',    'Pesan dari lantai',         '"Kangen disapu", kata lantai tuh', null),
  ('mid_when',       'midday',    'Piket kapan nih',           'When yah piket.', null),
  ('aft_partner',    'afternoon', 'Kabarin {partner}',         'Tanyain si {partner} dong, kapan kalian piketnya', null),
  ('aft_syarat',     'afternoon', 'Syaratnya satu',            'Bebas dah mau ngapain, asal piket', null),
  ('aft_pulang',     'afternoon', 'Otw pulang?',               'Habis ini pulang nih, kamu bakal piket kann? 0~0', null),
  ('eve_dapur',      'evening',   'Inspeksi dapur',            'Cek dapur coba, sapa tau ada kecoa yang perlu kamu buang', null),
  ('eve_sampah',     'evening',   'Sampah numpuk',             'Sampahmu numpuk jir, masa ga mau dibersihin sih', null),
  ('eve_foto',       'evening',   'Jangan lupa foto',          'Bro, jangan lupa dokum piketmu', null),
  ('night_admin',    'night',     'Cerita seram kontrakan',    'Konon katanya yang ga piket, kamarnya didatangi admin', null),
  ('night_kotor',    'night',     'Kotor sampe besok?',        'Masa mau kontrakan kita kotor sampe besok', null),
  ('night_pura2',    'night',     'Beneran ga bisa?',          'Lu lagi ga bisa, apa cuma pura2?', null),
  ('last_jam',       'last',      'Udah jam segini',           'Udah jam segini, masa masih ga mau piket jir', null),
  ('last_kunci',     'last',      'Minimal kunci rumah',       'Sana kunci rumah, at least keitung tuh', null)
on conflict (key) do update
  set pool = excluded.pool,
      title = excluded.title,
      body = excluded.body,
      category_id = excluded.category_id;

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------

/**
 * Sends one reminder slot to everyone whose own piket today is still open.
 * Picks a line from the slot's pools: never one already sent to them today,
 * preferring lines they haven't seen in two weeks. The log makes a slot send
 * at most once per person per day, even if cron retries.
 */
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

revoke execute on function public.send_piket_nudge(text) from public, anon, authenticated;

/** "A", "A dan B", "A, B dan C" (with `p_last` as the final joiner). */
create or replace function public.join_names(p_names text[], p_last text default 'dan')
returns text
language sql
immutable
set search_path = public
as $$
  select case coalesce(array_length(p_names, 1), 0)
    when 0 then ''
    when 1 then p_names[1]
    else array_to_string(p_names[1:array_length(p_names, 1) - 1], ', ')
         || ' ' || p_last || ' ' || p_names[array_length(p_names, 1)]
  end;
$$;

/**
 * 07:00 report about yesterday. Names whoever still had their own scheduled
 * piket open at the end of the day (after izin, the replacement is the one
 * on the hook), and calls out anyone who did an extra piket instead. Goes to
 * everyone except the people named; nothing is sent when nobody missed.
 */
create or replace function public.send_piket_report()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yesterday date := (now() at time zone 'Asia/Jakarta')::date - 1;
  missed_ids uuid[];
  missed text[];
  extras text[];
  body text;
begin
  select array_agg(s.user_id order by s.name), array_agg(s.name order by s.name)
  into missed_ids, missed
  from (
    select distinct p.assign_to as user_id, split_part(u.fullname, ' ', 1) as name
    from public.pikets p
    join public.users u on u.id = p.assign_to
    where p.day = yesterday
      and not p.extra
      and p.status in ('pending', 'izin', 'rejected')
  ) s;

  if missed_ids is null then
    return;
  end if;

  select array_agg(s.name order by s.name)
  into extras
  from (
    select distinct split_part(u.fullname, ' ', 1) as name
    from public.pikets p
    join public.users u on u.id = p.assign_to
    where p.day = yesterday
      and p.extra
      and p.status = 'done'
      and p.assign_to <> all(missed_ids)
  ) s;

  body := case
    when extras is null then
      'Tau ngga sih, kalo si ' || public.join_names(missed) || ' ngga piket kemarin 🫢'
    when array_length(missed, 1) = 1 then
      'Masa ' || missed[1] || ' kalah ama ' || public.join_names(extras) || ' yang ga lagi piket sih'
    else
      'Duh ' || public.join_names(missed, 'sama') || ', liat tuh ' || public.join_names(extras)
        || ' piket padahal '
        || case when array_length(extras, 1) = 1 then 'dia' else 'mereka' end
        || ' ngga ada dijadwal 👀'
  end;

  perform public.push_users(
    array(select id from public.users where id <> all(missed_ids)),
    'Laporan piket kemarin',
    body,
    'piket',
    jsonb_build_object('day', yesterday)
  );
end;
$$;

revoke execute on function public.send_piket_report() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ya / Malas from the 06:30 reminder. Only counts for the day it was sent,
-- so an answer that reaches the app late can't affect another day.
-- ---------------------------------------------------------------------------
create or replace function public.respond_piket_plan(p_day date, p_response text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_response not in ('ya', 'malas') then
    raise exception 'Invalid response: %', p_response;
  end if;
  if p_day is distinct from (now() at time zone 'Asia/Jakarta')::date then
    return;
  end if;

  insert into public.piket_plan_responses (user_id, day, response)
  values (auth.uid(), p_day, p_response)
  on conflict (user_id, day) do update
    set response = excluded.response, responded_at = now();
end;
$$;

revoke execute on function public.respond_piket_plan(date, text) from public, anon;
grant execute on function public.respond_piket_plan(date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Schedule (UTC = WIB - 7). Re-running replaces jobs instead of duplicating.
-- The old 07:00 job name now runs the 04:30 slot.
-- ---------------------------------------------------------------------------
select cron.schedule('piket-reminder-daily', '30 21 * * *', $$select public.send_piket_nudge('dawn');$$);
select cron.schedule('piket-nudge-depart',   '30 23 * * *', $$select public.send_piket_nudge('depart');$$);
select cron.schedule('piket-nudge-lunch',    '0 5 * * *',   $$select public.send_piket_nudge('lunch');$$);
select cron.schedule('piket-nudge-afternoon','0 8 * * *',   $$select public.send_piket_nudge('afternoon');$$);
select cron.schedule('piket-nudge-malas-1',  '30 9 * * *',  $$select public.send_piket_nudge('malas_1');$$);
select cron.schedule('piket-nudge-evening',  '30 11 * * *', $$select public.send_piket_nudge('evening');$$);
select cron.schedule('piket-nudge-malas-2',  '30 12 * * *', $$select public.send_piket_nudge('malas_2');$$);
select cron.schedule('piket-nudge-night',    '30 13 * * *', $$select public.send_piket_nudge('night');$$);
select cron.schedule('piket-nudge-last',     '0 15 * * *',  $$select public.send_piket_nudge('last');$$);
select cron.schedule('piket-report-daily',   '0 0 * * *',   $$select public.send_piket_report();$$);
