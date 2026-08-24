-- Live Executive Dashboard KPI refresh sources.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'students',
    'counselling_records',
    'university_applications',
    'visa_tracking',
    'finance_receipts'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end
$$;
