-- Piket proof review + Member of the Month (2026-10-16)
-- Only adds columns, a table, functions, triggers and a cron job. Nothing is
-- deleted. Existing 'done' pikets count as approved.

-- ---------------------------------------------------------------------------
-- Push helper: sends one message to every device of the given users, skipping
-- devices that muted `p_type`.
-- ---------------------------------------------------------------------------
create or replace function public.push_users(
  p_ids uuid[],
  p_title text,
  p_body text,
  p_type text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', p_title,
    'body', p_body,
    'data', p_data || jsonb_build_object('type', p_type)
  ))
  into messages
  from public.push_tokens t
  where t.user_id = any(p_ids)
    and not (p_type = any(coalesce(t.muted_types, '{}')));

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

revoke execute on function public.push_users(uuid[], text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Piket proof review. Members submit proof ('review'); only the admin can
--    approve ('done') or reject ('rejected', with a note). A rejected piket
--    can be uploaded again. Older app builds that still write 'done' are
--    turned into 'review' by the trigger, so nobody approves themselves.
-- ---------------------------------------------------------------------------
alter table public.pikets
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists reviewed_at timestamptz;

create or replace function public.piket_review_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.status is distinct from old.status and new.status in ('done', 'rejected') then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      new.finished := new.status = 'done';
    end if;
    return new;
  end if;

  -- Members: "done" means "submitted for review".
  if new.status = 'done' and old.status is distinct from 'done' then
    new.status := 'review';
  end if;
  -- Members can't approve, reject, or edit review details.
  if new.status in ('done', 'rejected') and new.status is distinct from old.status then
    new.status := old.status;
  end if;
  if new.status = 'review' and old.status is distinct from 'review' then
    new.finished := false;
    new.review_note := null;
  else
    new.review_note := old.review_note;
    new.finished := old.finished;
  end if;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  return new;
end;
$$;

drop trigger if exists piket_review_guard on public.pikets;
create trigger piket_review_guard
  before update on public.pikets
  for each row execute function public.piket_review_guard();

/** Tells the admin about new proof, and the member about the verdict. */
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
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'review' then
    select split_part(fullname, ' ', 1) into who from public.users where id = new.assign_to;
    perform public.push_users(
      array(select id from public.users where role = 'admin'),
      'Bukti piket baru',
      coalesce(who, 'Seseorang') || ' mengirim bukti piket ' || day_label || '. Yuk dicek.',
      'piket',
      jsonb_build_object('piketId', new.id)
    );
  elsif new.status = 'done' and old.status = 'review' then
    perform public.push_users(
      array[new.assign_to],
      'Piket disetujui',
      'Bukti piket ' || day_label || ' sudah disetujui admin. Mantap!',
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

drop trigger if exists piket_review_notify on public.pikets;
create trigger piket_review_notify
  after update on public.pikets
  for each row execute function public.piket_review_notify();

revoke execute on function public.piket_review_guard() from public, anon, authenticated;
revoke execute on function public.piket_review_notify() from public, anon, authenticated;

-- The daily reminder skips pikets already submitted for review.
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
    and p.status not in ('done', 'review')
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
-- 2. Member performance for a month ('YYYY-MM'), members only (no admin or
--    sup-member). Score out of 100:
--      70 x approved piket / assigned piket (days so far + anything approved)
--    + 30 if that month's rent was paid on time.
--    Only the admin (or the cron job, which has no user) can read it.
-- ---------------------------------------------------------------------------
create or replace function public.member_performance(p_period text)
returns table (
  user_id uuid,
  fullname text,
  avatar_url text,
  assigned int,
  approved int,
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
           count(p.id) filter (where p.day < b.today or p.status = 'done')::int as assigned,
           count(p.id) filter (where p.status = 'done')::int as approved
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
         pay.status::text,
         round(
           70.0 * coalesce(c.approved::numeric / nullif(c.assigned, 0), 0)
           + case when pay.status = 'on_time' then 30 else 0 end,
           1
         ) as score
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

revoke execute on function public.member_performance(text) from public, anon;
grant execute on function public.member_performance(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Member of the Month awards and prizes.
-- ---------------------------------------------------------------------------
create table if not exists public.motm_awards (
  id uuid primary key default gen_random_uuid(),
  period text not null unique,
  user_id uuid not null references public.users(id),
  score numeric not null,
  prize text check (prize in ('cash', 'bill_disc', 'steam')),
  prize_amount int,
  redeemed_at timestamptz,
  -- Bill months the BILL DISC prize was applied to (winner minus, owner plus).
  winner_bill_period text,
  owner_bill_period text,
  created_at timestamptz not null default now()
);

alter table public.motm_awards enable row level security;

drop policy if exists motm_awards_select_all on public.motm_awards;
create policy motm_awards_select_all on public.motm_awards
  for select to authenticated using (true);

/**
 * Picks the Member of the Month for `p_period` (default: the month that just
 * ended in Jakarta time). The highest score wins outright. On a tie, last
 * month's winner is left out (when someone else is tied too) and the rest is
 * drawn at random. Skips the month if nobody scored or it was already picked.
 * Notifies everyone; the winner gets their own message.
 */
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
  tied int;
  prev_winner uuid;
  winner uuid;
  winner_name text;
begin
  if exists (select 1 from public.motm_awards where period = per) then
    return;
  end if;

  select max(score) into top from public.member_performance(per);
  if top is null or top <= 0 then
    return;
  end if;

  select count(*) into tied from public.member_performance(per) where score = top;
  select user_id into prev_winner from public.motm_awards where period = prev;

  -- Last month's winner sorts last within a tie, so they're only picked when
  -- nobody else shares the top score.
  select s.user_id into winner
  from public.member_performance(per) s
  where s.score = top
  order by coalesce(tied > 1 and s.user_id = prev_winner, false), random()
  limit 1;

  insert into public.motm_awards (period, user_id, score)
  values (per, winner, top);

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

revoke execute on function public.pick_motm(text) from public, anon, authenticated;

/**
 * Applies redeemed BILL DISC prizes that aren't on a bill yet: takes the
 * amount off the winner's next unpaid bill, and adds it to the sup-member's
 * unpaid bill for that month (or the next one). Runs on redeem and whenever
 * new bills are created, so a prize waits for the bill if it doesn't exist.
 */
create or replace function public.apply_motm_discounts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  owner_id uuid;
  bill record;
  winner_period text;
begin
  select id into owner_id from public.users where role = 'sup-member' order by created_at limit 1;

  for a in
    select * from public.motm_awards
    where prize = 'bill_disc'
      and (winner_bill_period is null or (owner_id is not null and owner_bill_period is null))
    for update
  loop
    winner_period := a.winner_bill_period;

    if winner_period is null then
      select id, period into bill from public.payments
      where paid_by = a.user_id and status in ('waiting_payment', 'rejected')
      order by period limit 1;
      if found then
        update public.payments
          set amount = greatest(coalesce(amount, 0) - a.prize_amount, 0), modified_at = now()
          where id = bill.id;
        update public.motm_awards set winner_bill_period = bill.period where id = a.id;
        winner_period := bill.period;
      end if;
    end if;

    if winner_period is not null and a.owner_bill_period is null and owner_id is not null then
      select id, period into bill from public.payments
      where paid_by = owner_id and status in ('waiting_payment', 'rejected') and period >= winner_period
      order by period limit 1;
      if found then
        update public.payments
          set amount = coalesce(amount, 0) + a.prize_amount, modified_at = now()
          where id = bill.id;
        update public.motm_awards set owner_bill_period = bill.period where id = a.id;
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public.apply_motm_discounts() from public, anon, authenticated;

create or replace function public.apply_motm_discounts_on_bills()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_motm_discounts();
  return null;
end;
$$;

revoke execute on function public.apply_motm_discounts_on_bills() from public, anon, authenticated;

drop trigger if exists apply_motm_discounts on public.payments;
create trigger apply_motm_discounts
  after insert on public.payments
  for each statement execute function public.apply_motm_discounts_on_bills();

/**
 * The winner redeems their award: draws the prize on the server (25k prizes a
 * bit likelier: 3/15 each vs 2/15 for 50k), applies BILL DISC to the bills,
 * and tells the sup-member what was won. Redeeming twice returns the same
 * prize. Returns {"prize": "cash"|"bill_disc"|"steam", "amount": 50000|25000}.
 */
create or replace function public.redeem_motm(p_award uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.motm_awards;
  r numeric := random() * 15;
  pz text;
  amt int;
  label text;
  who text;
begin
  select * into a from public.motm_awards where id = p_award for update;
  if a.id is null or a.user_id is distinct from auth.uid() then
    raise exception 'Hadiah ini bukan milikmu.';
  end if;
  if a.redeemed_at is not null then
    return jsonb_build_object('prize', a.prize, 'amount', a.prize_amount);
  end if;

  pz := case
    when r < 2 then 'cash' when r < 4 then 'bill_disc' when r < 6 then 'steam'
    when r < 9 then 'cash' when r < 12 then 'bill_disc' else 'steam'
  end;
  amt := case when r < 6 then 50000 else 25000 end;

  update public.motm_awards
    set prize = pz, prize_amount = amt, redeemed_at = now()
    where id = a.id;

  if pz = 'bill_disc' then
    perform public.apply_motm_discounts();
  end if;

  label := case pz when 'cash' then 'CASH' when 'steam' then 'STEAM WALLET' else 'BILL DISC' end
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

  return jsonb_build_object('prize', pz, 'amount', amt);
end;
$$;

revoke execute on function public.redeem_motm(uuid) from public, anon;
grant execute on function public.redeem_motm(uuid) to authenticated;

-- 01:00 UTC on the 1st = 08:00 WIB, for the month that just ended.
-- Re-running this replaces the job instead of duplicating it.
select cron.schedule('motm-monthly', '0 1 1 * *', 'select public.pick_motm();');
