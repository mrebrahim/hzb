-- الموقع عند تسليم التكليف: التكليف ممكن يشترط تحديد الموقع، وبنسجّل دقة القراءة
alter table public.tasks add column if not exists requires_location boolean not null default false;
alter table public.assignments add column if not exists report_accuracy_m int;

create or replace function public.submit_report(p_id uuid, p_report text, p_evidence_url text default null,
                                                p_lat double precision default null, p_lng double precision default null,
                                                p_accuracy int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.assignments; t public.tasks;
begin
  select * into a from public.assignments where id = p_id and member_id = auth.uid();
  if not found or a.status not in ('accepted', 'rework') then raise exception 'لا يمكن تسليم هذا التكليف'; end if;
  select * into t from public.tasks where id = a.task_id;
  if t.requires_photo and coalesce(p_evidence_url, '') = '' then raise exception 'هذا التكليف يتطلب صورة إثبات'; end if;
  if t.requires_location and (p_lat is null or p_lng is null) then raise exception 'هذا التكليف يتطلب تحديد موقعك عند التسليم'; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then raise exception 'إحداثيات غير صالحة'; end if;
  if length(coalesce(p_report, '')) < 5 then raise exception 'اكتب تقريراً مختصراً عما أنجزته'; end if;
  update public.assignments set status = 'submitted', submitted_at = now(), report = p_report,
    evidence_url = nullif(p_evidence_url, ''), report_lat = p_lat, report_lng = p_lng,
    report_accuracy_m = case when p_lat is null then null else least(greatest(p_accuracy, 0), 100000) end
   where id = p_id;
  perform public.touch_member(auth.uid());
  perform public.notify_unit_staff(t.unit_id, 'تقرير جديد بانتظار المراجعة', t.title, '/admin/review');
end $$;

revoke execute on function public.submit_report(uuid, text, text, double precision, double precision, int) from public, anon;
grant execute on function public.submit_report(uuid, text, text, double precision, double precision, int) to authenticated;
