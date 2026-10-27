-- متابعة أداء كل عضو، التكليف المباشر، والتنبيهات الرسمية، ومؤشرات صحة التنظيم

-- قائمة الأعضاء بمؤشرات الأداء (للأمين والمساعد في نطاقه)
create or replace function public.members_performance(p_root uuid default null)
returns table (member_id uuid, full_name text, phone text, role public.member_role, unit_id uuid, unit_name text,
               activity_status public.activity_status, last_active_at timestamptz, created_at timestamptz,
               points_30 int, total_points int, offers_30 int, accepted_30 int, approved_30 int,
               attendance_30 int, open_tasks int, overdue int, reliability numeric)
language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid := coalesce(p_root, public.scope_root());
begin
  if v_root is null or not public.in_my_scope(v_root) then raise exception 'خارج نطاقك'; end if;
  return query
  select p.id, p.full_name, p.phone, p.role, p.unit_id, u.name, p.activity_status, p.last_active_at, p.created_at,
    coalesce((select sum(l.amount) from public.point_ledger l where l.member_id = p.id and l.created_at > now() - interval '30 days'), 0)::int,
    coalesce((select sum(l.amount) from public.point_ledger l where l.member_id = p.id), 0)::int,
    (select count(*)::int from public.assignments a where a.member_id = p.id and a.offered_at > now() - interval '30 days'),
    (select count(*)::int from public.assignments a where a.member_id = p.id and a.offered_at > now() - interval '30 days' and a.accepted_at is not null),
    (select count(*)::int from public.assignments a where a.member_id = p.id and a.status = 'approved' and a.reviewed_at > now() - interval '30 days'),
    (select count(*)::int from public.attendance t where t.member_id = p.id and t.checked_in_at > now() - interval '30 days'),
    (select count(*)::int from public.assignments a where a.member_id = p.id and a.status in ('accepted', 'rework', 'submitted')),
    (select count(*)::int from public.assignments a join public.tasks t on t.id = a.task_id
      where a.member_id = p.id and a.status in ('accepted', 'rework') and t.deadline < now()),
    public.member_reliability(p.id)
  from public.profiles p
  join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_root
  join public.units u on u.id = p.unit_id
  order by 10 desc, p.full_name;
end $$;

