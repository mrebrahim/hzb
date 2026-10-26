-- أمناء مساعدين إضافيين للديمو (عشان ترتيب المساعدين يبقى فيه منافسة)،
-- وكل مراجعة/مهمة/فعالية تاريخية تتنسب لأقرب أمين مساعد مسؤول عن الوحدة
create or replace function public.seed_demo_staff() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record; v_id uuid; v_unit uuid; v_n int := 0;
begin
  for r in select * from (values
      (1, 'عمرو حمدي', 'شبرا'), (2, 'دينا رشاد', 'مصر الجديدة'), (3, 'كريم فؤاد', 'الجيزة'),
      (4, 'ياسر منصور', 'الهرم'), (5, 'نهى السيد', 'الإسكندرية')) as t(n, name, unit) loop
    select id into v_unit from public.units where is_demo and name = r.unit;
    if v_unit is null or exists (select 1 from auth.users where email = 'staff' || r.n || '@demo.hzb.app') then continue; end if;
    v_id := gen_random_uuid();
    insert into auth.users(instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                           created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', 'staff' || r.n || '@demo.hzb.app',
            now(), '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', r.name, 'consent_membership', 'true', 'consent_recognition', 'true'),
            now() - interval '120 days', now(), '', '', '', '');
    update public.profiles set role = 'assistant', unit_id = v_unit, last_active_at = now() - make_interval(days => r.n % 3)
     where id = v_id;
    v_n := v_n + 1;
  end loop;

  -- أقرب أمين مساعد لكل وحدة ديمو
  create temp table _resp on commit drop as
  select distinct on (u.id) u.id as unit_id, p.id as staff_id
  from public.units u
  join public.unit_closure uc on uc.descendant_id = u.id
  join public.profiles p on p.unit_id = uc.ancestor_id and p.role = 'assistant'
  where u.is_demo
  order by u.id, uc.depth;

  update public.assignments a set reviewed_by = x.staff_id
  from public.tasks t join _resp x on x.unit_id = t.unit_id
  where t.id = a.task_id and a.reviewed_by is not null;
  update public.tasks t set created_by = x.staff_id from _resp x where x.unit_id = t.unit_id;
  update public.events e set created_by = x.staff_id from _resp x where x.unit_id = e.unit_id;
  return v_n;
end $$;
revoke execute on function public.seed_demo_staff() from public, anon, authenticated;

select cron.schedule('hzb-demo-reset', '0 1 * * *', $$select public.seed_demo(); select public.seed_demo_staff();$$);
select public.seed_demo_staff();
