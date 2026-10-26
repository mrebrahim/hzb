-- بيانات لوحات الحماس: سلسلة الأسابيع، الشارات، ترتيب الوحدة، أبطال الأعضاء، وترتيب الأمناء المساعدين

-- كام أسبوع ورا بعض العضو كان نشط فيهم (الأسبوع الحالي مش بيكسر السلسلة لو لسه مابدأش)
create or replace function public.member_streak(p_member uuid) returns int
language sql stable security definer set search_path = '' as $$
  with w as (
    select distinct date_trunc('week', created_at) as wk from public.point_ledger where member_id = p_member and amount > 0
  ), s as (
    select g.n, exists (select 1 from w where w.wk = date_trunc('week', now()) - make_interval(weeks => g.n)) as hit
    from generate_series(0, 52) g(n)
  )
  select coalesce((select min(n) from s where not hit and n > 0), 53)
       - case when (select hit from s where n = 0) then 0 else 1 end
$$;

create or replace function public.my_standing() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid(); v_unit uuid := public.my_unit(); v_parent uuid;
  v_total int; v_30 int; v_prev int; v_week int; v_pct numeric; v_peers int;
  v_appr int; v_att int; v_rank int; v_siblings int;
begin
  select coalesce(sum(amount), 0) into v_total from public.point_ledger where member_id = v_me;
  select coalesce(sum(amount), 0) into v_30 from public.point_ledger
   where member_id = v_me and created_at > now() - interval '30 days';
  select coalesce(sum(amount), 0) into v_prev from public.point_ledger
   where member_id = v_me and created_at between now() - interval '60 days' and now() - interval '30 days';
  select coalesce(sum(amount), 0) into v_week from public.point_ledger
   where member_id = v_me and created_at >= date_trunc('week', now());
  select count(*) into v_appr from public.assignments where member_id = v_me and status = 'approved';
  select count(*) into v_att from public.attendance where member_id = v_me;

  with peers as (
    select p.id, coalesce((select sum(l.amount) from public.point_ledger l
       where l.member_id = p.id and l.created_at > now() - interval '30 days'), 0) as pts
    from public.profiles p where p.unit_id = v_unit
  )
  select count(*), case when count(*) <= 1 then null
         else round(100.0 * count(*) filter (where pts < v_30) / (count(*) - 1)) end
    into v_peers, v_pct
  from peers;

  -- ترتيب وحدتي وسط الوحدات الشقيقة (نقاط لكل عضو آخر 30 يوم) — منافسة فرق مش أفراد
  select parent_id into v_parent from public.units where id = v_unit;
  with sib as (
    select u.id,
      coalesce((select sum(l.amount)::numeric / nullif(count(distinct p.id), 0)
                from public.unit_closure uc join public.profiles p on p.unit_id = uc.descendant_id
                left join public.point_ledger l on l.member_id = p.id and l.created_at > now() - interval '30 days'
                where uc.ancestor_id = u.id), 0) as score
    from public.units u where u.parent_id = v_parent
  )
  select count(*), (select 1 + count(*) from sib s2 where s2.score > (select score from sib where id = v_unit))
    into v_siblings, v_rank
  from sib;

  return jsonb_build_object('total', v_total, 'points_30', v_30, 'points_prev_30', v_prev, 'points_week', v_week,
    'level', public.level_for(v_total), 'percentile_in_unit', v_pct, 'unit_peers', v_peers,
    'approved_total', v_appr, 'attendance_total', v_att, 'streak_weeks', public.member_streak(v_me),
    'unit_rank', case when v_parent is null then null else v_rank end, 'unit_siblings', v_siblings,
    'unit_name', (select name from public.units where id = v_unit),
    'parent_name', (select name from public.units where id = v_parent));
end $$;

-- أبطال الأعضاء في نطاق الأمين (للأمين والمساعد بس)
create or replace function public.leaderboard_members(p_root uuid default null, p_limit int default 10)
returns table (member_id uuid, full_name text, unit_name text, points_30 int, approved_30 int,
               attendance_30 int, streak_weeks int, total_points int)
language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid := coalesce(p_root, public.scope_root());
begin
  if v_root is null or not public.in_my_scope(v_root) then raise exception 'خارج نطاقك'; end if;
  return query
  with mem as (
    select p.id, p.full_name, u.name as uname from public.profiles p
    join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_root
    join public.units u on u.id = p.unit_id
    where p.role = 'member'
  ), sc as (
    select m.*,
      coalesce((select sum(l.amount) from public.point_ledger l where l.member_id = m.id and l.created_at > now() - interval '30 days'), 0)::int as p30,
      coalesce((select sum(l.amount) from public.point_ledger l where l.member_id = m.id), 0)::int as ptot
    from mem m
  )
  select sc.id, sc.full_name, sc.uname, sc.p30,
    (select count(*)::int from public.assignments a where a.member_id = sc.id and a.status = 'approved' and a.reviewed_at > now() - interval '30 days'),
    (select count(*)::int from public.attendance t where t.member_id = sc.id and t.checked_in_at > now() - interval '30 days'),
    public.member_streak(sc.id), sc.ptot
  from sc where sc.p30 > 0
  order by sc.p30 desc, sc.ptot desc
  limit least(greatest(p_limit, 1), 50);
end $$;

-- ترتيب الأمناء المساعدين والأمناء: مراجعات + مهام نزّلوها + فعاليات + نشاط فريقهم
create or replace function public.leaderboard_staff(p_root uuid default null)
returns table (staff_id uuid, full_name text, role public.member_role, unit_name text,
               reviews_30 int, tasks_30 int, events_30 int, team_members int, team_active int, score int)
language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid := coalesce(p_root, public.scope_root());
begin
  if v_root is null or not public.in_my_scope(v_root) then raise exception 'خارج نطاقك'; end if;
  return query
  with st as (
    select p.id, p.full_name, p.role, p.unit_id, u.name as uname from public.profiles p
    join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_root
    join public.units u on u.id = p.unit_id
    where p.role in ('assistant', 'coordinator')
  ), m as (
    select st.*,
      (select count(*)::int from public.assignments a where a.reviewed_by = st.id and a.reviewed_at > now() - interval '30 days') as rv,
      (select count(*)::int from public.tasks t where t.created_by = st.id and t.created_at > now() - interval '30 days') as tk,
      (select count(*)::int from public.events e where e.created_by = st.id and e.created_at > now() - interval '30 days') as ev,
      (select count(*)::int from public.unit_closure uc join public.profiles p on p.unit_id = uc.descendant_id
        where uc.ancestor_id = st.unit_id and p.role = 'member') as tm,
      (select count(*)::int from public.unit_closure uc join public.profiles p on p.unit_id = uc.descendant_id
        where uc.ancestor_id = st.unit_id and p.role = 'member' and p.activity_status = 'active') as ta
    from st
  )
  select m.id, m.full_name, m.role, m.uname, m.rv, m.tk, m.ev, m.tm, m.ta,
    (m.rv * 2 + m.tk * 3 + m.ev * 4 + case when m.tm > 0 then round(50.0 * m.ta / m.tm) else 0 end)::int
  from m order by 10 desc;
end $$;

revoke execute on function public.member_streak(uuid) from public, anon, authenticated;
grant execute on function public.leaderboard_members(uuid, int), public.leaderboard_staff(uuid) to authenticated;
revoke execute on function public.leaderboard_members(uuid, int), public.leaderboard_staff(uuid) from public, anon;
