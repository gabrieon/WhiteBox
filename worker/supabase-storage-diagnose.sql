-- Diagnostic: why did the thumbnail policies not get created?
-- Supabase Dashboard -> SQL Editor -> paste -> Run. Read the output.

-- Q1. Does the bucket exist, and is it public?
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'game-thumbs';

-- Q2. Is row-level security actually enabled on storage.objects?
--     expect: relrowsecurity = true
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage' and c.relname = 'objects';

-- Q3. Every policy that exists in the storage schema, no filters.
--     This is the one that matters: our four should appear here by name.
select policyname, tablename, cmd, roles
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;

-- Q4. Do we even have permission to create policies here?
--     expect: rolsuper = false, and policy/create on pg_policies or the table
select current_user,
       rolsuper,
       has_table_privilege(current_user, 'storage.objects', 'INSERT') as can_modify_rows;

-- Q5. Does the helper function the policies depend on exist?
--     The policies call storage.foldername(name). If it is missing, every
--     CREATE POLICY referencing it raises an error rather than creating
--     anything — which would explain "ran the script, no policies".
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'storage' and p.proname like 'foldername%';