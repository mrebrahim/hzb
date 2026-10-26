-- منظومة قياس أداء وتحفيز التنظيم — الجداول الأساسية والصلاحيات (RLS)
-- مبادئ التصميم:
--   * أقل قدر من البيانات (لا GPS مستمر، لا تعرف على الوجه، لا "درجة ولاء")
--   * دفتر نقاط غير قابل للتعديل (append-only) بدل عمود رصيد
--   * صلاحيات حسب الدور والنطاق التنظيمي (المركزي ← المحافظة ← المركز/القسم ← الوحدة)
--   * أي تعديل جوهري يتسجل في audit_log

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── الأنواع ─────────────────────────
create type public.member_role as enum ('member', 'coordinator', 'admin');
create type public.unit_type as enum ('national', 'governorate', 'center', 'unit');
create type public.activity_status as enum ('active', 'slowing', 'dormant', 'suspended');
create type public.motivation as enum ('values', 'understanding', 'social', 'career', 'enhancement', 'protective');
create type public.task_size as enum ('small', 'medium', 'large');
create type public.task_category as enum ('field_report', 'door_to_door', 'outreach', 'community_service', 'recruitment', 'event_support', 'training', 'media', 'organizing');
create type public.task_priority as enum ('p0', 'p1', 'p2', 'p3');
create type public.task_status as enum ('draft', 'open', 'closed', 'cancelled');
create type public.assignment_status as enum ('offered', 'accepted', 'declined', 'expired', 'withdrawn', 'submitted', 'rework', 'approved', 'rejected');

-- ───────────────────────── الهيكل التنظيمي ─────────────────────────
create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.unit_type not null,
  parent_id uuid references public.units(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);
create index units_parent_idx on public.units(parent_id);

-- كل (سلف، فرع) في الشجرة، بما فيها الوحدة نفسها
create view public.unit_closure with (security_invoker = true) as
with recursive c(ancestor_id, descendant_id, depth) as (
  select id, id, 0 from public.units
  union all
  select c.ancestor_id, u.id, c.depth + 1
  from c join public.units u on u.parent_id = c.descendant_id
)
select ancestor_id, descendant_id, depth from c;

-- ───────────────────────── الأعضاء ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  unit_id uuid references public.units(id),
  role public.member_role not null default 'member',
  activity_status public.activity_status not null default 'active',
  motivations public.motivation[] not null default '{}',
  skills text[] not null default '{}',
  available_days smallint[] not null default '{}', -- 0=الأحد … 6=السبت
  weekly_hours smallint not null default 3 check (weekly_hours between 0 and 40),
  max_open_tasks smallint not null default 3 check (max_open_tasks between 1 and 10),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index profiles_unit_idx on public.profiles(unit_id);

-- الموافقة المكتوبة الإلكترونية (قانون 151 لسنة 2020) — سجل لا يُعدَّل؛ السحب = صف جديد granted=false
create table public.consents (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null, -- membership_processing | public_recognition | whatsapp_optin
  granted boolean not null,
  text_version text not null,
  recorded_at timestamptz not null default now()
);
create index consents_member_idx on public.consents(member_id, purpose, recorded_at desc);

-- ───────────────────────── المهام ─────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.task_category not null,
  size public.task_size not null default 'small',
  base_points int not null default 0 check (base_points between 0 and 200),
  priority public.task_priority not null default 'p2',
  unit_id uuid not null references public.units(id),
  required_skills text[] not null default '{}',
  capacity int not null default 1 check (capacity between 1 and 500),
  deadline timestamptz not null,
  requires_photo boolean not null default false,
  status public.task_status not null default 'open',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index tasks_unit_idx on public.tasks(unit_id, status);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status public.assignment_status not null default 'offered',
  match_score numeric(5,3),
  match_reason text,
  offered_at timestamptz not null default now(),
  offer_expires_at timestamptz,
  accepted_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  report text,
  evidence_url text,
  report_lat double precision,
  report_lng double precision,
  feedback text,
  rework_count int not null default 0,
  reminded_at timestamptz,
  escalated_at timestamptz,
  unique (task_id, member_id)
);
create index assignments_member_idx on public.assignments(member_id, status);
create index assignments_task_idx on public.assignments(task_id, status);

