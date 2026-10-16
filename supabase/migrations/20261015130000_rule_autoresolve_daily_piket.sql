-- Rule auto-resolve + daily piket (2026-10-15)
-- Nothing is deleted. Existing piket rows are kept; only empty days get filled.

-- 1. Resolve a rule request once every non-admin has voted.
--    Majority approve: the rule is added and the request approved.
--    Majority decline: the request is declined.
--    Tie: stays pending for the admin to decide.
--    Runs in the database so it works no matter who casts the last vote
--    (members are not allowed to write to rules / rule_requests directly).
create or replace function public.resolve_rule_request(p_rule_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.rule_requests%rowtype;
  eligible int;
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
  select
    count(*) filter (where vote = 'approve'),
    count(*) filter (where vote = 'decline')
  into approves, declines
  from public.rule_request_votes
  where rule_request_id = p_rule_request_id;

  if approves + declines < eligible then
    return;
  end if;

  if approves > declines then
    insert into public.rules (rules, priority, assign_by)
    values (req.rules, req.priority, req.assign_by);
    update public.rule_requests
    set status = 'approved', modified_at = now()
    where id = req.id;
  elsif declines > approves then
    update public.rule_requests
    set status = 'declined', modified_at = now()
    where id = req.id;
  end if;
end;
$$;

revoke execute on function public.resolve_rule_request(uuid) from public, anon, authenticated;

create or replace function public.resolve_rule_request_on_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.resolve_rule_request(new.rule_request_id);
  return new;
end;
$$;

revoke execute on function public.resolve_rule_request_on_vote() from public, anon, authenticated;

drop trigger if exists rule_request_votes_resolve on public.rule_request_votes;
create trigger rule_request_votes_resolve
  after insert or update on public.rule_request_votes
  for each row execute function public.resolve_rule_request_on_vote();

-- Resolve requests that already have every vote in (stuck before this fix).
select public.resolve_rule_request(id)
from public.rule_requests
where status = 'pending';

-- 2. Daily piket: every day has 2 people on duty, rotating through all
--    non-admin members. The pair for a day depends only on the date, so the
--    rotation stays balanced and running this again never changes a day that
--    already has rows (e.g. after a swap).
create or replace function public.generate_next_piket_schedule()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_ids uuid[];
  n int;
  d date;
  start_idx int;
begin
  select array_agg(id order by id) into member_ids
  from public.users
  where role <> 'admin';

  n := coalesce(array_length(member_ids, 1), 0);
  if n = 0 then
    return;
  end if;

  for d in
    select generate_series(current_date, current_date + 20, interval '1 day')::date
  loop
    continue when exists (select 1 from public.pikets where day = d);

    start_idx := ((d - date '2000-01-01') * 2) % n;

    insert into public.pikets (day, assign_to, status, finished)
    values (d, member_ids[start_idx + 1], 'pending', false);

    if n > 1 then
      insert into public.pikets (day, assign_to, status, finished)
      values (d, member_ids[((start_idx + 1) % n) + 1], 'pending', false);
    end if;
  end loop;
end;
$$;

revoke execute on function public.generate_next_piket_schedule() from public, anon, authenticated;

-- Fill the next 3 weeks now. The existing weekly cron job (Mondays) keeps
-- the window filled from here on.
select public.generate_next_piket_schedule();
