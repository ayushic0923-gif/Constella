-- Supabase hands new tables and functions in `public` to anon and authenticated by
-- default. Row-level security already keeps rows private; this removes the rest of what
-- nobody needs, so the database says "no" twice.

revoke all on public.profiles, public.topics, public.thoughts from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
revoke truncate, references, trigger on public.topics, public.thoughts from authenticated;

-- The sign-up trigger runs as the table owner; nobody calls it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Only a signed-in person can ask whether access has lapsed.
revoke execute on function public.has_access(uuid) from anon;
