-- مؤشرات المساءلة للعضو: نسبة الالتزام وعدد التكليفات المتأخرة
create or replace function public.my_accountability() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'reliability', public.member_reliability(auth.uid()),
    'overdue', (select count(*) from public.assignments a join public.tasks t on t.id = a.task_id
                where a.member_id = auth.uid() and a.status in ('accepted', 'rework') and t.deadline < now()),
    'accepted_total', (select count(*) from public.assignments where member_id = auth.uid() and accepted_at is not null))
$$;
revoke execute on function public.my_accountability() from public, anon;
grant execute on function public.my_accountability() to authenticated;
