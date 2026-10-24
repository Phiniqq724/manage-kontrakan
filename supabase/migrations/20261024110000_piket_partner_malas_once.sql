-- Piket partner nudge: one Malas tap can reach the server twice (background
-- task + app listener), so X is told only once per day.

alter table public.piket_partner_snoozes add column if not exists malas_at timestamptz;

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
  told_at timestamptz;
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

  -- One tap can arrive twice (background task + app listener): tell X once a day.
  select malas_at into told_at
  from public.piket_partner_snoozes
  where user_id = me and day = today
  for update;

  insert into public.piket_partner_snoozes (user_id, day, due_at, malas_at)
  values (me, today, null, now())
  on conflict (user_id, day) do update
    set due_at = null,
        malas_at = coalesce(public.piket_partner_snoozes.malas_at, excluded.malas_at);

  insert into public.piket_plan_responses (user_id, day, response)
  values (me, today, 'malas')
  on conflict (user_id, day) do update set response = 'malas', responded_at = now();

  if told_at is not null then
    return;
  end if;

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
