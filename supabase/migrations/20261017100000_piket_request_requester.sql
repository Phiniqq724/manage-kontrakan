-- Piket izin history (2026-10-17)
-- piket_requests never stored who asked. Accepting a request reassigns the
-- piket, so the requester could no longer be found or see their request.
-- Nothing is deleted.

alter table public.piket_requests
  add column if not exists requested_by uuid
    references public.users(id) on delete set null
    default auth.uid();

-- Backfill what can still be known: for requests not yet accepted, the
-- requester is whoever the piket is assigned to. Accepted ones stay null.
update public.piket_requests r
set requested_by = p.assign_to
from public.pikets p
where p.id = r.piket_id
  and r.requested_by is null
  and r.status <> 'accepted';

-- Requesters can read their own requests (their izin history).
alter policy piket_requests_select on public.piket_requests
  using (
    assign_to = (select auth.uid())
    or requested_by = (select auth.uid())
    or is_admin()
    or exists (
      select 1 from public.pikets
      where pikets.id = piket_requests.piket_id
        and pikets.assign_to = (select auth.uid())
    )
  );

-- Only for your own piket, and only as yourself.
alter policy piket_requests_insert on public.piket_requests
  with check (
    requested_by = (select auth.uid())
    and exists (
      select 1 from public.pikets
      where pikets.id = piket_requests.piket_id
        and pikets.assign_to = (select auth.uid())
    )
  );
