-- has_access() is for the row-level security rules, not for the public API. Moved out of
-- `public`, signed-in people can't call it directly for any user id. The policies that use it
-- follow the function, and still run it as the person making the request.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.has_access(uuid) set schema private;
revoke execute on function private.has_access(uuid) from public, anon;
grant execute on function private.has_access(uuid) to authenticated;
