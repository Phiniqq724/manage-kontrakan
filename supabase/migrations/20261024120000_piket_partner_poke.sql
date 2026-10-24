-- Piket "Ingetin" button (2026-10-24)
-- Someone who finished their scheduled piket today can remind a partner on
-- today's schedule who hasn't: "Tuh {name} ngingetin buat piket, cepetan dah
-- kerjain", with the same 10 menit lagi / Malas buttons as the automatic
-- partner nudge. At most once per 10 minutes per partner.

create table if not exists public.piket_partner_pokes (
  from_id uuid not null references public.users(id) on delete cascade,
  to_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  last_at timestamptz not null,
  primary key (from_id, to_id, day)
);

alter table public.piket_partner_pokes enable row level security;
revoke all on public.piket_partner_pokes from anon, authenticated;

/**
 * Sends the reminder. Returns 0 when sent, or the seconds left on the
 * cooldown when it was sent less than 10 minutes ago.
 */
create or replace function public.poke_piket_partner(p_partner uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Jakarta')::date;
  last_poke timestamptz;
  my_name text;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if not exists (
    select 1 from public.pikets p
    where p.day = today and not p.extra and p.assign_to = me and p.status = 'done') then
    raise exception 'Selesaikan piketmu dulu.';
  end if;
  if not exists (
    select 1 from public.pikets p
    where p.day = today and not p.extra and p.assign_to = p_partner
      and p.status in ('pending', 'izin', 'rejected')) then
    raise exception 'Dia sudah piket.';
  end if;

  select last_at into last_poke
  from public.piket_partner_pokes
  where from_id = me and to_id = p_partner and day = today
  for update;
  if last_poke > now() - interval '10 minutes' then
    return ceil(extract(epoch from last_poke + interval '10 minutes' - now()))::integer;
  end if;

  insert into public.piket_partner_pokes (from_id, to_id, day, last_at)
  values (me, p_partner, today, now())
  on conflict (from_id, to_id, day) do update set last_at = excluded.last_at;

  select split_part(fullname, ' ', 1) into my_name from public.users where id = me;
  perform public.send_expo_pushes((
    select jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', 'Diingetin ' || coalesce(my_name, 'partnermu'),
      'body', 'Tuh ' || coalesce(my_name, 'partnermu') || ' ngingetin buat piket, cepetan dah kerjain',
      'categoryId', 'piket_partner',
      'data', jsonb_build_object('type', 'piket_nudge', 'day', today, 'slot', 'poke')
    ))
    from public.push_tokens t
    where t.user_id = p_partner
      and not ('piket' = any(coalesce(t.muted_types, '{}')))
  ));
  return 0;
end;
$$;

revoke execute on function public.poke_piket_partner(uuid) from public, anon;
grant execute on function public.poke_piket_partner(uuid) to authenticated;
