-- Row Level Security for the সংসদ engine behind mymp.bd.
-- Idempotent: re-run after every migration. The service role bypasses RLS,
-- so workers and admin server actions write freely; anon and authenticated
-- (the browser, PostgREST) may read published rows only and can never write.
--
-- Privileges and policies are both explicit here. Supabase grants anon and
-- authenticated everything on new tables by default; a bare Postgres grants
-- nothing. This file makes both behave the same: every table starts with no
-- sangsad privilege, and a SELECT grant appears only together with a policy.

grant usage on schema sangsad to anon, authenticated;

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'sangsad'
      and tablename not like '__drizzle%'
  loop
    execute format('alter table sangsad.%I enable row level security', t);
    execute format('revoke all on sangsad.%I from anon, authenticated', t);
  end loop;
end $$;

-- helper: drop-then-create keeps this file re-runnable; the grant travels with the policy
create or replace function sangsad._policy(tbl text, name text, using_expr text) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on sangsad.%I', name, tbl);
  execute format('create policy %I on sangsad.%I for select to anon, authenticated using (%s)', name, tbl, using_expr);
  execute format('grant select on sangsad.%I to anon, authenticated', tbl);
end $$;

-- reference data: fully sangsad
select sangsad._policy('parliaments',   'sangsad_read', 'true');
select sangsad._policy('parties',       'sangsad_read', 'true');
select sangsad._policy('divisions',     'sangsad_read', 'true');
select sangsad._policy('districts',     'sangsad_read', 'true');
select sangsad._policy('constituencies','sangsad_read', 'true');
select sangsad._policy('members',       'sangsad_read', 'true');
select sangsad._policy('member_terms',  'sangsad_read', 'true');
select sangsad._policy('committees',    'sangsad_read', 'true');
select sangsad._policy('member_committees', 'sangsad_read', 'true');
select sangsad._policy('sources',       'sangsad_read', 'status = ''active''');

-- what the House is doing: official, sangsad
select sangsad._policy('parliament_sessions', 'sangsad_read', 'true');
select sangsad._policy('sittings',            'sangsad_read', 'true');
select sangsad._policy('notices',             'sangsad_read', 'true');
select sangsad._policy('notice_members',      'sangsad_read', 'true');

-- editorial data: only what an editor verified
select sangsad._policy('election_results', 'sangsad_read_verified', 'status = ''verified''');
select sangsad._policy('affidavits',       'sangsad_read_verified', 'status = ''verified''');
select sangsad._policy('affidavit_cases',  'sangsad_read_verified',
  'exists (select 1 from sangsad.affidavits a where a.id = affidavit_id and a.status = ''verified'')');
select sangsad._policy('bio_facts',        'sangsad_read_verified', 'status = ''verified''');
select sangsad._policy('bio_fact_sources', 'sangsad_read_verified',
  'exists (select 1 from sangsad.bio_facts f where f.id = bio_fact_id and f.status = ''verified'')');

-- news: headlines are sangsad; a match is sangsad only when auto-published or approved
select sangsad._policy('articles',        'sangsad_read', 'true');
select sangsad._policy('videos',          'sangsad_read', 'true');
select sangsad._policy('article_members', 'sangsad_read_published', 'status in (''auto'', ''approved'')');
select sangsad._policy('video_members',   'sangsad_read_published', 'status in (''auto'', ''approved'')');

-- never sangsad: member_aliases, corrections, audit_log, ingest_runs, admin_users
-- (no policy and no SELECT grant: a sangsad read is refused outright)
drop policy if exists sangsad_read on sangsad.member_aliases;
drop policy if exists sangsad_read on sangsad.corrections;
drop policy if exists sangsad_read on sangsad.audit_log;
drop policy if exists sangsad_read on sangsad.ingest_runs;
drop policy if exists sangsad_read on sangsad.admin_users;

-- the sangsad correction form may INSERT, nothing else, and only open rows with no resolution
drop policy if exists sangsad_submit on sangsad.corrections;
create policy sangsad_submit on sangsad.corrections for insert to anon, authenticated
  with check (status = 'open' and resolution is null and resolved_by is null);
grant insert on sangsad.corrections to anon, authenticated;
grant usage, select on sequence sangsad.corrections_id_seq to anon, authenticated;

grant usage on schema sangsad to service_role;
grant all on all tables in schema sangsad to service_role;
grant usage, select on all sequences in schema sangsad to service_role;
alter default privileges in schema sangsad grant all on tables to service_role;
alter default privileges in schema sangsad grant usage, select on sequences to service_role;
