-- MOTM must be above the members' average score (2026-10-16)
-- Replaces pick_motm only. Nothing is deleted.
-- The winner is the member furthest above the group average (the highest
-- score). If nobody is above the average (e.g. everyone scored the same),
-- there's no MOTM that month. Tie rules are unchanged.

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

  select max(score), avg(score) into top, average from public.member_performance(per);
  if top is null or top <= 0 or top <= average then
    return;
  end if;

  select count(*) into tied from public.member_performance(per) where score = top;
  select user_id into prev_winner from public.motm_awards where period = prev;

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
