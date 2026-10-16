-- Rare MOTM prize: BILL DISC 75k (2026-10-17)
-- Replaces redeem_motm only. Nothing is deleted.
-- Odds out of 31: each 50k prize 4, each 25k prize 6, BILL DISC 75k 1 (~3%).

create or replace function public.redeem_motm(p_award uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.motm_awards;
  r numeric := random() * 31;
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
    when r < 4 then 'cash' when r < 8 then 'bill_disc' when r < 12 then 'steam'
    when r < 18 then 'cash' when r < 24 then 'bill_disc' when r < 30 then 'steam'
    else 'bill_disc'
  end;
  amt := case when r < 12 then 50000 when r < 30 then 25000 else 75000 end;

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
