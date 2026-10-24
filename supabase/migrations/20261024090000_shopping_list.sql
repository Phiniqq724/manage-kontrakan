-- Shopping list (2026-10-24)
-- One row per item. Anyone adds an item (everyone is notified), anyone buys it
-- with two photos (item + receipt). The author accepts or rejects; a rejected
-- item goes back to the same buyer. Unreviewed proofs are accepted after 24h.
-- Reminders at 09:00 and 15:00 WIB while anything is unfinished.
--
--   open --submit--> submitted --accept/24h--> done
--                        |
--                      reject --> rejected --submit (same buyer)--> submitted
-- The author buying their own item goes straight to done.

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  note text check (note is null or length(note) <= 200),
  created_by uuid not null default auth.uid() references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'open'
    check (status in ('open', 'submitted', 'rejected', 'done')),
  bought_by uuid references public.users(id) on delete set null,
  item_photo text,
  receipt_photo text,
  submitted_at timestamptz,
  reject_note text,
  resolved_at timestamptz
);

create index if not exists shopping_items_status_idx on public.shopping_items (status);

alter table public.shopping_items enable row level security;

-- Read: everyone signed in. Insert: only as yourself, always open.
-- Delete: the author while nobody has bought it, or the admin.
-- No update policy: status changes only go through the functions below.
create policy shopping_items_select_all on public.shopping_items
  for select to authenticated using (true);
create policy shopping_items_insert_own on public.shopping_items
  for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'open' and bought_by is null);
create policy shopping_items_delete_own_open_or_admin on public.shopping_items
  for delete to authenticated
  using ((created_by = (select auth.uid()) and status = 'open') or public.is_admin());

-- Proof photos: public bucket, each user uploads into their own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('shopping-evidence', 'shopping-evidence', true, 10485760)
on conflict (id) do nothing;

create policy shopping_evidence_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shopping-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Submit proof. Open items: anyone. Rejected items: only the same buyer.
-- ---------------------------------------------------------------------------
create or replace function public.submit_shopping_item(
  p_id uuid,
  p_item_photo text,
  p_receipt_photo text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  item public.shopping_items;
  my_name text;
  next_status text;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if coalesce(p_item_photo, '') = '' or coalesce(p_receipt_photo, '') = '' then
    raise exception 'Foto barang dan struk wajib diisi.';
  end if;

  select * into item from public.shopping_items where id = p_id for update;
  if not found then
    raise exception 'Barang tidak ditemukan.';
  end if;
  if not (item.status = 'open' or (item.status = 'rejected' and item.bought_by = me)) then
    raise exception 'Barang ini sudah dibeli orang lain.';
  end if;

  next_status := case when item.created_by = me then 'done' else 'submitted' end;

  update public.shopping_items set
    status = next_status,
    bought_by = me,
    item_photo = p_item_photo,
    receipt_photo = p_receipt_photo,
    submitted_at = now(),
    reject_note = null,
    resolved_at = case when next_status = 'done' then now() end
  where id = p_id;

  if next_status = 'submitted' then
    select split_part(fullname, ' ', 1) into my_name from public.users where id = me;
    perform public.push_users(
      array[item.created_by],
      'Cek bukti belanja',
      coalesce(my_name, 'Seseorang') || ' sudah beli ' || item.name || '. Terima atau tolak?',
      'shopping',
      jsonb_build_object('shoppingItemId', p_id)
    );
  end if;

  return next_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Author accepts or rejects a submitted proof.
-- ---------------------------------------------------------------------------
create or replace function public.review_shopping_item(
  p_id uuid,
  p_accept boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  item public.shopping_items;
begin
  select * into item from public.shopping_items where id = p_id for update;
  if not found then
    raise exception 'Barang tidak ditemukan.';
  end if;
  if item.created_by is distinct from me then
    raise exception 'Hanya yang menambahkan barang ini yang bisa menilai.';
  end if;
  if item.status <> 'submitted' then
    raise exception 'Bukti ini sudah dinilai.';
  end if;

  if p_accept then
    update public.shopping_items
      set status = 'done', resolved_at = now(), reject_note = null
      where id = p_id;
    perform public.push_users(
      array[item.bought_by],
      'Bukti diterima',
      'Makasih udah beli ' || item.name || '!',
      'shopping',
      jsonb_build_object('shoppingItemId', p_id)
    );
  else
    update public.shopping_items
      set status = 'rejected', reject_note = nullif(trim(p_note), '')
      where id = p_id;
    perform public.push_users(
      array[item.bought_by],
      'Bukti ditolak',
      item.name || coalesce(': ' || nullif(trim(p_note), ''), '. Upload ulang buktinya ya.'),
      'shopping',
      jsonb_build_object('shoppingItemId', p_id)
    );
  end if;
end;
$$;

revoke execute on function public.submit_shopping_item(uuid, text, text) from public, anon;
revoke execute on function public.review_shopping_item(uuid, boolean, text) from public, anon;
grant execute on function public.submit_shopping_item(uuid, text, text) to authenticated;
grant execute on function public.review_shopping_item(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Proofs the author ignored for 24 hours count as accepted. Runs hourly.
-- ---------------------------------------------------------------------------
create or replace function public.auto_accept_shopping_items()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  for item in
    update public.shopping_items
      set status = 'done', resolved_at = now()
      where status = 'submitted' and submitted_at < now() - interval '24 hours'
      returning id, name, bought_by
  loop
    perform public.push_users(
      array[item.bought_by],
      'Bukti diterima',
      item.name || ' otomatis diterima.',
      'shopping',
      jsonb_build_object('shoppingItemId', item.id)
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 09:00 / 15:00 WIB: everyone hears what's still unbought; authors hear about
-- proofs waiting for them; buyers hear about their rejected proofs.
-- ---------------------------------------------------------------------------
create or replace function public.send_shopping_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  open_names text[];
  r record;
begin
  select array_agg(name order by created_at) into open_names
  from public.shopping_items where status = 'open';

  if open_names is not null then
    perform public.push_users(
      array(select id from public.users),
      'Daftar belanja',
      'Masih perlu dibeli: ' || public.join_names(open_names),
      'shopping'
    );
  end if;

  for r in
    select created_by as who, array_agg(name) as names
    from public.shopping_items where status = 'submitted'
    group by created_by
  loop
    perform public.push_users(
      array[r.who],
      'Cek bukti belanja',
      'Bukti ' || public.join_names(r.names) || ' nunggu kamu terima atau tolak.',
      'shopping'
    );
  end loop;

  for r in
    select bought_by as who, array_agg(name) as names
    from public.shopping_items where status = 'rejected' and bought_by is not null
    group by bought_by
  loop
    perform public.push_users(
      array[r.who],
      'Bukti belum diterima',
      'Upload ulang bukti ' || public.join_names(r.names) || ' ya.',
      'shopping'
    );
  end loop;
end;
$$;

revoke execute on function public.auto_accept_shopping_items() from public, anon, authenticated;
revoke execute on function public.send_shopping_reminders() from public, anon, authenticated;

select cron.schedule('shopping-auto-accept', '0 * * * *', $$select public.auto_accept_shopping_items();$$);
select cron.schedule('shopping-reminder-morning', '0 2 * * *', $$select public.send_shopping_reminders();$$);
select cron.schedule('shopping-reminder-afternoon', '0 8 * * *', $$select public.send_shopping_reminders();$$);
