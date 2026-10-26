-- المحرك: توزيع المهام، المراجعة والنقاط، الحضور بـ QR متغير، المؤشرات، والأتمتة المجدولة

alter table public.assignments add column withdrawn_late boolean not null default false;

-- ───────────────────────── أدوات مساعدة ─────────────────────────
create function public.notify(p_member uuid, p_title text, p_body text, p_link text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications(member_id, title, body, link) values (p_member, p_title, p_body, p_link);
$$;

-- يبلّغ المنسقين المسؤولين عن الوحدة (الوحدة نفسها وما فوقها)؛ لو مفيش، يبلّغ الأدمن
create function public.notify_unit_staff(p_unit uuid, p_title text, p_body text, p_link text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.notifications(member_id, title, body, link)
  select p.id, p_title, p_body, p_link
  from public.profiles p
  join public.unit_closure uc on uc.ancestor_id = p.unit_id and uc.descendant_id = p_unit
  where p.role = 'coordinator';
  get diagnostics n = row_count;
  if n = 0 then
    insert into public.notifications(member_id, title, body, link)
    select id, p_title, p_body, p_link from public.profiles where role = 'admin';
  end if;
end $$;

create function public.has_active_consent(p_member uuid, p_purpose text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select granted from public.consents
                   where member_id = p_member and purpose = p_purpose
                   order by recorded_at desc, id desc limit 1), false)
$$;

create function public.touch_member(p_member uuid) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_active_at = now(),
    activity_status = case when activity_status = 'suspended' then activity_status else 'active' end
  where id = p_member;
$$;

-- سلّم الترقّي: النقاط بتفتح مستويات حقيقية في التنظيم، مش بتتصرف فلوس
create function public.level_for(p_points int) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when p_points >= 800 then jsonb_build_object('level', 4, 'name', 'مرشّح لأمانة', 'floor', 800, 'next', null)
    when p_points >= 300 then jsonb_build_object('level', 3, 'name', 'منسّق شارع/قرية', 'floor', 300, 'next', 800)
    when p_points >= 100 then jsonb_build_object('level', 2, 'name', 'عضو نشط', 'floor', 100, 'next', 300)
    else jsonb_build_object('level', 1, 'name', 'عضو', 'floor', 0, 'next', 100)
  end
$$;

create function public.category_motivation(p_cat public.task_category) returns public.motivation
language sql immutable set search_path = '' as $$
  select (case p_cat
    when 'field_report' then 'values'
    when 'door_to_door' then 'values'
    when 'community_service' then 'values'
    when 'outreach' then 'social'
    when 'recruitment' then 'social'
    when 'event_support' then 'social'
    when 'training' then 'understanding'
    when 'media' then 'enhancement'
    when 'organizing' then 'career'
  end)::public.motivation
$$;

create function public.member_reliability(p_member uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  -- بيتحسب بس من المهام اللي العضو وافق عليها بنفسه؛ رفض العرض مش بيأثر
  select case when ok + bad = 0 then 0.7 else round(ok::numeric / (ok + bad), 3) end
  from (
    select count(*) filter (where a.status = 'approved') ok,
           count(*) filter (where a.status = 'rejected'
                               or (a.status = 'withdrawn' and a.withdrawn_late)
                               or (a.status in ('accepted', 'rework') and t.deadline < now())) bad
    from public.assignments a join public.tasks t on t.id = a.task_id
    where a.member_id = p_member
  ) s
$$;

-- ───────────────────────── محرك التوزيع ─────────────────────────
-- 1) قيود صلبة: داخل نطاق الوحدة، موافقة سارية، مش موقوف، عنده المهارة المطلوبة، تحت حد الحمل
-- 2) درجة قابلة للتفسير:
--    0.35 مهارة + 0.20 توافر + 0.15 دافع (VFI) + 0.15 موثوقية + 0.15 عدالة − إرهاق
create function public._distribute(p_task uuid, p_target int default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
  v_filled int; v_pending int; v_target int; v_created int;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or t.status <> 'open' or t.deadline <= now() then return 0; end if;

  select count(*) filter (where status in ('accepted', 'submitted', 'rework', 'approved')),
         count(*) filter (where status = 'offered' and offer_expires_at > now())
    into v_filled, v_pending
  from public.assignments where task_id = p_task;

  v_target := coalesce(p_target, greatest((t.capacity - v_filled) * 2 - v_pending, 0));
  if v_target <= 0 then return 0; end if;

  with cand as (
    select p.id, p.motivations, p.available_days, p.max_open_tasks,
      case when cardinality(t.required_skills) = 0 then 1.0
           else (select count(*) from unnest(t.required_skills) s where s = any(p.skills))::numeric
                / cardinality(t.required_skills) end as skill_fit,
      case when cardinality(p.available_days) = 0 then 0.5
           when exists (select 1 from generate_series(now(), t.deadline, interval '1 day') d
                        where extract(dow from d at time zone 'Africa/Cairo')::smallint = any(p.available_days)) then 1.0
           else 0.2 end as avail_fit,
      case when cardinality(p.motivations) = 0 then 0.5
           when public.category_motivation(t.category) = any(p.motivations) then 1.0
           else 0.2 end as motive_fit,
      public.member_reliability(p.id) as reliability,
      (select count(*) from public.assignments a
        where a.member_id = p.id and a.offered_at > now() - interval '30 days') as offers_30,
      (select count(*) from public.assignments a
        where a.member_id = p.id and a.status in ('accepted', 'submitted', 'rework')) as open_cnt
    from public.profiles p
    join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = t.unit_id
    where p.activity_status <> 'suspended'
      and public.has_active_consent(p.id, 'membership_processing')
      and not exists (select 1 from public.assignments a where a.task_id = t.id and a.member_id = p.id)
  ), scored as (
    select c.*,
      round(0.35 * skill_fit + 0.20 * avail_fit + 0.15 * motive_fit + 0.15 * reliability
            + 0.15 * (1 - least(offers_30, 10) / 10.0) - 0.08 * open_cnt, 3) as score
    from cand c
    where skill_fit > 0 and open_cnt < max_open_tasks
  ), picked as (
    select * from scored order by score desc, offers_30 asc, random() limit v_target
  ), ins as (
    insert into public.assignments(task_id, member_id, status, match_score, match_reason, offer_expires_at)
    select t.id, pk.id, 'offered', pk.score,
      array_to_string(array_remove(array[
        case when cardinality(t.required_skills) > 0 and pk.skill_fit = 1 then 'عندك كل المهارات المطلوبة'
             when cardinality(t.required_skills) > 0 then 'عندك جزء من المهارات المطلوبة' end,
        case when pk.avail_fit = 1 then 'متاح في أيام قبل الموعد' end,
        case when pk.motive_fit = 1 then 'المهمة مناسبة لاهتماماتك' end,
        case when pk.offers_30 < 2 then 'فرصة عادلة: ما اتعرضش عليك مهام كتير مؤخراً' end,
        case when pk.reliability >= 0.9 then 'سجل التزامك ممتاز' end
      ], null), ' • '),
      least(now() + case when t.priority in ('p0', 'p1') then interval '6 hours' else interval '24 hours' end, t.deadline)
    from picked pk
    returning member_id
  )
  insert into public.notifications(member_id, title, body, link)
  select member_id, 'مهمة جديدة مناسبة ليك', t.title, '/' from ins;

  get diagnostics v_created = row_count;
  return v_created;
end $$;

create function public.distribute_task(p_task uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.task_in_scope(p_task) then raise exception 'المهمة خارج نطاقك'; end if;
  n := public._distribute(p_task, null);
  insert into public.audit_log(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'task.distributed', 'task', p_task::text, jsonb_build_object('offers', n));
  return n;
end $$;

-- ───────────────────────── دورة حياة الإسناد (العضو) ─────────────────────────
create function public.accept_assignment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.assignments; t public.tasks; v_filled int;
begin
  select * into a from public.assignments where id = p_id and member_id = auth.uid();
  if not found then raise exception 'العرض غير موجود'; end if;
  if a.status <> 'offered' then raise exception 'العرض ده مش متاح'; end if;
  if a.offer_expires_at <= now() then raise exception 'انتهت مهلة العرض'; end if;
  select * into t from public.tasks where id = a.task_id for update;
  if t.status <> 'open' then raise exception 'المهمة اتقفلت'; end if;
  select count(*) into v_filled from public.assignments
   where task_id = t.id and status in ('accepted', 'submitted', 'rework', 'approved');
  if v_filled >= t.capacity then raise exception 'العدد المطلوب اكتمل، شكراً لحماسك!'; end if;
  update public.assignments set status = 'accepted', accepted_at = now() where id = p_id;
  perform public.touch_member(auth.uid());
end $$;

create function public.decline_assignment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_task uuid;
begin
  update public.assignments set status = 'declined'
   where id = p_id and member_id = auth.uid() and status = 'offered'
  returning task_id into v_task;
  if v_task is null then raise exception 'العرض غير متاح'; end if;
  perform public._distribute(v_task, 1); -- الاعتذار من غير أي خصم؛ والعرض يروح لحد تاني
end $$;

create function public.withdraw_assignment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_task uuid; v_deadline timestamptz; v_unit uuid;
begin
  select a.task_id, t.deadline, t.unit_id into v_task, v_deadline, v_unit
  from public.assignments a join public.tasks t on t.id = a.task_id
  where a.id = p_id and a.member_id = auth.uid() and a.status in ('accepted', 'rework');
  if v_task is null then raise exception 'مينفعش تنسحب من المهمة دي'; end if;
  update public.assignments set status = 'withdrawn', withdrawn_late = (v_deadline - now() < interval '24 hours')
   where id = p_id;
  perform public._distribute(v_task, 2);
  if v_deadline - now() < interval '48 hours' then
    perform public.notify_unit_staff(v_unit, 'انسحاب من مهمة قريبة',
      'عضو انسحب من مهمة موعدها قرّب، والنظام بيدوّر على بديل تلقائياً', '/admin/tasks');
  end if;
end $$;

create function public.submit_assignment(p_id uuid, p_report text, p_evidence_url text default null,
                                         p_lat double precision default null, p_lng double precision default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.assignments; t public.tasks;
begin
  select * into a from public.assignments where id = p_id and member_id = auth.uid();
  if not found or a.status not in ('accepted', 'rework') then raise exception 'مينفعش تسلّم المهمة دي'; end if;
  select * into t from public.tasks where id = a.task_id;
  if t.requires_photo and coalesce(p_evidence_url, '') = '' then raise exception 'المهمة دي محتاجة صورة'; end if;
  if length(coalesce(p_report, '')) < 5 then raise exception 'اكتب تقرير قصير عن اللي عملته'; end if;
  update public.assignments set status = 'submitted', submitted_at = now(), report = p_report,
    evidence_url = nullif(p_evidence_url, ''), report_lat = p_lat, report_lng = p_lng
   where id = p_id;
  perform public.touch_member(auth.uid());
  perform public.notify_unit_staff(t.unit_id, 'تقرير جديد مستني مراجعة', t.title, '/admin/review');
end $$;

-- ───────────────────────── المراجعة والنقاط (المنسق) ─────────────────────────
create function public.review_assignment(p_id uuid, p_approve boolean, p_feedback text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.assignments; t public.tasks;
  v_points int; v_today int; v_cap constant int := 150;
begin
  select * into a from public.assignments where id = p_id for update;
  if not found or a.status <> 'submitted' then raise exception 'مفيش تسليم للمراجعة'; end if;
  select * into t from public.tasks where id = a.task_id;
  if not public.in_my_scope(t.unit_id) then raise exception 'خارج نطاقك'; end if;
  if a.member_id = auth.uid() then raise exception 'مينفعش تعتمد شغلك بنفسك'; end if;

  if not p_approve then
    if a.rework_count < 2 then
      update public.assignments set status = 'rework', rework_count = rework_count + 1,
        feedback = p_feedback, reviewed_at = now(), reviewed_by = auth.uid() where id = p_id;
      perform public.notify(a.member_id, 'محتاجين تعديل بسيط', coalesce(p_feedback, t.title), '/');
      return jsonb_build_object('status', 'rework');
    end if;
    update public.assignments set status = 'rejected', feedback = p_feedback,
      reviewed_at = now(), reviewed_by = auth.uid() where id = p_id;
    perform public.notify(a.member_id, 'المهمة ما اتعتمدتش', coalesce(p_feedback, t.title), '/');
    return jsonb_build_object('status', 'rejected');
  end if;

  -- جودة من أول مرة = +10%، وحد أقصى يومي للنقاط عشان النظام ما يتحولش لسباق كمية
  v_points := round(t.base_points * case when a.rework_count = 0 then 1.1 else 1.0 end);
  select coalesce(sum(amount), 0) into v_today from public.point_ledger
   where member_id = a.member_id and source_type = 'assignment'
     and created_at >= date_trunc('day', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo';
  v_points := greatest(least(v_points, v_cap - v_today), 0);

  update public.assignments set status = 'approved', feedback = p_feedback,
    reviewed_at = now(), reviewed_by = auth.uid() where id = p_id;

  if v_points > 0 then
    insert into public.point_ledger(member_id, amount, reason_code, source_type, source_id, idempotency_key, created_by, note)
    values (a.member_id, v_points, 'task.approved', 'assignment', p_id::text, 'assignment:' || p_id, auth.uid(), t.title)
    on conflict (idempotency_key) do nothing;
  end if;

  perform public.notify(a.member_id, 'شكراً! المهمة اتعتمدت',
    format('%s — اتضافلك %s نقطة%s', t.title, v_points, coalesce(E'\nملاحظة الفريق: ' || p_feedback, '')), '/');
  return jsonb_build_object('status', 'approved', 'points', v_points);
end $$;

-- تصحيح خطأ = حركة عكسية مرتبطة بالأصلية (الأدمن بس)
create function public.reverse_points(p_ledger bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.point_ledger;
begin
  if not public.is_admin() then raise exception 'للأدمن فقط'; end if;
  if coalesce(p_reason, '') = '' then raise exception 'لازم سبب'; end if;
  select * into l from public.point_ledger where id = p_ledger;
  if not found or l.reverses_id is not null then raise exception 'حركة غير صالحة'; end if;
  insert into public.point_ledger(member_id, amount, reason_code, source_type, source_id, idempotency_key, reverses_id, created_by, note)
  values (l.member_id, -l.amount, 'correction', l.source_type, l.source_id, 'reverse:' || l.id, l.id, auth.uid(), p_reason);
  insert into public.audit_log(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'points.reversed', 'point_ledger', l.id::text, jsonb_build_object('reason', p_reason));
  perform public.notify(l.member_id, 'تصحيح في النقاط', p_reason, '/');
end $$;

-- ───────────────────────── الحضور: QR بيتغير كل 30 ثانية + geofence ─────────────────────────
create function public._qr_token(p_secret text, p_window bigint) returns text
language sql immutable set search_path = '' as $$
  select left(encode(extensions.hmac(p_window::text, p_secret, 'sha256'), 'hex'), 16)
$$;

create function public.event_qr_token(p_event uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.events; s text; w bigint := floor(extract(epoch from now()) / 30);
begin
  select * into e from public.events where id = p_event;
  if not found or not public.in_my_scope(e.unit_id) then raise exception 'خارج نطاقك'; end if;
  select secret into s from public.event_secrets where event_id = p_event;
  return jsonb_build_object('token', public._qr_token(s, w),
    'expires_in', 30 - (floor(extract(epoch from now()))::bigint % 30));
end $$;

create function public._award_attendance(p_event public.events, p_member uuid, p_method text,
                                         p_by uuid, p_distance int) returns int
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.attendance(event_id, member_id, method, recorded_by, distance_m)
  values (p_event.id, p_member, p_method, p_by, p_distance);
  if p_event.points > 0 then
    insert into public.point_ledger(member_id, amount, reason_code, source_type, source_id, idempotency_key, created_by, note)
    values (p_member, p_event.points, 'event.attended', 'attendance', p_event.id::text,
            'attendance:' || p_event.id || ':' || p_member, p_by, p_event.title)
    on conflict (idempotency_key) do nothing;
  end if;
  perform public.touch_member(p_member);
  return p_event.points;
end $$;

create function public.check_in(p_event uuid, p_token text, p_lat double precision default null,
                                p_lng double precision default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.events; s text; w bigint := floor(extract(epoch from now()) / 30);
  v_dist int;
begin
  if auth.uid() is null then raise exception 'سجّل دخولك الأول'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'الفعالية غير موجودة'; end if;
  if now() < e.starts_at - interval '30 minutes' or now() > e.ends_at then
    raise exception 'التسجيل متاح وقت الفعالية بس';
  end if;
  if exists (select 1 from public.attendance where event_id = p_event and member_id = auth.uid()) then
    return jsonb_build_object('status', 'already', 'title', e.title);
  end if;
  select secret into s from public.event_secrets where event_id = p_event;
  -- بنقبل الكود الحالي واللي قبله (حوالي دقيقة ونص) عشان بطء الشبكة
  if p_token is null or p_token not in (public._qr_token(s, w), public._qr_token(s, w - 1), public._qr_token(s, w - 2)) then
    raise exception 'الكود انتهى — امسح الـ QR اللي على الشاشة دلوقتي';
  end if;
  if e.lat is not null and e.lng is not null then
    if p_lat is null or p_lng is null then raise exception 'محتاجين إذن الموقع لحظة التسجيل بس'; end if;
    v_dist := round(2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat - e.lat) / 2), 2) +
      cos(radians(e.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - e.lng) / 2), 2))));
    if v_dist > e.radius_m then
      raise exception 'إنت بعيد عن مكان الفعالية (% متر)', v_dist;
    end if;
  end if;
  return jsonb_build_object('status', 'ok', 'title', e.title,
    'points', public._award_attendance(e, auth.uid(), 'qr', null, v_dist));
end $$;

create function public.manual_check_in(p_event uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.events;
begin
  select * into e from public.events where id = p_event;
  if not found or not public.in_my_scope(e.unit_id) or not public.member_in_scope(p_member) then
    raise exception 'خارج نطاقك';
  end if;
  if exists (select 1 from public.attendance where event_id = p_event and member_id = p_member) then return; end if;
  perform public._award_attendance(e, p_member, 'manual', auth.uid(), null);
  insert into public.audit_log(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'attendance.manual', 'event', p_event::text, jsonb_build_object('member', p_member));
end $$;

-- ───────────────────────── المؤشرات (Dashboard أمانة المتابعة) ─────────────────────────
create function public.scope_root() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin()
    then coalesce((select id from public.units where parent_id is null order by created_at limit 1), public.my_unit())
    else public.my_unit() end
$$;

create function public.unit_kpis(p_root uuid default null)
returns table (
  unit_id uuid, unit_name text, unit_type public.unit_type, child_count int,
  members int, active int, slowing int, dormant int,
  offers_30 int, accepted_30 int, approved_30 int, attendance_30 int, points_30 int
)
language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid := coalesce(p_root, public.scope_root());
begin
  if v_root is null or not public.in_my_scope(v_root) then raise exception 'خارج نطاقك'; end if;
  return query
  with kids as (
    select u.id, u.name, u.type from public.units u where u.parent_id = v_root
    union all
    select u.id, u.name, u.type from public.units u
    where u.id = v_root and not exists (select 1 from public.units c where c.parent_id = v_root)
  ), mem as (
    select k.id as kid, p.id as pid, p.activity_status
    from kids k
    join public.unit_closure uc on uc.ancestor_id = k.id
    join public.profiles p on p.unit_id = uc.descendant_id
  )
  select k.id, k.name, k.type,
    (select count(*)::int from public.units c where c.parent_id = k.id),
    (select count(*)::int from mem m where m.kid = k.id),
    (select count(*)::int from mem m where m.kid = k.id and m.activity_status = 'active'),
    (select count(*)::int from mem m where m.kid = k.id and m.activity_status = 'slowing'),
    (select count(*)::int from mem m where m.kid = k.id and m.activity_status = 'dormant'),
    (select count(*)::int from public.assignments a join mem m on m.pid = a.member_id and m.kid = k.id
      where a.offered_at > now() - interval '30 days'),
    (select count(*)::int from public.assignments a join mem m on m.pid = a.member_id and m.kid = k.id
      where a.offered_at > now() - interval '30 days' and a.accepted_at is not null),
    (select count(*)::int from public.assignments a join mem m on m.pid = a.member_id and m.kid = k.id
      where a.status = 'approved' and a.reviewed_at > now() - interval '30 days'),
    (select count(*)::int from public.attendance at join mem m on m.pid = at.member_id and m.kid = k.id
      where at.checked_in_at > now() - interval '30 days'),
    (select coalesce(sum(l.amount), 0)::int from public.point_ledger l join mem m on m.pid = l.member_id and m.kid = k.id
      where l.created_at > now() - interval '30 days')
  from kids k
  order by k.name;
end $$;

create function public.weekly_activity(p_root uuid default null, p_weeks int default 8)
returns table (week date, active_members int, points int, approved int, attendance int)
language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid := coalesce(p_root, public.scope_root());
begin
  if v_root is null or not public.in_my_scope(v_root) then raise exception 'خارج نطاقك'; end if;
  return query
  with mem as (
    select p.id from public.profiles p
    join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_root
  ), weeks as (
    select generate_series(date_trunc('week', now()) - make_interval(weeks => p_weeks - 1),
                           date_trunc('week', now()), interval '1 week') as w
  ), acts as (
    select l.member_id, l.created_at as at, l.amount, 0 as appr, 0 as att from public.point_ledger l join mem on mem.id = l.member_id
    union all
    select a.member_id, a.reviewed_at, 0, 1, 0 from public.assignments a join mem on mem.id = a.member_id where a.status = 'approved'
    union all
    select t.member_id, t.checked_in_at, 0, 0, 1 from public.attendance t join mem on mem.id = t.member_id
  )
  select weeks.w::date,
    (select count(distinct x.member_id)::int from acts x where x.at >= weeks.w and x.at < weeks.w + interval '1 week'),
    (select coalesce(sum(x.amount), 0)::int from acts x where x.at >= weeks.w and x.at < weeks.w + interval '1 week'),
    (select coalesce(sum(x.appr), 0)::int from acts x where x.at >= weeks.w and x.at < weeks.w + interval '1 week'),
    (select coalesce(sum(x.att), 0)::int from acts x where x.at >= weeks.w and x.at < weeks.w + interval '1 week')
  from weeks order by 1;
end $$;

-- ترتيب العضو نسبي داخل وحدته (مش leaderboard عام على مستوى الجمهورية)
create function public.my_standing() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid(); v_unit uuid := public.my_unit();
  v_total int; v_30 int; v_prev int; v_pct numeric; v_peers int;
begin
  select coalesce(sum(amount), 0) into v_total from public.point_ledger where member_id = v_me;
  select coalesce(sum(amount), 0) into v_30 from public.point_ledger
   where member_id = v_me and created_at > now() - interval '30 days';
  select coalesce(sum(amount), 0) into v_prev from public.point_ledger
   where member_id = v_me and created_at between now() - interval '60 days' and now() - interval '30 days';
  with peers as (
    select p.id, coalesce((select sum(l.amount) from public.point_ledger l
       where l.member_id = p.id and l.created_at > now() - interval '30 days'), 0) as pts
    from public.profiles p where p.unit_id = v_unit
  )
  select count(*), case when count(*) <= 1 then null
         else round(100.0 * count(*) filter (where pts < v_30) / (count(*) - 1)) end
    into v_peers, v_pct
  from peers;
  return jsonb_build_object('total', v_total, 'points_30', v_30, 'points_prev_30', v_prev,
    'level', public.level_for(v_total), 'percentile_in_unit', v_pct, 'unit_peers', v_peers);
end $$;

-- مرشحين التقدير ("نجم الشهر") لكل وحدة فرعية — الأعلى نقاطاً في آخر 30 يوم
create function public.recognition_candidates(p_root uuid default null)
returns table (unit_id uuid, unit_name text, member_id uuid, full_name text, points_30 int,
               approved_30 int, can_publish boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid := coalesce(p_root, public.scope_root());
begin
  if v_root is null or not public.in_my_scope(v_root) then raise exception 'خارج نطاقك'; end if;
  return query
  with kids as (
    select u.id, u.name from public.units u where u.parent_id = v_root
    union all select u.id, u.name from public.units u where u.id = v_root
  ), ranked as (
    select k.id as kid, k.name as kname, p.id as pid, p.full_name,
      coalesce((select sum(l.amount) from public.point_ledger l
        where l.member_id = p.id and l.created_at > now() - interval '30 days'), 0)::int as pts,
      (select count(*) from public.assignments a where a.member_id = p.id and a.status = 'approved'
        and a.reviewed_at > now() - interval '30 days')::int as appr
    from kids k
    join public.unit_closure uc on uc.ancestor_id = k.id and (k.id <> v_root or uc.depth = 0)
    join public.profiles p on p.unit_id = uc.descendant_id
  ), top as (
    select r.*, row_number() over (partition by r.kid order by r.pts desc, r.appr desc) as rn from ranked r where r.pts > 0
  )
  select top.kid, top.kname, top.pid, top.full_name, top.pts, top.appr,
         public.has_active_consent(top.pid, 'public_recognition')
  from top where rn <= 3 order by top.kname, top.pts desc;
end $$;

-- ───────────────────────── الأتمتة المجدولة (كل 15 دقيقة) ─────────────────────────
create function public.run_automation() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_expired int := 0; v_reminded int := 0; v_escalated int := 0; v_dormant int := 0; r record;
begin
  -- 1) العروض اللي مهلتها خلصت تنتهي، والمهمة تتعرض على غيرهم
  with ex as (
    update public.assignments set status = 'expired'
    where status = 'offered' and offer_expires_at <= now()
    returning task_id
  )
  select count(*) into v_expired from ex;
  for r in select id from public.tasks where status = 'open' and deadline > now() loop
    perform public._distribute(r.id, null);
  end loop;

  -- 2) تذكير قبل الموعد بـ 24 ساعة (مرة واحدة)
  with rem as (
    update public.assignments a set reminded_at = now()
    from public.tasks t
    where t.id = a.task_id and a.status in ('accepted', 'rework') and a.reminded_at is null
      and t.deadline between now() and now() + interval '24 hours'
    returning a.member_id, t.title, t.deadline
  )
  insert into public.notifications(member_id, title, body, link)
  select member_id, 'تذكير ودي',
    format('عندك "%s" موعدها %s. ظروفك اتغيرت؟ تقدر تعتذر من غير خصم نقاط.', title,
           to_char(deadline at time zone 'Africa/Cairo', 'DD/MM HH24:MI')), '/'
  from rem;
  get diagnostics v_reminded = row_count;

  -- 3) تصعيد للمنسق لو المهمة عدّى موعدها ومتسلمتش
  for r in
    update public.assignments a set escalated_at = now()
    from public.tasks t
    where t.id = a.task_id and a.status in ('accepted', 'rework') and a.escalated_at is null and t.deadline < now()
    returning t.unit_id, t.title
  loop
    perform public.notify_unit_staff(r.unit_id, 'مهمة متأخرة', r.title, '/admin/tasks');
    v_escalated := v_escalated + 1;
  end loop;

  -- 4) حالة النشاط: نشط ≤ 10 أيام، بيقل 10–21، خامل > 21
  update public.profiles set activity_status = 'slowing'
   where activity_status = 'active' and last_active_at < now() - interval '10 days';
  for r in
    with d as (
      update public.profiles set activity_status = 'dormant'
      where activity_status in ('active', 'slowing') and last_active_at < now() - interval '21 days'
      returning unit_id
    ) select unit_id, count(*) as n from d where unit_id is not null group by unit_id
  loop
    perform public.notify_unit_staff(r.unit_id, 'أعضاء بقوا خاملين',
      format('%s عضو ما شاركوش من 3 أسابيع — ابعتلهم فرصة قصيرة أو كلمة سؤال', r.n), '/admin/members');
    v_dormant := v_dormant + r.n;
  end loop;

  -- 5) رسالة إعادة تنشيط للخاملين مرة كل أسبوعين بالكتير
  insert into public.notifications(member_id, title, body, link)
  select p.id, 'وحشتنا!', 'عندنا فرص قصيرة الأسبوع ده. تقدر تختار مهمة واحدة أو تحدّث الأيام المتاحة ليك.', '/profile'
  from public.profiles p
  where p.activity_status = 'dormant'
    and not exists (select 1 from public.notifications n where n.member_id = p.id and n.title = 'وحشتنا!'
                    and n.created_at > now() - interval '14 days');

  return jsonb_build_object('expired', v_expired, 'reminded', v_reminded,
                            'escalated', v_escalated, 'new_dormant', v_dormant);
