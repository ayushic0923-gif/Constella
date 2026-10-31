-- Paying by UPI without a payment gateway. A person pays the UPI ID shown in the app, then
-- submits the 12-digit UPI reference (UTR) from their payment confirmation. The owner checks
-- it against their bank or UPI app and sets the row's status to "approved" in the Supabase
-- dashboard; that unlocks the account for 30 days. People can read their own claims and add
-- new ones, nothing else: they can never approve themselves.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Filled in by the database so the owner can see whose payment it is.
  email text,
  utr text not null check (utr ~ '^[0-9]{12}$'),
  amount_inr integer not null check (amount_inr between 1 and 100000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- The owner's note, shown to the person when a claim is rejected.
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- One payment can unlock one account, once.
  unique (utr)
);

alter table public.payments enable row level security;

create policy "read own payments" on public.payments
  for select using (user_id = (select auth.uid()));

-- How many of a person's claims are waiting. A helper, because a rule can't count rows
-- of its own table (Postgres reports infinite recursion).
create function private.pending_claims(uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.payments where user_id = uid and status = 'pending';
$$;

revoke execute on function private.pending_claims(uuid) from public, anon;
grant execute on function private.pending_claims(uuid) to authenticated;

-- Add a claim for yourself, as pending, with at most three waiting at a time.
create policy "claim a payment" on public.payments
  for insert with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and private.pending_claims((select auth.uid())) < 3
  );

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant insert (utr, amount_inr) on public.payments to authenticated;

-- On the way in: record who it is, and make sure it starts pending.
create function private.payments_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := (select u.email from auth.users u where u.id = new.user_id);
  new.status := 'pending';
  new.reviewed_at := null;
  return new;
end;
$$;

create trigger payments_fill before insert on public.payments
  for each row execute function private.payments_fill();

-- On review: approving adds 30 days of membership (from now, or from the end of the current
-- membership if they pay early), and stamps when it was reviewed.
create function private.payments_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    new.reviewed_at := now();
  end if;
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.profiles
      set subscription_status = 'active',
          current_period_end = greatest(coalesce(current_period_end, now()), now()) + interval '30 days'
      where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger payments_review before update of status on public.payments
  for each row execute function private.payments_review();

revoke execute on function private.payments_fill() from public, anon, authenticated;
revoke execute on function private.payments_review() from public, anon, authenticated;
