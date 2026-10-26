-- صلاحيات الأمين المساعد: يشتغل على المهام والمراجعة والفعاليات ويشوف الأعضاء،
-- لكن نقل الأعضاء وتغيير حالتهم وإضافة وحدات للأمين بس
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('assistant', 'coordinator', 'admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('coordinator', 'admin') from public.profiles where id = auth.uid()), false)
$$;
revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'تغيير الدور للأدمن فقط';
  end if;
  if (new.unit_id is distinct from old.unit_id or new.activity_status is distinct from old.activity_status)
     and not (public.is_manager() and public.in_my_scope(old.unit_id) and (new.unit_id is null or public.in_my_scope(new.unit_id))) then
    raise exception 'تغيير الوحدة أو الحالة للأمين المسؤول فقط';
  end if;
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'حقول غير قابلة للتعديل';
  end if;
  if (new.role, new.unit_id, new.activity_status) is distinct from (old.role, old.unit_id, old.activity_status) then
    insert into public.audit_log(actor_id, action, entity, entity_id, data)
    values (auth.uid(), 'profile.admin_update', 'profile', new.id::text,
      jsonb_build_object('role', jsonb_build_array(old.role, new.role),
                         'unit_id', jsonb_build_array(old.unit_id, new.unit_id),
                         'status', jsonb_build_array(old.activity_status, new.activity_status)));
  end if;
  return new;
end $$;

alter policy units_insert on public.units
  with check (public.is_admin() or (public.is_manager() and parent_id is not null and public.in_my_scope(parent_id)));

create or replace function public.notify_unit_staff(p_unit uuid, p_title text, p_body text, p_link text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.notifications(member_id, title, body, link)
  select p.id, p_title, p_body, p_link
  from public.profiles p
  join public.unit_closure uc on uc.ancestor_id = p.unit_id and uc.descendant_id = p_unit
  where p.role in ('coordinator', 'assistant');
  get diagnostics n = row_count;
  if n = 0 then
    insert into public.notifications(member_id, title, body, link)
    select id, p_title, p_body, p_link from public.profiles where role = 'admin';
  end if;
end $$;

-- ───────────────────────── تنظيم الديمو (منفصل عن التنظيم الحقيقي) ─────────────────────────
alter table public.units add column if not exists is_demo boolean not null default false;

create or replace function public.scope_root() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin()
    then coalesce((select id from public.units where parent_id is null and not is_demo order by created_at limit 1), public.my_unit())
    else public.my_unit() end
$$;

-- بيمسح الديمو القديم ويبني واحد جديد: 3 محافظات، 9 مراكز، 60 عضو، 8 أسابيع نشاط
-- حسابات الدخول (كلمة السر Demo@2026):
--   amin@demo.hzb.app       أمين التنظيم (المستوى المركزي للديمو)
--   assistant@demo.hzb.app  أمين مساعد (محافظة القاهرة)
--   member@demo.hzb.app     عضو (مدينة نصر)
create or replace function public.seed_demo() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pw text := extensions.crypt('Demo@2026', extensions.gen_salt('bf'));
  v_root uuid; v_gov uuid; v_cairo uuid; v_nasr uuid; v_c uuid;
  v_amin uuid := gen_random_uuid(); v_asst uuid := gen_random_uuid(); v_me uuid := gen_random_uuid();
  v_id uuid; v_task uuid; v_ev uuid; v_asg uuid;
  g record; c record; m record;
  v_centers uuid[] := '{}';
  v_first text[] := array['محمد','أحمد','محمود','مصطفى','عمر','يوسف','كريم','خالد','حسن','إبراهيم','علي','طارق',
                          'مريم','نور','ياسمين','سلمى','آية','فاطمة','هبة','دينا','رنا','منة','سارة','شيماء'];
  v_last text[] := array['عبد الله','السيد','عبد العزيز','فؤاد','الشربيني','حمدي','زكي','منصور','عثمان','رشاد',
                         'سليمان','النجار','عبد الحميد','الشافعي','بدوي','قاسم','هلال','جاد','الصاوي','شاهين'];
  v_skills text[] := array['تصوير','تصميم','كتابة محتوى','إدارة صفحات','تنظيم فعاليات','خطابة',
                           'تواصل ميداني','إدخال بيانات','قانون','طب وإسعافات','تدريس','قيادة فرق'];
  v_mot text[] := array['values','understanding','social','career','enhancement'];
  v_tasks jsonb := '[
    {"t":"تقرير ميداني أسبوعي عن احتياجات المنطقة","c":"field_report","s":"small"},
    {"t":"طرق أبواب للتعريف بأنشطة الأمانة","c":"door_to_door","s":"medium"},
    {"t":"نشر إعلان القافلة الطبية في الجروبات","c":"outreach","s":"small"},
    {"t":"يوم خدمة مجتمعية — تجميل مدخل الحي","c":"community_service","s":"large"},
    {"t":"ضم أعضاء جدد من شباب الجامعة","c":"recruitment","s":"medium"},
    {"t":"تنظيم واستقبال في ندوة التوعية","c":"event_support","s":"medium"},
    {"t":"حضور ورشة إعداد الكوادر","c":"training","s":"small"},
    {"t":"تصميم بوست تكريم المتفوقين","c":"media","s":"small"}
  ]';
  v_reports text[] := array[
    'زرت المدرسة والوحدة الصحية. أهم الاحتياجات: صيانة دورات المياه، نقص أدوية الضغط، وإنارة الشارع الخلفي.',
    'عدّيت على 15 بيت، 11 فتحوا. أغلب الأسئلة كانت عن مواعيد القافلة وشروط الكشف.',
    'نشرت الإعلان في 4 جروبات للحي وجروب أولياء الأمور، وجالي 23 استفسار.',
    'شاركنا 12 متطوع، دهنّا السور وزرعنا 30 شجرة. الصور مرفقة.',
    'سجّلت 3 أعضاء جداد من كلية التجارة وبعتلهم لينك التسجيل.',
    'استقبلنا 85 حاضر ونظمنا الدخول والكراسي، والندوة خلصت في ميعادها.'];
  v_status text; v_last_active timestamptz; v_k int; v_dl timestamptz; v_pts int; v_n int := 0;
begin
  -- ── تنظيف الديمو القديم ──
  delete from public.tasks where unit_id in (select id from public.units where is_demo);
  delete from public.events where unit_id in (select id from public.units where is_demo);
  alter table public.point_ledger disable trigger point_ledger_no_update;
  delete from auth.users where email like '%@demo.hzb.app';
  alter table public.point_ledger enable trigger point_ledger_no_update;
  delete from public.units where is_demo and type = 'unit';
  delete from public.units where is_demo and type = 'center';
  delete from public.units where is_demo and type = 'governorate';
  delete from public.units where is_demo;
  perform setseed(0.42);

  -- ── الهيكل ──
  insert into public.units(name, type, is_demo) values ('حزب تجريبي — الأمانة المركزية', 'national', true) returning id into v_root;
  for g in select key as gov, value as centers from jsonb_each('{
      "القاهرة": ["مدينة نصر","مصر الجديدة","شبرا","المعادي"],
      "الجيزة": ["الدقي","الهرم","6 أكتوبر"],
      "الإسكندرية": ["سيدي جابر","المنتزه"]}'::jsonb) loop
    insert into public.units(name, type, parent_id, is_demo) values (g.gov, 'governorate', v_root, true) returning id into v_gov;
    if g.gov = 'القاهرة' then v_cairo := v_gov; end if;
    for c in select value #>> '{}' as name from jsonb_array_elements(g.centers) loop
      insert into public.units(name, type, parent_id, is_demo) values (c.name, 'center', v_gov, true) returning id into v_c;
      v_centers := v_centers || v_c;
      if c.name = 'مدينة نصر' then v_nasr := v_c; end if;
    end loop;
  end loop;

  -- ── حسابات الدخول الثلاثة ──
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                         confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_amin, 'authenticated', 'authenticated', 'amin@demo.hzb.app', v_pw, now(),
     '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'محمود عبد الرحمن', 'phone', '01000000001',
     'consent_membership', 'true', 'consent_recognition', 'true'), now() - interval '200 days', now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_asst, 'authenticated', 'authenticated', 'assistant@demo.hzb.app', v_pw, now(),
     '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'سارة حسن', 'phone', '01000000002',
     'consent_membership', 'true', 'consent_recognition', 'true'), now() - interval '150 days', now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_me, 'authenticated', 'authenticated', 'member@demo.hzb.app', v_pw, now(),
     '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'أحمد مصطفى', 'phone', '01000000003',
     'consent_membership', 'true', 'consent_recognition', 'true',
     'skills', jsonb_build_array('تصوير', 'تواصل ميداني', 'كتابة محتوى'),
     'motivations', jsonb_build_array('values', 'career', 'social'),
     'available_days', jsonb_build_array('0', '1', '2', '3', '4', '5', '6'), 'weekly_hours', '6'),
     now() - interval '90 days', now(), '', '', '', '');
  insert into auth.identities(provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u where u.id in (v_amin, v_asst, v_me);

  update public.profiles set role = 'coordinator', unit_id = v_root, created_at = now() - interval '200 days' where id = v_amin;
  update public.profiles set role = 'assistant', unit_id = v_cairo, created_at = now() - interval '150 days' where id = v_asst;
  update public.profiles set role = 'member', unit_id = v_nasr, created_at = now() - interval '90 days' where id = v_me;

  -- ── 60 عضو تجريبي (مش بيقدروا يدخلوا) ──
  for i in 1..60 loop
    v_id := gen_random_uuid();
    v_k := (i * 37) % 100;
    v_status := case when v_k < 55 then 'active' when v_k < 75 then 'slowing' else 'dormant' end;
    v_last_active := now() - case v_status
      when 'active' then make_interval(days => (i % 9))
      when 'slowing' then make_interval(days => 11 + (i % 9))
      else make_interval(days => 23 + (i % 28)) end;
    insert into auth.users(instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                           created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'm' || i || '@demo.hzb.app', now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'full_name', v_first[1 + (i % array_length(v_first, 1))] || ' ' || v_last[1 + ((i * 7) % array_length(v_last, 1))],
        'phone', '010' || lpad((10000000 + i * 7919)::text, 8, '0'),
        'consent_membership', 'true', 'consent_recognition', (i % 5 <> 0)::text,
        'skills', jsonb_build_array(v_skills[1 + (i % 12)], v_skills[1 + ((i * 5) % 12)]),
        'motivations', jsonb_build_array(v_mot[1 + (i % 5)], v_mot[1 + ((i * 3) % 5)]),
        'available_days', jsonb_build_array((i % 7)::text, ((i + 2) % 7)::text, ((i + 4) % 7)::text),
        'weekly_hours', (2 + i % 6)::text),
      now() - make_interval(days => 60 + i), now(), '', '', '', '');
    update public.profiles set
      unit_id = v_centers[1 + (i % array_length(v_centers, 1))],
      activity_status = v_status::public.activity_status,
      last_active_at = v_last_active,
      created_at = now() - make_interval(days => 60 + i)
    where id = v_id;
  end loop;

  -- ── 8 أسابيع تاريخ: مهمة كل أسبوع لكل مركز + اجتماع كل أسبوعين لكل محافظة ──
  for w in 1..8 loop
    for c in select u.id, u.name, u.parent_id from public.units u where u.id = any(v_centers) loop
      v_dl := date_trunc('day', now()) - make_interval(weeks => w - 1, days => 1) + interval '20 hours';
      insert into public.tasks(title, category, size, unit_id, capacity, deadline, status, created_by, created_at)
      values ((v_tasks -> ((w - 1) % 8)) ->> 't' || ' — ' || c.name,
              ((v_tasks -> ((w - 1) % 8)) ->> 'c')::public.task_category,
              ((v_tasks -> ((w - 1) % 8)) ->> 's')::public.task_size,
              c.id, 4, v_dl, 'closed', v_asst, v_dl - interval '6 days')
      returning id, base_points into v_task, v_pts;

      for m in
        select p.id, random() as r from public.profiles p
        where p.unit_id = c.id and p.role = 'member' and p.last_active_at >= v_dl - interval '3 days'
        order by (p.id = v_me) desc, random() limit 6
      loop
        if m.id = v_me or m.r < 0.55 then
          insert into public.assignments(task_id, member_id, status, match_score, match_reason, offered_at, offer_expires_at,
                                         accepted_at, submitted_at, reviewed_at, reviewed_by, report, feedback)
          values (v_task, m.id, 'approved', round((0.6 + random() * 0.35)::numeric, 3), 'متاح في أيام قبل الموعد',
                  v_dl - interval '6 days', v_dl - interval '5 days', v_dl - interval '5 days', v_dl - interval '1 day',
                  v_dl - interval '12 hours', v_asst, v_reports[1 + ((w + v_n) % 6)],
                  (array['شغل ممتاز، شكراً!', 'تقرير واضح ومفيد', null, 'برافو عليك'])[1 + (v_n % 4)])
          returning id into v_asg;
          insert into public.point_ledger(member_id, amount, reason_code, source_type, source_id, idempotency_key, created_by, note, created_at)
          values (m.id, round(v_pts * 1.1), 'task.approved', 'assignment', v_asg::text, 'assignment:' || v_asg, v_asst,
                  (v_tasks -> ((w - 1) % 8)) ->> 't', v_dl - interval '12 hours');
        elsif m.r < 0.8 then
          insert into public.assignments(task_id, member_id, status, offered_at, offer_expires_at)
          values (v_task, m.id, 'declined', v_dl - interval '6 days', v_dl - interval '5 days');
        else
          insert into public.assignments(task_id, member_id, status, offered_at, offer_expires_at)
          values (v_task, m.id, 'expired', v_dl - interval '6 days', v_dl - interval '5 days');
        end if;
        v_n := v_n + 1;
      end loop;
    end loop;

    if w % 2 = 0 then
      for g in select u.id, u.name from public.units u where u.parent_id = v_root loop
        v_dl := date_trunc('day', now()) - make_interval(weeks => w - 1, days => 2) + interval '17 hours';
        insert into public.events(title, unit_id, starts_at, ends_at, points, created_by, created_at)
        values ('اجتماع أمانة ' || g.name || ' الدوري', g.id, v_dl, v_dl + interval '2 hours', 10, v_asst, v_dl - interval '5 days')
        returning id into v_ev;
        insert into public.attendance(event_id, member_id, method, checked_in_at, distance_m)
        select v_ev, p.id, 'qr', v_dl + make_interval(mins => (random() * 25)::int), (20 + random() * 150)::int
        from public.profiles p join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = g.id
        where p.role = 'member' and p.last_active_at >= v_dl and (p.id = v_me or random() < 0.6);
        insert into public.point_ledger(member_id, amount, reason_code, source_type, source_id, idempotency_key, note, created_at)
        select a.member_id, 10, 'event.attended', 'attendance', v_ev::text, 'attendance:' || v_ev || ':' || a.member_id,
               'اجتماع أمانة ' || g.name || ' الدوري', a.checked_in_at
        from public.attendance a where a.event_id = v_ev;
      end loop;
    end if;
  end loop;

  -- ── الوضع الحالي ──
  -- فعالية شغالة دلوقتي (عشان عرض الـ QR)
  insert into public.events(title, description, unit_id, starts_at, ends_at, points, created_by)
  values ('ملتقى شباب القاهرة الشهري', 'لقاء مفتوح مع أمين المحافظة', v_cairo, now() - interval '1 hour', now() + interval '23 hours', 15, v_asst)
  returning id into v_ev;
  insert into public.attendance(event_id, member_id, method, checked_in_at, distance_m)
  select v_ev, p.id, 'qr', now() - make_interval(mins => (random() * 50)::int), (10 + random() * 120)::int
  from public.profiles p join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_cairo
  where p.role = 'member' and p.activity_status = 'active' and p.id <> v_me and random() < 0.5;
  insert into public.point_ledger(member_id, amount, reason_code, source_type, source_id, idempotency_key, note, created_at)
  select a.member_id, 15, 'event.attended', 'attendance', v_ev::text, 'attendance:' || v_ev || ':' || a.member_id,
         'ملتقى شباب القاهرة الشهري', a.checked_in_at
  from public.attendance a where a.event_id = v_ev;

  -- مهمة العضو قيد التنفيذ
  insert into public.tasks(title, description, category, size, unit_id, capacity, deadline, created_by)
  values ('طرق أبواب — شارع مصطفى النحاس', 'زور 15 بيت وعرّفهم بالقافلة الطبية يوم الجمعة، وسجّل أهم الأسئلة.',
          'door_to_door', 'medium', v_nasr, 3, now() + interval '30 hours', v_asst) returning id into v_task;
  insert into public.assignments(task_id, member_id, status, match_score, match_reason, offered_at, offer_expires_at, accepted_at)
  values (v_task, v_me, 'accepted', 0.91, 'متاح في أيام قبل الموعد • المهمة مناسبة لاهتماماتك',
          now() - interval '2 days', now() - interval '1 day', now() - interval '40 hours');

  -- عروض جديدة للعضو
  insert into public.tasks(title, description, category, size, unit_id, required_skills, capacity, deadline, requires_photo, created_by)
  values ('تصوير يوم الخدمة المجتمعية', 'تصوير الفعالية من البداية للنهاية ورفع 10 صور مختارة.',
          'media', 'medium', v_cairo, '{تصوير}', 2, now() + interval '4 days', true, v_asst) returning id into v_task;
  insert into public.assignments(task_id, member_id, status, match_score, match_reason, offered_at, offer_expires_at)
  values (v_task, v_me, 'offered', 0.955,
          'عندك كل المهارات المطلوبة • متاح في أيام قبل الموعد • سجل التزامك ممتاز', now() - interval '1 hour', now() + interval '23 hours');
  perform public._distribute(v_task, 2);

  insert into public.tasks(title, description, category, size, unit_id, capacity, deadline, created_by)
  values ('توزيع دعوات ملتقى الشباب — مدينة نصر', 'توزيع 50 دعوة على مراكز الشباب والكافيهات في المنطقة.',
          'outreach', 'small', v_nasr, 4, now() + interval '3 days', v_asst) returning id into v_task;
  insert into public.assignments(task_id, member_id, status, match_score, match_reason, offered_at, offer_expires_at)
  values (v_task, v_me, 'offered', 0.87,
          'متاح في أيام قبل الموعد • المهمة مناسبة لاهتماماتك', now() - interval '3 hours', now() + interval '21 hours');
  perform public._distribute(v_task, null);

  -- تقارير مستنية مراجعة الأمين المساعد
  insert into public.tasks(title, description, category, size, unit_id, capacity, deadline, created_by)
  values ('تقرير احتياجات المنطقة — أكتوبر', 'زور مكانين واكتب أهم 3 احتياجات.', 'field_report', 'small', v_cairo, 5,
          now() + interval '2 days', v_asst) returning id into v_task;
  insert into public.assignments(task_id, member_id, status, match_score, match_reason, offered_at, offer_expires_at,
                                 accepted_at, submitted_at, report)
  select v_task, p.id, 'submitted', 0.8, 'متاح في أيام قبل الموعد', now() - interval '3 days', now() - interval '2 days',
         now() - interval '2 days', now() - make_interval(hours => (row_number() over ())::int * 3),
         v_reports[1 + ((row_number() over ())::int % 6)]
  from (select p.id from public.profiles p join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_cairo
        where p.role = 'member' and p.activity_status = 'active' and p.id <> v_me order by p.full_name limit 4) p;

  -- مهمة متأخرة (عشان التصعيد يبان)
  insert into public.tasks(title, category, size, unit_id, capacity, deadline, created_by)
  values ('حصر مراكز الشباب في الهرم', 'field_report', 'medium',
          (select id from public.units where name = 'الهرم' and is_demo), 2, now() - interval '1 day', v_asst) returning id into v_task;
  insert into public.assignments(task_id, member_id, status, offered_at, offer_expires_at, accepted_at)
  select v_task, p.id, 'accepted', now() - interval '5 days', now() - interval '4 days', now() - interval '4 days'
  from public.profiles p where p.unit_id = (select id from public.units where name = 'الهرم' and is_demo)
    and p.role = 'member' and p.activity_status <> 'dormant' limit 1;

  -- آخر نشاط للحسابات الثلاثة
  update public.profiles set last_active_at = now() - interval '1 day', activity_status = 'active' where id in (v_amin, v_asst, v_me);

  -- إشعارات
  insert into public.notifications(member_id, title, body, link, created_at) values
    (v_me, 'مهمة جديدة مناسبة ليك', 'تصوير يوم الخدمة المجتمعية', '/', now() - interval '1 hour'),
    (v_me, 'تذكير ودي', 'عندك "طرق أبواب — شارع مصطفى النحاس" بكرة. ظروفك اتغيرت؟ تقدر تعتذر من غير خصم نقاط.', '/', now() - interval '2 hours'),
    (v_me, 'شكراً! المهمة اتعتمدت', 'تقرير ميداني أسبوعي — اتضافلك 11 نقطة' || E'\n' || 'ملاحظة الفريق: شغل ممتاز، شكراً!', '/', now() - interval '1 day'),
    (v_asst, 'تقرير جديد مستني مراجعة', 'تقرير احتياجات المنطقة — أكتوبر', '/admin/review', now() - interval '3 hours'),
    (v_asst, 'أعضاء بقوا خاملين', '4 أعضاء في شبرا ما شاركوش من 3 أسابيع — ابعتلهم فرصة قصيرة أو كلمة سؤال', '/admin/members', now() - interval '1 day'),
    (v_amin, 'مهمة متأخرة', 'حصر مراكز الشباب في الهرم', '/admin/tasks', now() - interval '20 hours'),
    (v_amin, 'أعضاء بقوا خاملين', '6 أعضاء في الإسكندرية ما شاركوش من 3 أسابيع', '/admin/members', now() - interval '1 day');

  return jsonb_build_object('members', (select count(*) from public.profiles p join public.unit_closure uc
                                        on uc.descendant_id = p.unit_id and uc.ancestor_id = v_root),
                            'tasks', (select count(*) from public.tasks t join public.unit_closure uc on uc.descendant_id = t.unit_id and uc.ancestor_id = v_root),
                            'ledger', (select count(*) from public.point_ledger l join public.profiles p on p.id = l.member_id
                                       join public.unit_closure uc on uc.descendant_id = p.unit_id and uc.ancestor_id = v_root));
end $$;
revoke execute on function public.seed_demo() from public, anon, authenticated;

-- الديمو بيرجع لحالته الأصلية كل يوم الساعة 3 الفجر بتوقيت القاهرة
select cron.schedule('hzb-demo-reset', '0 1 * * *', $$select public.seed_demo()$$);
