-- Inside one mind: accounts, a free week, a $1 subscription, and each person's
-- own topics and thoughts. Row-level security keeps every row private to its owner.

-- ------------------------------------------------------------------ profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Free for 7 days from sign-up.
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  -- Mirrors the Razorpay subscription: none, created, authenticated, active, pending, halted, cancelled, completed, expired.
  subscription_status text not null default 'none',
  razorpay_subscription_id text unique,
  current_period_end timestamptz
);

alter table public.profiles enable row level security;

-- People can read their own profile. Nobody can change it from the browser:
-- the trial is set here, and the subscription only by the server after Razorpay confirms it.
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Free for a week, then while the subscription is paid (a day's grace for renewals).
-- "authenticated" means the card is set up and the first charge is scheduled.
create function public.has_access(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and (
        p.trial_ends_at > now()
        or (p.subscription_status in ('active', 'authenticated')
            and (p.current_period_end is null or p.current_period_end > now() - interval '1 day'))
      )
  );
$$;

revoke execute on function public.has_access(uuid) from public;
grant execute on function public.has_access(uuid) to authenticated;

-- ------------------------------------------------------------------ topics and thoughts

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  about text check (about is null or char_length(about) <= 140),
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  kind text not null check (kind in ('noticed', 'memory', 'worry', 'plan', 'feeling', 'idea', 'question')),
  -- "person:Mom", "place:Pune", "brand:IndiGo", "theme:money": what connects thoughts.
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- A thought can only sit in a topic that belongs to the same person.
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade
);

create index thoughts_by_time on public.thoughts (user_id, happened_at);

alter table public.topics enable row level security;
alter table public.thoughts enable row level security;

create policy "read own topics" on public.topics
  for select using (user_id = auth.uid());
create policy "add topics while access lasts" on public.topics
  for insert with check (user_id = auth.uid() and public.has_access(auth.uid()));
create policy "edit own topics while access lasts" on public.topics
  for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_access(auth.uid()));
create policy "delete own topics" on public.topics
  for delete using (user_id = auth.uid());

create policy "read own thoughts" on public.thoughts
  for select using (user_id = auth.uid());
create policy "add thoughts while access lasts" on public.thoughts
  for insert with check (user_id = auth.uid() and public.has_access(auth.uid()));
create policy "edit own thoughts while access lasts" on public.thoughts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_access(auth.uid()));
create policy "delete own thoughts" on public.thoughts
  for delete using (user_id = auth.uid());

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.topics, public.thoughts to authenticated;
