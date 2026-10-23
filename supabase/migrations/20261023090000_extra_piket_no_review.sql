-- Extra piket, no admin approval, izin request expiry, points + gacha tiers (2026-10-23)
-- Only adds columns and replaces functions/triggers. Nothing is deleted.
--
-- 1. Piket submissions count right away ('done'); the admin can still reject
--    one afterwards (with a note) and the member can upload again.
-- 2. Anyone can do an extra piket today (max 2 a day). It never replaces the
--    people on the schedule; it's a bonus for whoever did it. Every
--    submission can carry an optional description.
-- 3. Pending izin requests expire once their day passed or the piket is done.
-- 4. Score is now points: own piket 10, extra piket 5, rent on time 30.
-- 5. The MOTM gacha gets better odds the further the winner is above average.

alter table public.pikets
  add column if not exists description text,
  add column if not exists extra boolean not null default false;

alter table public.motm_awards
  add column if not exists average numeric;

-- ---------------------------------------------------------------------------
-- Guard: members can only mark their own piket 'done' (on its day, or after a
-- rejection). Only the admin rejects. Server functions that move other rows
-- set `app.piket_sync` so the guard lets them through.
-- ---------------------------------------------------------------------------
create or replace function public.piket_review_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if current_setting('app.piket_sync', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then
    if new.status is distinct from old.status then
      if new.status = 'rejected' then
        new.reviewed_by := auth.uid();
        new.reviewed_at := now();
        new.finished := false;
      elsif new.status = 'done' then
        new.finished := true;
      end if;
    end if;
    return new;
  end if;

  -- Older app builds still send 'review'; it now simply means done.
  if new.status = 'review' then
    new.status := 'done';
  end if;

  if new.status is distinct from old.status then
    if new.status <> 'done' or old.status not in ('pending', 'izin', 'rejected') then
      new.status := old.status;
    elsif old.status <> 'rejected' and old.day <> today then
      raise exception 'Piket hanya bisa diselesaikan di harinya.';
    end if;
  end if;

  if new.status = 'done' and old.status is distinct from 'done' then
    new.finished := true;
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.finished := old.finished;
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;

  new.day := old.day;
  new.assign_to := old.assign_to;
  new.extra := old.extra;
  return new;
end;
$$;

/** Tells the admin about a submission, and the member about a rejection. */
create or replace function public.piket_review_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  day_label text := to_char(new.day, 'DD/MM');
begin
  if new.status is not distinct from old.status
     or current_setting('app.piket_sync', true) = 'on' then
    return new;
  end if;

  if new.status = 'done' and not public.is_admin() then
    select split_part(fullname, ' ', 1) into who from public.users where id = new.assign_to;
    perform public.push_users(
      array(select id from public.users where role = 'admin'),
      'Piket selesai',
      coalesce(who, 'Seseorang') || ' menyelesaikan piket ' || day_label || '.',
      'piket',
      jsonb_build_object('piketId', new.id)
    );
  elsif new.status = 'rejected' then
    perform public.push_users(
      array[new.assign_to],
      'Bukti piket ditolak',
      coalesce(nullif(new.review_note, ''), 'Bukti piket ' || day_label || ' ditolak.')
        || ' Upload ulang ya.',
      'piket',
      jsonb_build_object('piketId', new.id)
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.piket_review_guard() from public, anon, authenticated;
revoke execute on function public.piket_review_notify() from public, anon, authenticated;

-- Anything still waiting for review counts as done now.
select set_config('app.piket_sync', 'on', true);
update public.pikets set status = 'done', finished = true where status = 'review';
select set_config('app.piket_sync', 'off', true);

-- ---------------------------------------------------------------------------
-- Extra piket.
-- ---------------------------------------------------------------------------
/**
 * Submits an extra piket for today: a bonus for the caller that doesn't
 * replace anyone on the schedule. Max 2 per member per day, and your own
 * scheduled piket today comes first. Returns the new piket id.
 */
create or replace function public.submit_extra_piket(
  p_docs text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Jakarta')::date;
  new_id uuid;
  who text;
begin
  if me is null or public.is_admin() then
    raise exception 'Hanya penghuni yang bisa piket.';
  end if;
  if coalesce(p_docs, '') = '' then
    raise exception 'Foto bukti wajib diisi.';
  end if;
  if (select count(*) from public.pikets
      where extra and assign_to = me and day = today) >= 2 then
    raise exception 'Maksimal 2 piket tambahan per hari.';
  end if;
  if exists (select 1 from public.pikets
             where not extra and assign_to = me and day = today
               and status in ('pending', 'izin', 'rejected')) then
    raise exception 'Selesaikan dulu piket kamu sendiri hari ini.';
  end if;

  insert into public.pikets (day, assign_to, status, finished, docs, description, extra)
  values (today, me, 'done', true, p_docs, nullif(trim(p_description), ''), true)
  returning id into new_id;

  select split_part(fullname, ' ', 1) into who from public.users where id = me;
  perform public.push_users(
    array(select id from public.users where role = 'admin'),
    'Piket tambahan',
    coalesce(who, 'Seseorang') || ' mengerjakan piket tambahan hari ini.',
    'piket',
    jsonb_build_object('piketId', new_id)
  );
  return new_id;
end;
$$;

revoke execute on function public.submit_extra_piket(text, text) from public, anon;
grant execute on function public.submit_extra_piket(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Izin requests: answered atomically, and expired once they're moot.
-- ---------------------------------------------------------------------------
/**
 * The asked replacement accepts or declines an izin request. Accepting moves
 * the piket to them. A request whose day passed (or whose piket is already
 * handled) is marked expired instead. Returns the request's final status.
 */
create or replace function public.respond_piket_request(p_request uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Jakarta')::date;
  req public.piket_requests;
  pk public.pikets;
  result text;
  who text;
begin
  select * into req from public.piket_requests where id = p_request for update;
  if req.id is null or req.assign_to is distinct from me then
    raise exception 'Permintaan ini bukan untukmu.';
  end if;
  if req.status <> 'pending' then
    return req.status;
  end if;

  select * into pk from public.pikets where id = req.piket_id for update;
  result := case
    when pk.id is null or pk.day < today or pk.status not in ('pending', 'izin') then 'expired'
    when p_accept then 'accepted'
    else 'declined'
  end;

  update public.piket_requests set status = result, modified_at = now() where id = req.id;
  if result = 'accepted' then
    perform set_config('app.piket_sync', 'on', true);
    update public.pikets set assign_to = me, status = 'izin' where id = pk.id;
    perform set_config('app.piket_sync', 'off', true);
  end if;

  if result <> 'expired' and req.requested_by is not null then
    select split_part(fullname, ' ', 1) into who from public.users where id = me;
    perform public.push_users(
      array[req.requested_by],
      case when result = 'accepted' then 'Izin piket diterima' else 'Izin piket ditolak' end,
      coalesce(who, 'Penggantimu') || case when result = 'accepted'
        then ' menggantikan piket kamu tanggal ' else ' tidak bisa menggantikan piket kamu tanggal ' end
        || to_char(pk.day, 'DD/MM') || '.',
      'piket',
      jsonb_build_object('piketId', pk.id)
    );
  end if;
  return result;
end;
$$;

revoke execute on function public.respond_piket_request(uuid, boolean) from public, anon;
grant execute on function public.respond_piket_request(uuid, boolean) to authenticated;

/** Marks pending izin requests expired once their day passed or the piket is handled. */
create or replace function public.expire_piket_requests()
returns void
language sql
security definer
set search_path = public
as $$
  update public.piket_requests r
     set status = 'expired', modified_at = now()
    from public.pikets p
   where p.id = r.piket_id
     and r.status = 'pending'
     and (p.day < (now() at time zone 'Asia/Jakarta')::date
          or p.status not in ('pending', 'izin'));
$$;

revoke execute on function public.expire_piket_requests() from public, anon, authenticated;

select public.expire_piket_requests();

-- Just after midnight in Jakarta (17:01 UTC).
select cron.schedule('piket-request-expiry', '1 17 * * *', 'select public.expire_piket_requests();');

-- The daily reminder skips handled pikets and extras.
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
    and not p.extra
    and p.status in ('pending', 'izin', 'rejected')
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

-- ---------------------------------------------------------------------------
-- Points. Own piket done 10, extra piket done 5, rent on time 30.
-- `assigned` is own scheduled slots so far, for display. A new function, so
-- member_performance (the old 0-100 score) stays for older app builds.
-- ---------------------------------------------------------------------------
create or replace function public.member_points(p_period text)
returns table (
  user_id uuid,
  fullname text,
  avatar_url text,
  assigned int,
  approved int,
  extra int,
  bill_status text,
  score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select to_date(p_period || '-01', 'YYYY-MM-DD') as start_day,
           (now() at time zone 'Asia/Jakarta')::date as today
  ),
  counts as (
    select u.id,
           count(p.id) filter (
             where not p.extra and (p.day < b.today or p.status = 'done')
           )::int as assigned,
           count(p.id) filter (where not p.extra and p.status = 'done')::int as approved,
           count(p.id) filter (where p.extra and p.status = 'done')::int as extra
    from public.users u
    cross join b
    left join public.pikets p
      on p.assign_to = u.id
     and p.day >= b.start_day
     and p.day < (b.start_day + interval '1 month')::date
    where u.role = 'member'
    group by u.id
  )
  select u.id,
         u.fullname::text,
         u.avatar_url,
         c.assigned,
         c.approved,
         c.extra,
         pay.status::text,
         (10 * c.approved + 5 * c.extra
           + case when pay.status = 'on_time' then 30 else 0 end)::numeric as score
  from counts c
  join public.users u on u.id = c.id
  left join lateral (
    select status from public.payments
    where paid_by = u.id and period = p_period
    limit 1
  ) pay on true
  where auth.uid() is null or public.is_admin()
  order by score desc, c.approved desc, u.fullname;
$$;

revoke execute on function public.member_points(text) from public, anon;
grant execute on function public.member_points(text) to authenticated;

-- pick_motm: same as before, but scores with member_points and stores the
-- month's average so the gacha knows how far above it the winner was.
create or replace function public.pick_motm(p_period text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  per text := coalesce(
    p_period,
    to_char((now() at time zone 'Asia/Jakarta')::date - 1, 'YYYY-MM')
  );
  prev text := to_char(to_date(per || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM');
  months text[] := array['Januari','Februari','Maret','April','Mei','Juni','Juli',
                         'Agustus','September','Oktober','November','Desember'];
  month_name text := months[split_part(per, '-', 2)::int];
  top numeric;
  average numeric;
  tied int;
  prev_winner uuid;
  winner uuid;
  winner_name text;
begin
  if exists (select 1 from public.motm_awards where period = per) then
    return;
  end if;

  select max(score), avg(score) into top, average from public.member_points(per);
  if top is null or top <= 0 or top <= average then
    return;
  end if;

  select count(*) into tied from public.member_points(per) where score = top;
  select user_id into prev_winner from public.motm_awards where period = prev;

  select s.user_id into winner
  from public.member_points(per) s
  where s.score = top
  order by coalesce(tied > 1 and s.user_id = prev_winner, false), random()
  limit 1;

  insert into public.motm_awards (period, user_id, score, average)
  values (per, winner, top, round(average, 1));

  select split_part(fullname, ' ', 1) into winner_name from public.users where id = winner;

  perform public.push_users(
    array[winner],
    'Kamu Member of the Month!',
    'Selamat, kamu jadi Member of the Month ' || month_name || '! Buka app buat ambil hadiahnya.',
    'motm'
  );
  perform public.push_users(
    array(select id from public.users where id <> winner),
    'Member of the Month ' || month_name,
    'Selamat buat ' || winner_name || ' yang jadi Member of the Month ' || month_name || '!',
    'motm'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Gacha tiers by how far the winner's score is above the month's average:
--   normal  (< 50):    out of 31: 50k 4 each, 30k 5 each, 25k 6 each, BILL DISC 75k 1
--   boosted (50-100):  out of 100: 25k 10 each, 30k 10 each, 50k 20 each, BILL DISC 75k 20
--   jackpot (> 100):   out of 100: 50k 12.5 each, BILL DISC 75k 75
-- ---------------------------------------------------------------------------
create or replace function public.redeem_motm(p_award uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.motm_awards;
  gap numeric;
  tier text;
  r numeric;
  pz text;
  amt int;
  label text;
  who text;
begin
  select * into a from public.motm_awards where id = p_award for update;
  if a.id is null or a.user_id is distinct from auth.uid() then
    raise exception 'Hadiah ini bukan milikmu.';
  end if;

  gap := a.score - coalesce(a.average, a.score);
  tier := case when gap > 100 then 'jackpot' when gap >= 50 then 'boosted' else 'normal' end;

  if a.redeemed_at is not null then
    return jsonb_build_object('prize', a.prize, 'amount', a.prize_amount, 'tier', tier);
  end if;

  if tier = 'jackpot' then
    r := random() * 100;
    pz := case when r < 12.5 then 'cash' else 'bill_disc' end;
    amt := case when r < 25 then 50000 else 75000 end;
  elsif tier = 'boosted' then
    r := random() * 100;
    pz := case
      when r < 10 then 'cash' when r < 20 then 'bill_disc'
      when r < 30 then 'cash' when r < 40 then 'bill_disc'
      when r < 60 then 'cash' else 'bill_disc'
    end;
    amt := case when r < 20 then 25000 when r < 40 then 30000 when r < 80 then 50000 else 75000 end;
  else
    r := random() * 31;
    pz := case
      when r < 4 then 'cash' when r < 8 then 'bill_disc'
      when r < 13 then 'cash' when r < 18 then 'bill_disc'
      when r < 24 then 'cash' when r < 30 then 'bill_disc'
      else 'bill_disc'
    end;
    amt := case when r < 8 then 50000 when r < 18 then 30000 when r < 30 then 25000 else 75000 end;
  end if;

  update public.motm_awards
    set prize = pz, prize_amount = amt, redeemed_at = now()
    where id = a.id;

  if pz = 'bill_disc' then
    perform public.apply_motm_discounts();
  end if;

  label := case pz when 'cash' then 'CASH' else 'BILL DISC' end
           || ' ' || (amt / 1000) || 'k';
  select split_part(fullname, ' ', 1) into who from public.users where id = a.user_id;
  perform public.push_users(
    array(select id from public.users where role = 'sup-member'),
    'Hadiah MOTM diambil',
    coalesce(who, 'Pemenang') || ' dapat ' || label || '. ' || case
      when pz = 'bill_disc' then 'Tagihannya dipotong dan ditambahkan ke tagihanmu.'
      else 'Jangan lupa kirim hadiahnya ya.'
    end,
    'motm'
  );

  return jsonb_build_object('prize', pz, 'amount', amt, 'tier', tier);
end;
$$;
