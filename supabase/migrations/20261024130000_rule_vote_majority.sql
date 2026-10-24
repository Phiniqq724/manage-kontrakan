-- Rule votes close early (2026-10-24)
-- A rule request no longer waits for every member: it is approved as soon as
-- a majority of the eligible voters (non-admins; 3 of 5 today) said Setuju,
-- and declined as soon as a majority said Tolak. Ties after everyone voted
-- still stay pending for the admin.

create or replace function public.resolve_rule_request(p_rule_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.rule_requests%rowtype;
  eligible int;
  majority int;
  approves int;
  declines int;
begin
  select * into req from public.rule_requests
  where id = p_rule_request_id
  for update;
  if not found or req.status <> 'pending' then
    return;
  end if;

  select count(*) into eligible from public.users where role <> 'admin';
  majority := eligible / 2 + 1;
  select
    count(*) filter (where vote = 'approve'),
    count(*) filter (where vote = 'decline')
  into approves, declines
  from public.rule_request_votes
  where rule_request_id = p_rule_request_id;

  if approves >= majority then
    insert into public.rules (rules, priority, assign_by)
    values (req.rules, req.priority, req.assign_by);
    update public.rule_requests
    set status = 'approved', modified_at = now()
    where id = req.id;
  elsif declines >= majority then
    update public.rule_requests
    set status = 'declined', modified_at = now()
    where id = req.id;
  end if;
end;
$$;