end $$;

-- ───────────────────────── الإدارة ─────────────────────────
create function public.set_member_role(p_member uuid, p_role public.member_role, p_unit uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'للأدمن فقط'; end if;
  if p_member = auth.uid() and p_role <> 'admin' then raise exception 'مينفعش تشيل الأدمن من نفسك'; end if;
  update public.profiles set role = p_role, unit_id = p_unit where id = p_member;
end $$;

-- سحب الموافقة أو منحها (العضو)
create function public.set_consent(p_purpose text, p_granted boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_purpose not in ('membership_processing', 'public_recognition', 'whatsapp_optin') then
    raise exception 'غرض غير معروف';
  end if;
  insert into public.consents(member_id, purpose, granted, text_version)
  values (auth.uid(), p_purpose, p_granted, 'v1');
  insert into public.audit_log(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'consent.changed', 'consent', auth.uid()::text,
          jsonb_build_object('purpose', p_purpose, 'granted', p_granted));
end $$;

-- تصدير بيانات العضو بالكامل (حق الوصول)
create function public.export_my_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where id = auth.uid()),
    'consents', (select coalesce(jsonb_agg(c order by c.recorded_at), '[]') from public.consents c where member_id = auth.uid()),
    'assignments', (select coalesce(jsonb_agg(a), '[]') from public.assignments a where member_id = auth.uid()),
    'attendance', (select coalesce(jsonb_agg(t), '[]') from public.attendance t where member_id = auth.uid()),
    'points', (select coalesce(jsonb_agg(l order by l.created_at), '[]') from public.point_ledger l where member_id = auth.uid())
  )
$$;

-- ───────────────────────── الصلاحيات على الدوال ─────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.my_role(), public.my_unit(), public.is_admin(), public.is_staff(),
  public.in_my_scope(uuid), public.is_my_unit_or_above(uuid), public.member_in_scope(uuid),
  public.task_in_scope(uuid), public.has_assignment(uuid), public.level_for(int),
  public.distribute_task(uuid),
  public.accept_assignment(uuid), public.decline_assignment(uuid), public.withdraw_assignment(uuid),
  public.submit_assignment(uuid, text, text, double precision, double precision),
  public.review_assignment(uuid, boolean, text), public.reverse_points(bigint, text),
  public.event_qr_token(uuid), public.check_in(uuid, text, double precision, double precision),
  public.manual_check_in(uuid, uuid),
  public.scope_root(), public.unit_kpis(uuid), public.weekly_activity(uuid, int), public.my_standing(),
  public.recognition_candidates(uuid), public.set_member_role(uuid, public.member_role, uuid),
  public.set_consent(text, boolean), public.export_my_data()
to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;
