-- Security hardening (2026-10-15)
-- No table is truncated or reset. The only data removed is users.password,
-- which held plaintext copies of passwords readable by every member. Logins
-- use Supabase Auth (auth.users), which is unaffected.

-- 1. Remove plaintext password copies.
alter table public.users drop column if exists password;

-- 2. Members must not be able to change their own role (e.g. to 'admin').
--    Requests without a user JWT (service role, SQL editor) are allowed.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_role_change on public.users;
create trigger users_prevent_role_change
  before update on public.users
  for each row execute function public.prevent_role_change();

-- 3. Payments: members may only submit proof (status -> 'pending') on bills
--    that are waiting for payment or were rejected. Only admins set the final
--    status, and members cannot change the bill itself.
drop policy if exists payments_insert_own on public.payments;

drop policy if exists payments_update_own on public.payments;
create policy payments_update_own on public.payments
  for update to authenticated
  using (
    paid_by = (select auth.uid())
    and status in ('waiting_payment', 'rejected')
  )
  with check (
    paid_by = (select auth.uid())
    and status = 'pending'
  );

create or replace function public.protect_payment_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() and (
       new.amount is distinct from old.amount
    or new.period is distinct from old.period
    or new.due_date is distinct from old.due_date
    or new.paid_by is distinct from old.paid_by
  ) then
    raise exception 'Only admins can change bill details';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_protect_fields on public.payments;
create trigger payments_protect_fields
  before update on public.payments
  for each row execute function public.protect_payment_fields();

-- 4. Push tokens move to their own table that only the owner can read.
--    Sending happens server-side in the send-push edge function.
create table if not exists public.push_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

insert into public.push_tokens (user_id, token)
select id, push_token from public.users where push_token is not null
on conflict (user_id) do update set token = excluded.token, updated_at = now();

-- Older app builds still write users.push_token; mirror it into push_tokens
-- until every phone is on the new build and the column can be dropped.
create or replace function public.sync_legacy_push_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.push_token is not null
     and new.push_token is distinct from old.push_token then
    insert into public.push_tokens (user_id, token)
    values (new.id, new.push_token)
    on conflict (user_id) do update set token = excluded.token, updated_at = now();
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_legacy_push_token() from public, anon, authenticated;

drop trigger if exists users_sync_legacy_push_token on public.users;
create trigger users_sync_legacy_push_token
  after update of push_token on public.users
  for each row execute function public.sync_legacy_push_token();

-- 5. Advisor fixes.
-- users_public is unused by the app; make it respect the caller's RLS.
alter view public.users_public set (security_invoker = on);
-- admin_contact stays SECURITY DEFINER on purpose: the login screen shows the
-- admin's contact before anyone is signed in. It only exposes that one field.

-- These RPCs are only meant for signed-in members.
revoke execute on function public.is_sup_member() from public, anon;
revoke execute on function public.get_rule_request_voters(uuid) from public, anon;
revoke execute on function public.get_rule_request_vote_tally(uuid) from public, anon;
grant execute on function public.is_sup_member() to authenticated;
grant execute on function public.get_rule_request_voters(uuid) to authenticated;
grant execute on function public.get_rule_request_vote_tally(uuid) to authenticated;
