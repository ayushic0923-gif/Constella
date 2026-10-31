-- Same rules, cheaper to run: `(select auth.uid())` is worked out once per query instead of
-- once per row, and the topic foreign key gets the index it needs for deletes and joins.

drop policy "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (id = (select auth.uid()));

drop policy "read own topics" on public.topics;
drop policy "add topics while access lasts" on public.topics;
drop policy "edit own topics while access lasts" on public.topics;
drop policy "delete own topics" on public.topics;

create policy "read own topics" on public.topics
  for select using (user_id = (select auth.uid()));
create policy "add topics while access lasts" on public.topics
  for insert with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));
create policy "edit own topics while access lasts" on public.topics
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));
create policy "delete own topics" on public.topics
  for delete using (user_id = (select auth.uid()));

drop policy "read own thoughts" on public.thoughts;
drop policy "add thoughts while access lasts" on public.thoughts;
drop policy "edit own thoughts while access lasts" on public.thoughts;
drop policy "delete own thoughts" on public.thoughts;

create policy "read own thoughts" on public.thoughts
  for select using (user_id = (select auth.uid()));
create policy "add thoughts while access lasts" on public.thoughts
  for insert with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));
create policy "edit own thoughts while access lasts" on public.thoughts
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));
create policy "delete own thoughts" on public.thoughts
  for delete using (user_id = (select auth.uid()));

create index thoughts_by_topic on public.thoughts (topic_id, user_id);