-- ───────────────────────── الفعاليات والحضور ─────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  unit_id uuid not null references public.units(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  lat double precision,
  lng double precision,
  radius_m int not null default 300 check (radius_m between 50 and 5000),
  points int not null default 10 check (points between 0 and 100),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index events_unit_idx on public.events(unit_id, starts_at);

-- السر اللي بيتولد منه QR المتغير — مفيش أي policy عليه، يعني محدش يقراه غير الدوال
create table public.event_secrets (
  event_id uuid primary key references public.events(id) on delete cascade,
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex')
);

create table public.attendance (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  method text not null check (method in ('qr', 'manual')),
  checked_in_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id),
  distance_m int,
  unique (event_id, member_id)
);

-- ───────────────────────── دفتر النقاط ─────────────────────────
create table public.point_ledger (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount <> 0),
  reason_code text not null,
  source_type text not null,
  source_id text,
  note text,
  idempotency_key text not null unique,
  reverses_id bigint references public.point_ledger(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index point_ledger_member_idx on public.point_ledger(member_id, created_at desc);

create function public.ledger_is_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'دفتر النقاط غير قابل للتعديل أو الحذف — استخدم حركة عكسية';
end $$;
create trigger point_ledger_no_update before update or delete on public.point_ledger
  for each row execute function public.ledger_is_append_only();

-- ───────────────────────── الإشعارات وسجل التدقيق ─────────────────────────
create table public.notifications (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_member_idx on public.notifications(member_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.ledger_is_append_only();

-- ───────────────────────── دوال الصلاحيات ─────────────────────────
create function public.my_role() returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.my_unit() returns uuid
language sql stable security definer set search_path = '' as $$
  select unit_id from public.profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('coordinator', 'admin') from public.profiles where id = auth.uid()), false)
$$;

-- هل الوحدة دي داخل نطاق إدارتي؟ (الأدمن: كل شيء، المنسق: وحدته وكل اللي تحتها)
create function public.in_my_scope(p_unit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when public.is_admin() then true
    when public.is_staff() then exists (
      select 1 from public.unit_closure
      where ancestor_id = public.my_unit() and descendant_id = p_unit)
    else false
  end
$$;

-- هل الوحدة دي وحدتي أو فوقها؟ (عشان العضو يشوف فعاليات وحدته والمستويات الأعلى)
create function public.is_my_unit_or_above(p_unit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.unit_closure
    where ancestor_id = p_unit and descendant_id = public.my_unit())
$$;

create function public.member_in_scope(p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.in_my_scope((select unit_id from public.profiles where id = p_member))
$$;

create function public.task_in_scope(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.in_my_scope((select unit_id from public.tasks where id = p_task))
$$;

create function public.has_assignment(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.assignments where task_id = p_task and member_id = auth.uid())
$$;

-- ───────────────────────── حماية حقول العضو ─────────────────────────
-- العضو يعدّل بياناته الشخصية بس؛ الدور والحالة والوحدة للمنسق/الأدمن
create function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if; -- عمليات النظام
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'تغيير الدور للأدمن فقط';
  end if;
  if (new.unit_id is distinct from old.unit_id or new.activity_status is distinct from old.activity_status)
     and not (public.is_staff() and public.in_my_scope(old.unit_id) and (new.unit_id is null or public.in_my_scope(new.unit_id))) then
    raise exception 'تغيير الوحدة أو الحالة للمنسق المسؤول فقط';
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
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- إنشاء ملف العضو + تسجيل الموافقة عند التسجيل
-- أول مستخدم يسجل في النظام بيبقى أدمن (bootstrap)، وبعد كده الكل أعضاء
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_unit uuid;
  v_role public.member_role := 'member';
begin
  begin v_unit := nullif(m->>'unit_id', '')::uuid; exception when others then v_unit := null; end;
  if v_unit is not null and not exists (select 1 from public.units where id = v_unit) then v_unit := null; end if;
  if not exists (select 1 from public.profiles where role = 'admin') then v_role := 'admin'; end if;

  insert into public.profiles(id, full_name, phone, unit_id, role, motivations, skills, available_days, weekly_hours)
  values (
    new.id,
    coalesce(nullif(m->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(m->>'phone', ''),
    v_unit,
    v_role,
    coalesce((select array_agg(x::public.motivation) from jsonb_array_elements_text(m->'motivations') x
              where x in ('values','understanding','social','career','enhancement','protective')), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(m->'skills') x), '{}'),
    coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(m->'available_days') x
              where x ~ '^[0-6]$'), '{}'),
    case when m->>'weekly_hours' ~ '^\d{1,2}$' then least((m->>'weekly_hours')::int, 40) else 3 end
  );

  if (m->>'consent_membership') = 'true' then
    insert into public.consents(member_id, purpose, granted, text_version)
    values (new.id, 'membership_processing', true, coalesce(m->>'consent_version', 'v1'));
  end if;
  if (m->>'consent_recognition') = 'true' then
    insert into public.consents(member_id, purpose, granted, text_version)
    values (new.id, 'public_recognition', true, coalesce(m->>'consent_version', 'v1'));
  end if;

  insert into public.audit_log(actor_id, action, entity, entity_id, data)
  values (new.id, 'member.registered', 'profile', new.id::text, jsonb_build_object('role', v_role));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── تفعيل RLS ─────────────────────────
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.tasks enable row level security;
alter table public.assignments enable row level security;
alter table public.events enable row level security;
alter table public.event_secrets enable row level security;
alter table public.attendance enable row level security;
alter table public.point_ledger enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- الوحدات: أي عضو مسجل يشوف الهيكل (لازم للتسجيل والفلترة)
create policy units_select on public.units for select to authenticated using (true);
create policy units_insert on public.units for insert to authenticated
  with check (public.is_admin() or (public.is_staff() and parent_id is not null and public.in_my_scope(parent_id)));
create policy units_update on public.units for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- الأعضاء
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.in_my_scope(unit_id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.in_my_scope(unit_id))
  with check (id = (select auth.uid()) or public.in_my_scope(unit_id));

-- الموافقات
create policy consents_select on public.consents for select to authenticated
  using (member_id = (select auth.uid()) or public.is_admin());
create policy consents_insert on public.consents for insert to authenticated
  with check (member_id = (select auth.uid()));

-- المهام
create policy tasks_select on public.tasks for select to authenticated
  using (public.in_my_scope(unit_id) or public.has_assignment(id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_staff() and public.in_my_scope(unit_id) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (public.in_my_scope(unit_id)) with check (public.in_my_scope(unit_id));

-- الإسنادات: القراءة فقط؛ كل التغييرات من خلال الدوال
create policy assignments_select on public.assignments for select to authenticated
  using (member_id = (select auth.uid()) or public.task_in_scope(task_id));

-- الفعاليات
create policy events_select on public.events for select to authenticated
  using (public.in_my_scope(unit_id) or public.is_my_unit_or_above(unit_id));
create policy events_insert on public.events for insert to authenticated
  with check (public.is_staff() and public.in_my_scope(unit_id) and created_by = (select auth.uid()));
create policy events_update on public.events for update to authenticated
  using (public.in_my_scope(unit_id)) with check (public.in_my_scope(unit_id));

-- الحضور والنقاط: قراءة فقط
create policy attendance_select on public.attendance for select to authenticated
  using (member_id = (select auth.uid()) or public.member_in_scope(member_id));
create policy ledger_select on public.point_ledger for select to authenticated
  using (member_id = (select auth.uid()) or public.member_in_scope(member_id));

-- الإشعارات
create policy notifications_select on public.notifications for select to authenticated
  using (member_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

-- سجل التدقيق: الأدمن بس
create policy audit_select on public.audit_log for select to authenticated using (public.is_admin());

-- إنشاء سر الفعالية تلقائياً
create function public.create_event_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_secrets(event_id) values (new.id);
  return new;
end $$;
create trigger events_secret after insert on public.events
  for each row execute function public.create_event_secret();

-- نقاط المهمة الافتراضية حسب الحجم
create function public.task_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.base_points = 0 then
    new.base_points := case new.size when 'small' then 10 when 'medium' then 25 else 50 end;
  end if;
  return new;
end $$;
create trigger tasks_defaults before insert on public.tasks
  for each row execute function public.task_defaults();
