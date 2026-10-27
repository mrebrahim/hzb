import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DirectAssign } from '@/components/DirectAssign';
import { Icon } from '@/components/Icon';
import { MemberRoleForm } from '@/components/MemberRoleForm';
import { NoticeForm } from '@/components/NoticeForm';
import { requireStaff } from '@/lib/auth';
import { ACTIVITY_STATUS, ASSIGNMENT_STATUS, CATEGORIES, LEVELS, ROLES, fmtDate, pct, rating } from '@/lib/labels';
import { getScopeUnits } from '@/lib/units';

type Perf = {
  points_30: number; points_prev_30: number; total_points: number; offers: number; accepted: number; declined: number;
  expired: number; withdrawn: number; approved: number; rejected: number; first_pass: number; on_time: number; overdue: number;
  avg_response_hours: number | null; attendance_30: number; attendance_total: number; events_in_scope_30: number;
  reliability: number; streak_weeks: number; weekly: { week: string; points: number }[];
  by_category: Record<string, number> | null; consent_recognition: boolean;
};
type A = { id: string; status: string; offered_at: string; accepted_at: string | null; submitted_at: string | null;
           reviewed_at: string | null; feedback: string | null; rework_count: number; match_reason: string | null;
           tasks: { title: string; category: keyof typeof CATEGORIES; deadline: string; base_points: number } | null };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile: me } = await requireStaff();
  const { data: m } = await supabase.from('profiles').select('*, units(name)').eq('id', id)
    .single<{ id: string; full_name: string; phone: string | null; role: keyof typeof ROLES; unit_id: string | null;
              activity_status: string; skills: string[]; motivations: string[]; available_days: number[]; weekly_hours: number;
              last_active_at: string; created_at: string; units: { name: string } | null }>();
  if (!m) notFound();
  const [{ data: perfData, error }, { data: asg }, { data: att }, { data: ledger }, units] = await Promise.all([
    supabase.rpc('member_performance', { p_member: id }),
    supabase.from('assignments')
      .select('id,status,offered_at,accepted_at,submitted_at,reviewed_at,feedback,rework_count,match_reason,tasks(title,category,deadline,base_points)')
      .eq('member_id', id).order('offered_at', { ascending: false }).limit(30).returns<A[]>(),
    supabase.from('attendance').select('id,checked_in_at,method,events(title)').eq('member_id', id)
      .order('checked_in_at', { ascending: false }).limit(10).returns<{ id: number; checked_in_at: string; method: string; events: { title: string } | null }[]>(),
    supabase.from('point_ledger').select('id,amount,note,created_at').eq('member_id', id).order('created_at', { ascending: false }).limit(10),
    getScopeUnits(supabase),
  ]);
  if (error) return <p className="card text-red-700">{error.message}</p>;
  const p = perfData as Perf;
  const now = Date.now();
  const rt = rating(p.points_30);
  const commit = Math.round(p.reliability * 100);
  const lvl = [...LEVELS].reverse().find((l) => p.total_points >= l.floor)!;
  const maxW = Math.max(1, ...p.weekly.map((w) => w.points));
  const open = (asg ?? []).filter((a) => ['offered', 'accepted', 'rework', 'submitted'].includes(a.status));
  const history = (asg ?? []).filter((a) => !['offered', 'accepted', 'rework', 'submitted'].includes(a.status));
  const canManage = me.role !== 'assistant';

  const kpis = [
    ['التقييم الشهري', <span key="r" className={`chip text-sm ${rt.cls}`}>{rt.label}</span>, `${p.points_30} نقطة (السابق ${p.points_prev_30})`],
    ['نسبة الالتزام', `${commit}%`, commit < 70 ? 'أقل من الحد المقبول' : 'من التكليفات المقبولة'],
    ['الالتزام بالمواعيد', p.approved ? `${pct(p.on_time, p.approved)}%` : '—', `${p.on_time} من ${p.approved} في موعدها`],
    ['الجودة من أول مراجعة', p.approved ? `${pct(p.first_pass, p.approved)}%` : '—', 'بدون طلب استكمال'],
    ['نسبة قبول التكليفات', p.offers ? `${pct(p.accepted, p.offers)}%` : '—', `${p.accepted} من ${p.offers} معروض`],
    ['نسبة الحضور', p.events_in_scope_30 ? `${pct(p.attendance_30, p.events_in_scope_30)}%` : '—', `${p.attendance_30} من ${p.events_in_scope_30} فعالية (30 يوم)`],
    ['متوسط زمن الرد', p.avg_response_hours != null ? `${p.avg_response_hours} ساعة` : '—', 'من العرض حتى القبول'],
    ['الانتظام', `${p.streak_weeks} أسبوع`, 'متتالٍ بنشاط'],
  ] as const;

  return (
    <div className="space-y-4">
      <Link href="/admin/members" className="text-xs text-navy-600">← قائمة الأعضاء</Link>

      <section className="overflow-hidden rounded-lg bg-navy-800 text-white">
        <div className="border-b border-white/10 px-5 py-2 text-xs text-navy-100">ملف الأداء التنظيمي</div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="text-2xl font-bold">{m.full_name}</h1>
            <p className="mt-1 text-sm text-navy-100">{ROLES[m.role]} • {m.units?.name ?? 'بدون وحدة'} • المستوى: <b className="text-gold-400">{lvl.name}</b></p>
            <p className="mt-1 text-xs text-navy-200"><span dir="ltr">{m.phone}</span> • عضو منذ {fmtDate(m.created_at)} • آخر نشاط {fmtDate(m.last_active_at)}</p>
          </div>
          <div className="flex items-center gap-4 text-center">
            <div><p className="text-xs text-navy-100">الحالة</p><span className={`chip mt-1 ${ACTIVITY_STATUS[m.activity_status]?.cls}`}>{ACTIVITY_STATUS[m.activity_status]?.label}</span></div>
            <div><p className="text-xs text-navy-100">إجمالي الرصيد</p><p className="text-2xl font-bold">{p.total_points}</p></div>
          </div>
        </div>
      </section>

      {p.overdue > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <Icon name="alert" className="h-5 w-5" /> لدى العضو {p.overdue} تكليف متأخر عن موعده.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([l, v, s]) => (
          <div key={l} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="stat-label">{l}</p>
            <div className="mt-1 text-2xl font-bold text-navy-800">{v}</div>
            <p className="text-[11px] text-slate-500">{s}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="section-title mb-3">النقاط الأسبوعية — آخر 12 أسبوعاً</h2>
          <div className="flex h-36 items-end gap-1.5 border-b border-slate-200">
            {p.weekly.map((w, i) => (
              <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold text-slate-600">{w.points || ''}</span>
                <div className={`w-full rounded-t ${i === p.weekly.length - 1 ? 'bg-gold-500' : 'bg-navy-600'}`} style={{ height: `${(w.points / maxW) * 100}%`, minHeight: 2 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">{p.weekly.map((w) => <span key={w.week} className="flex-1 text-center text-[9px] text-slate-400">{new Date(w.week).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })}</span>)}</div>
        </section>
        <section className="card">
          <h2 className="section-title mb-3">سجل التكليفات</h2>
          <dl className="space-y-1.5 text-sm">
            {[['معروض', p.offers], ['مقبول', p.accepted], ['معتمد', p.approved], ['اعتذار', p.declined], ['انتهت المهلة دون رد', p.expired],
              ['انسحاب بعد القبول', p.withdrawn], ['غير معتمد', p.rejected]].map(([l, v]) => (
              <div key={String(l)} className="flex justify-between border-b border-slate-50 pb-1"><dt className="text-slate-600">{l}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>
          {p.by_category && (
            <div className="mt-3">
              <p className="stat-label mb-1">التخصص (المعتمد حسب النوع)</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(p.by_category).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <span key={k} className="chip bg-slate-100 text-slate-700">{CATEGORIES[k as keyof typeof CATEGORIES]}: {n}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="section-title">تكليف مباشر لهذا العضو</h2>
          <DirectAssign memberIds={[m.id]} unitId={m.unit_id ?? units[0]?.id ?? ""} label="إسناد تكليف جديد" />
        </section>
        <section className="card space-y-3">
          <h2 className="section-title">إرسال تنبيه رسمي</h2>
          <NoticeForm memberId={m.id} />
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="section-title border-b border-slate-100 px-4 py-2.5">التكليفات الحالية ({open.length})</h2>
        {open.length === 0 ? <p className="muted p-4">لا توجد تكليفات حالية.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-2">التكليف</th><th>الحالة</th><th>الموعد</th><th>المصدر</th></tr></thead>
            <tbody>
              {open.map((a) => {
                const late = a.tasks && Date.parse(a.tasks.deadline) < now && ['accepted', 'rework'].includes(a.status);
                return (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-semibold">{a.tasks?.title}</td>
                    <td><span className={`chip ${late ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{late ? 'متأخر' : ASSIGNMENT_STATUS[a.status]}</span></td>
                    <td className={late ? 'text-red-700' : ''}>{fmtDate(a.tasks?.deadline)}</td>
                    <td className="text-xs text-slate-500">{a.match_reason?.startsWith('تكليف مباشر') ? a.match_reason : 'توزيع تلقائي'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="section-title border-b border-slate-100 px-4 py-2.5">سجل التكليفات السابقة</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-2">التكليف</th><th>النتيجة</th><th>التسليم</th><th>في الموعد</th><th>ملاحظة الأمين</th></tr></thead>
            <tbody>
              {history.map((a) => {
                const onTime = a.submitted_at && a.tasks ? Date.parse(a.submitted_at) <= Date.parse(a.tasks.deadline) : null;
                return (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{a.tasks?.title}<span className="block text-[11px] text-slate-400">{a.tasks && CATEGORIES[a.tasks.category]}</span></td>
                    <td><span className={`chip ${a.status === 'approved' ? 'bg-brand-100 text-brand-900' : a.status === 'declined' ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-800'}`}>{ASSIGNMENT_STATUS[a.status]}</span></td>
                    <td className="text-xs">{fmtDate(a.submitted_at)}</td>
                    <td>{onTime == null ? '—' : onTime ? <span className="text-brand-700">نعم</span> : <span className="text-red-700">لا</span>}</td>
                    <td className="text-xs text-slate-500">{a.feedback ?? '—'}</td>
                  </tr>
                );
              })}
              {history.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">لا يوجد سجل.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card">
          <h2 className="section-title mb-2">الحضور ({p.attendance_total})</h2>
          {(att ?? []).map((a) => (
            <div key={a.id} className="flex justify-between border-b border-slate-50 py-1.5 text-sm"><span>{a.events?.title}</span><span className="text-xs text-slate-500">{fmtDate(a.checked_in_at)}</span></div>
          ))}
          {(att ?? []).length === 0 && <p className="muted">لا يوجد حضور مسجل.</p>}
        </section>
        <section className="card">
          <h2 className="section-title mb-2">آخر حركات الرصيد</h2>
          {(ledger ?? []).map((l) => (
            <div key={l.id} className="flex justify-between border-b border-slate-50 py-1.5 text-sm"><span className="truncate">{l.note}</span><span className={`font-bold ${l.amount > 0 ? 'text-brand-700' : 'text-red-700'}`}>{l.amount > 0 ? '+' : ''}{l.amount}</span></div>
          ))}
        </section>
        <section className="card space-y-2 text-sm">
          <h2 className="section-title">البيانات التنظيمية</h2>
          <p><span className="text-slate-500">المهارات: </span>{m.skills.join('، ') || '—'}</p>
          <p><span className="text-slate-500">الإتاحة: </span>{m.weekly_hours} ساعة أسبوعياً، {m.available_days.length} أيام</p>
          <p><span className="text-slate-500">النشر العلني: </span>{p.consent_recognition ? 'موافق' : 'غير موافق'}</p>
          {canManage && (
            <div className="border-t border-slate-100 pt-2">
              <p className="stat-label mb-1">الوحدة والحالة والدور</p>
              <MemberRoleForm member={{ id: m.id, role: m.role, unit_id: m.unit_id, activity_status: m.activity_status }}
                units={units.map(({ id: uid, label }) => ({ id: uid, label }))} isAdmin={me.role === 'admin'} self={m.id === me.id} />
            </div>
          )}
          <Link href={`/certificate?m=${m.id}`} target="_blank" className="btn-ghost mt-2 w-full">طباعة شهادة العضو</Link>
        </section>
      </div>
    </div>
  );
}