-- الملف الكامل لعضو واحد
create or replace function public.member_performance(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not (p_member = auth.uid() or public.member_in_scope(p_member)) then raise exception 'العضو خارج نطاقك'; end if;
  select jsonb_build_object(
    'points_30', coalesce((select sum(amount) from public.point_ledger where member_id = p_member and created_at > now() - interval '30 days'), 0),
    'points_prev_30', coalesce((select sum(amount) from public.point_ledger where member_id = p_member
                                and created_at between now() - interval '60 days' and now() - interval '30 days'), 0),
    'total_points', coalesce((select sum(amount) from public.point_ledger where member_id = p_member), 0),
    'offers', (select count(*) from public.assignments where member_id = p_member),
    'accepted', (select count(*) from public.assignments where member_id = p_member and accepted_at is not null),
    'declined', (select count(*) from public.assignments where member_id = p_member and status = 'declined'),
    'expired', (select count(*) from public.assignments where member_id = p_member and status = 'expired'),
    'withdrawn', (select count(*) from public.assignments where member_id = p_member and status = 'withdrawn'),
    'approved', (select count(*) from public.assignments where member_id = p_member and status = 'approved'),
    'rejected', (select count(*) from public.assignments where member_id = p_member and status = 'rejected'),
    'first_pass', (select count(*) from public.assignments where member_id = p_member and status = 'approved' and rework_count = 0),
    'on_time', (select count(*) from public.assignments a join public.tasks t on t.id = a.task_id
                where a.member_id = p_member and a.status = 'approved' and a.submitted_at <= t.deadline),
    'overdue', (select count(*) from public.assignments a join public.tasks t on t.id = a.task_id
                where a.member_id = p_member and a.status in ('accepted', 'rework') and t.deadline < now()),
    'avg_response_hours', (select round(avg(extract(epoch from accepted_at - offered_at) / 3600)::numeric, 1)
                           from public.assignments where member_id = p_member and accepted_at is not null),
    'attendance_30', (select count(*) from public.attendance where member_id = p_member and checked_in_at > now() - interval '30 days'),
    'attendance_total', (select count(*) from public.attendance where member_id = p_member),
    'events_in_scope_30', (select count(*) from public.events e
                           where e.starts_at > now() - interval '30 days' and e.starts_at < now()
                             and e.unit_id in (select ancestor_id from public.unit_closure
                                               where descendant_id = (select unit_id from public.profiles where id = p_member))),
    'reliability', public.member_reliability(p_member),
    'streak_weeks', public.member_streak(p_member),
    'weekly', (select jsonb_agg(jsonb_build_object('week', w::date, 'points',
                 coalesce((select sum(amount) from public.point_ledger where member_id = p_member
                           and created_at >= w and created_at < w + interval '1 week'), 0)) order by w)
               from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w),
    'by_category', (select jsonb_object_agg(category, n) from (
                      select t.category, count(*) n from public.assignments a join public.tasks t on t.id = a.task_id
                      where a.member_id = p_member and a.status = 'approved' group by t.category) c),
    'consent_recognition', public.has_active_consent(p_member, 'public_recognition')
  ) into v;
  return v;
end $$;

-- تكليف مباشر من الأمين لأعضاء بعينهم (بيتسجل "قيد التنفيذ" على طول ويوصل العضو إشعار)
create or replace function public.assign_task_direct(p_task uuid, p_members uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare t public.tasks; m uuid; n int := 0;
begin
  select * into t from public.tasks where id = p_task;
  if not found or not public.is_staff() or not public.in_my_scope(t.unit_id) then raise exception 'التكليف خارج نطاقك'; end if;
  if t.status <> 'open' then raise exception 'التكليف مغلق'; end if;
  foreach m in array p_members loop
    if not public.member_in_scope(m) then continue; end if;
    insert into public.assignments(task_id, member_id, status, match_reason, offered_at, offer_expires_at, accepted_at)
    values (t.id, m, 'accepted', 'تكليف مباشر من ' || (select full_name from public.profiles where id = auth.uid()),
            now(), now(), now())
    on conflict (task_id, member_id) do update
      set status = 'accepted', match_reason = excluded.match_reason, accepted_at = now()
      where public.assignments.status in ('offered', 'declined', 'expired', 'withdrawn');
    if found then
      n := n + 1;
      perform public.notify(m, 'تكليف مباشر', format('تم تكليفك بـ «%s» — موعد التسليم %s', t.title,
        to_char(t.deadline at time zone 'Africa/Cairo', 'DD/MM HH24:MI')), '/');
    end if;
  end loop;
  update public.tasks set capacity = greatest(capacity, (select count(*) from public.assignments
    where task_id = t.id and status in ('accepted', 'submitted', 'rework', 'approved'))) where id = t.id;
  insert into public.audit_log(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'task.assigned_direct', 'task', t.id::text, jsonb_build_object('members', p_members, 'count', n));
  return n;
end $$;

-- تنبيه رسمي من الأمين لعضو (بيتسجل في سجل التدقيق)
create or replace function public.send_member_notice(p_member uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() or not public.member_in_scope(p_member) then raise exception 'العضو خارج نطاقك'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'العنوان مطلوب'; end if;
  perform public.notify(p_member, p_title, p_body, '/');
  insert into public.audit_log(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'member.notice', 'profile', p_member::text, jsonb_build_object('title', p_title));
end $$;

-- مؤشرات صحة التنظيم اللي الأحزاب بتتابعها
create or replace function public.org_health(p_root uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid := coalesce(p_root, public.scope_root()); v jsonb;
begin
  if v_root is null or not public.in_my_scope(v_root) then raise exception 'خارج نطاقك'; end if;
  with mem as (
    select p.* from public.profiles p
    join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_root
    where p.role = 'member'
  ), units_in as (
    select u.* from public.units u join public.unit_closure uc on uc.descendant_id = u.id and uc.ancestor_id = v_root
  ), asg as (
    select a.*, t.deadline, t.category from public.assignments a join public.tasks t on t.id = a.task_id
    join units_in u on u.id = t.unit_id
  ), leaf as (
    select u.* from units_in u where u.type in ('center', 'unit')
      or (u.type = 'governorate' and not exists (select 1 from public.units c where c.parent_id = u.id))
  )
  select jsonb_build_object(
    'members', (select count(*) from mem),
    'new_30', (select count(*) from mem where created_at > now() - interval '30 days'),
    'new_prev_30', (select count(*) from mem where created_at between now() - interval '60 days' and now() - interval '30 days'),
    'approved_30', (select count(*) from asg where status = 'approved' and reviewed_at > now() - interval '30 days'),
    'on_time_30', (select count(*) from asg where status = 'approved' and reviewed_at > now() - interval '30 days' and submitted_at <= deadline),
    'first_pass_30', (select count(*) from asg where status = 'approved' and reviewed_at > now() - interval '30 days' and rework_count = 0),
    'field_reports_30', (select count(*) from asg where status = 'approved' and category in ('field_report', 'door_to_door')
                         and reviewed_at > now() - interval '30 days'),
    'recruitment_30', (select count(*) from asg where status = 'approved' and category = 'recruitment' and reviewed_at > now() - interval '30 days'),
    'avg_review_hours', (select round(avg(extract(epoch from reviewed_at - submitted_at) / 3600)::numeric, 1)
                         from asg where reviewed_at > now() - interval '30 days' and submitted_at is not null),
    'events_30', (select count(*) from public.events e join units_in u on u.id = e.unit_id
                  where e.starts_at > now() - interval '30 days' and e.starts_at < now()),
    'avg_attendance', (select round(avg(c)::numeric, 1) from (select count(t.id) c from public.events e join units_in u on u.id = e.unit_id
                       left join public.attendance t on t.event_id = e.id
                       where e.starts_at > now() - interval '30 days' and e.starts_at < now() group by e.id) x),
    'leaf_units', (select count(*) from leaf),
    'inactive_units', (select jsonb_agg(name order by name) from leaf l where not exists (
                         select 1 from public.point_ledger pl join public.profiles p on p.id = pl.member_id
                         join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = l.id
                         where pl.created_at > now() - interval '30 days')),
    'units_without_staff', (select jsonb_agg(name order by name) from units_in u where u.type in ('governorate', 'center')
                            and not exists (select 1 from public.profiles p join public.unit_closure uc
                                            on uc.ancestor_id = p.unit_id and uc.descendant_id = u.id
                                            where p.role in ('assistant', 'coordinator') and uc.depth <= 1)),
    'no_unit_members', (select count(*) from public.profiles where unit_id is null and public.is_admin())
  ) into v;
  return v;
end $$;

revoke execute on function public.members_performance(uuid), public.member_performance(uuid),
  public.assign_task_direct(uuid, uuid[]), public.send_member_notice(uuid, text, text), public.org_health(uuid)
  from public, anon;
grant execute on function public.members_performance(uuid), public.member_performance(uuid),
  public.assign_task_direct(uuid, uuid[]), public.send_member_notice(uuid, text, text), public.org_health(uuid)
  to authenticated;
