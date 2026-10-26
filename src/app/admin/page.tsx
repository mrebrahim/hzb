import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { requireStaff } from '@/lib/auth';
import { ROLES, UNIT_TYPES, pct, rating } from '@/lib/labels';

type Kpi = {
  unit_id: string; unit_name: string; unit_type: keyof typeof UNIT_TYPES; child_count: number;
  members: number; active: number; slowing: number; dormant: number;
  offers_30: number; accepted_30: number; approved_30: number; attendance_30: number; points_30: number;
};
type Week = { week: string; active_members: number; points: number; approved: number; attendance: number };
type Champ = { member_id: string; full_name: string; unit_name: string; points_30: number; approved_30: number;
               attendance_30: number; streak_weeks: number; total_points: number };
type Staff = { staff_id: string; full_name: string; role: keyof typeof ROLES; unit_name: string; reviews_30: number;
               tasks_30: number; events_30: number; team_members: number; team_active: number; score: number };

function staffGrade(score: number, max: number) {
  const r = score / Math.max(max, 1);
  if (r >= 0.8) return { label: 'متميز', cls: 'bg-brand-600 text-white' };
  if (r >= 0.55) return { label: 'جيد جداً', cls: 'bg-brand-100 text-brand-900' };
  if (r >= 0.35) return { label: 'جيد', cls: 'bg-navy-100 text-navy-800' };
  return { label: 'يحتاج متابعة', cls: 'bg-red-100 text-red-800' };
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ root?: string }> }) {
  const { root } = await searchParams;
  const { supabase, profile } = await requireStaff();
  const args = { p_root: root ?? null };
  const [k, w, rootUnit, champs, staff, pending, overdue] = await Promise.all([
    supabase.rpc('unit_kpis', args),
    supabase.rpc('weekly_activity', { ...args, p_weeks: 8 }),
    root ? supabase.from('units').select('name,parent_id').eq('id', root).single() : Promise.resolve({ data: null }),
    supabase.rpc('leaderboard_members', { ...args, p_limit: 10 }),
    supabase.rpc('leaderboard_staff', args),
    supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('assignments').select('id,tasks!inner(deadline)', { count: 'exact', head: true })
      .in('status', ['accepted', 'rework']).lt('tasks.deadline', new Date().toISOString()),
  ]);
  if (k.error) return <p className="card text-red-700">{k.error.message}</p>;

  const rows = (k.data ?? []) as Kpi[];
  const weeks = (w.data ?? []) as Week[];
  const top = (champs.data ?? []) as Champ[];
  const team = ((staff.data ?? []) as Staff[]).filter((s) => s.staff_id !== profile.id);
  const sum = (key: keyof Kpi) => rows.reduce((a, r) => a + (r[key] as number), 0);
  const members = sum('members');
  const lastWeek = weeks.at(-2)?.active_members ?? 0, thisWeek = weeks.at(-1)?.active_members ?? 0;
  const maxActive = Math.max(1, ...weeks.map((x) => x.active_members));
  const maxScore = Math.max(1, ...team.map((s) => s.score));
  const ranked = [...rows].filter((r) => r.members > 0)
    .sort((a, b) => b.active / b.members - a.active / a.members || b.points_30 / b.members - a.points_30 / a.members);
  const today = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date());

  const alerts = [
    { n: pending.count ?? 0, text: 'تقرير بانتظار المراجعة والاعتماد', href: '/admin/review', tone: 'navy' },
    { n: overdue.count ?? 0, text: 'تكليف تجاوز موعد التسليم', href: '/admin/tasks', tone: 'red' },
    { n: sum('dormant'), text: 'عضو خامل منذ أكثر من 3 أسابيع', href: '/admin/members?status=dormant', tone: 'red' },
    { n: sum('slowing'), text: 'عضو تراجع نشاطه', href: '/admin/members?status=slowing', tone: 'amber' },
  ].filter((x) => x.n > 0);

  return (
    <div className="space-y-4">
      {/* ── الترويسة ── */}
      <section className="overflow-hidden rounded-lg bg-navy-800 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-2 text-xs text-navy-100">
          <span>تقرير المتابعة والأداء — {ROLES[profile.role]}: {profile.full_name}</span><span>{today}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <h1 className="text-xl font-bold">{rootUnit?.data ? rootUnit.data.name : 'لوحة متابعة التنظيم'}</h1>
          {rootUnit?.data && (
            <Link href={rootUnit.data.parent_id ? `/admin?root=${rootUnit.data.parent_id}` : '/admin'} className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">العودة للمستوى الأعلى</Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10 p-0 sm:grid-cols-4 [&>*]:bg-navy-800">
          {[
            ['نسبة الأعضاء النشطين', `${pct(sum('active'), members)}%`, `${sum('active')} من ${members} عضو`],
            ['التكليفات المعتمدة', sum('approved_30'), 'آخر 30 يوماً'],
            ['نسبة قبول التكليفات', `${pct(sum('accepted_30'), sum('offers_30'))}%`, `${sum('offers_30')} تكليف موزّع`],
            ['حالات الحضور', sum('attendance_30'), 'آخر 30 يوماً'],
          ].map(([l, v, sub]) => (
            <div key={String(l)} className="px-5 py-4">
              <p className="text-xs text-navy-100">{l}</p>
              <p className="mt-1 text-3xl font-bold">{v}</p>
              <p className="text-[11px] text-navy-200">{sub}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-2 text-xs">
          <Icon name="trend" className="h-4 w-4 text-gold-400" />
          <span>الأعضاء النشطون هذا الأسبوع: <b>{thisWeek}</b> مقابل <b>{lastWeek}</b> الأسبوع السابق
            {thisWeek >= lastWeek ? <span className="text-brand-100"> (تحسّن)</span> : <span className="text-red-200"> (تراجع)</span>}</span>
        </div>
      </section>

      {/* ── إجراءات مطلوبة ── */}
      {alerts.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5"><Icon name="alert" className="h-4 w-4 text-red-700" /><h2 className="section-title">إجراءات مطلوبة</h2></div>
          <div className="divide-y divide-slate-100">
            {alerts.map((x) => (
              <Link key={x.text} href={x.href} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50">
                <span className="flex items-center gap-3">
                  <span className={`grid h-7 min-w-7 place-items-center rounded px-1.5 text-sm font-bold ${x.tone === 'red' ? 'bg-red-100 text-red-800' : x.tone === 'amber' ? 'bg-amber-100 text-amber-900' : 'bg-navy-100 text-navy-800'}`}>{x.n}</span>
                  {x.text}
                </span>
                <span className="text-xs font-semibold text-navy-600">اتخاذ إجراء ←</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── الأعضاء الأعلى أداءً ── */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-2"><Icon name="award" className="h-4 w-4 text-gold-500" /><h2 className="section-title">الأعضاء الأعلى أداءً — آخر 30 يوماً</h2></div>
            <Link href="/admin/recognition" className="text-xs font-semibold text-navy-600">التكريم</Link>
          </div>
          {top.length === 0 ? <p className="muted p-4">لا يوجد نشاط كافٍ خلال الفترة.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-right text-xs text-slate-500">
                <tr><th className="px-4 py-2">#</th><th>العضو</th><th>تكليفات</th><th>حضور</th><th>النقاط</th><th>التقييم</th></tr>
              </thead>
              <tbody>
                {top.map((c, i) => {
                  const r = rating(c.points_30);
                  return (
                    <tr key={c.member_id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <span className={`grid h-6 w-6 place-items-center rounded text-xs font-bold ${i < 3 ? 'bg-gold-100 text-gold-600 ring-1 ring-gold-400' : 'text-slate-400'}`}>{i + 1}</span>
                      </td>
                      <td><p className="font-semibold text-navy-800">{c.full_name}</p><p className="text-[11px] text-slate-500">{c.unit_name}{c.streak_weeks >= 3 ? ` • منتظم ${c.streak_weeks} أسابيع` : ''}</p></td>
                      <td>{c.approved_30}</td>
                      <td>{c.attendance_30}</td>
                      <td className="font-bold text-navy-800">{c.points_30}</td>
                      <td><span className={`chip ${r.cls}`}>{r.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* ── تقييم الأمناء المساعدين ── */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-2"><Icon name="users" className="h-4 w-4 text-navy-600" /><h2 className="section-title">تقييم أداء الأمناء المساعدين</h2></div>
            <p className="mt-0.5 text-[11px] text-slate-500">المؤشر = المراجعات×2 + التكليفات×3 + الفعاليات×4 + نسبة نشاط الفريق (حتى 50)</p>
          </div>
          {team.length === 0 && <p className="muted p-4">لا يوجد أمناء مساعدون في نطاقك.</p>}
          <div className="divide-y divide-slate-100">
            {team.map((s, i) => {
              const g = staffGrade(s.score, maxScore);
              return (
                <div key={s.staff_id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-bold ${i < 3 ? 'bg-gold-100 text-gold-600 ring-1 ring-gold-400' : 'text-slate-400'}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy-800">{s.full_name}</p>
                      <p className="text-[11px] text-slate-500">{ROLES[s.role]} — {s.unit_name}</p>
                    </div>
                    <span className={`chip ${g.cls}`}>{g.label}</span>
                    <span className="w-10 text-left text-lg font-bold text-navy-800">{s.score}</span>
                  </div>
                  <div className="mr-9 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-navy-600" style={{ width: `${(s.score / maxScore) * 100}%` }} />
                  </div>
                  <p className="mr-9 mt-1.5 text-[11px] text-slate-500">
                    {s.reviews_30} مراجعة • {s.tasks_30} تكليف • {s.events_30} فعالية • نشاط الفريق {pct(s.team_active, s.team_members)}% ({s.team_active}/{s.team_members})
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── ترتيب الوحدات ── */}
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2"><Icon name="layers" className="h-4 w-4 text-navy-600" /><h2 className="section-title">ترتيب الوحدات حسب نسبة النشاط</h2></div>
          <p className="mb-3 text-[11px] text-slate-500">اضغط على اسم الوحدة لعرض تفاصيل الوحدات التابعة لها.</p>
          <div className="space-y-3">
            {ranked.map((r, i) => {
              const rate = pct(r.active, r.members);
              return (
                <div key={r.unit_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      <span className="ml-2 text-xs text-slate-400">{i + 1}.</span>
                      {r.child_count > 0 ? <Link href={`/admin?root=${r.unit_id}`} className="text-navy-700 hover:underline">{r.unit_name}</Link> : r.unit_name}
                    </span>
                    <span className="text-xs text-slate-500">{r.active}/{r.members} نشط • {r.members ? Math.round(r.points_30 / r.members) : 0} نقطة/عضو</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${rate >= 60 ? 'bg-brand-600' : rate >= 40 ? 'bg-navy-500' : 'bg-red-600'}`} style={{ width: `${Math.max(rate, 3)}%` }} />
                  </div>
                  <p className="mt-0.5 text-left text-[11px] font-semibold text-slate-600">{rate}%</p>
                </div>
              );
            })}
            {ranked.length === 0 && <p className="muted">لا يوجد أعضاء في هذا النطاق.</p>}
          </div>
        </section>

        {/* ── النشاط الأسبوعي ── */}
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2"><Icon name="chart" className="h-4 w-4 text-navy-600" /><h2 className="section-title">الأعضاء النشطون أسبوعياً</h2></div>
          <div className="flex h-44 items-end gap-2 border-b border-slate-200">
            {weeks.map((x, i) => (
              <div key={x.week} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-600">{x.active_members}</span>
                <div className={`w-full rounded-t ${i === weeks.length - 1 ? 'bg-gold-500' : 'bg-navy-600'}`}
                  style={{ height: `${(x.active_members / maxActive) * 100}%`, minHeight: 3 }} title={`${x.points} نقطة • ${x.approved} تكليف • ${x.attendance} حضور`} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            {weeks.map((x) => <span key={x.week} className="flex-1 text-center text-[10px] text-slate-500">{new Date(x.week).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })}</span>)}
          </div>
        </section>
      </div>

      {/* ── الجدول التفصيلي ── */}
      <section className="card overflow-x-auto">
        <h2 className="section-title mb-3">البيان التفصيلي للوحدات</h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-right text-xs text-slate-500">
            <tr><th className="px-2 py-2">الوحدة</th><th>الأعضاء</th><th>نشط</th><th>متراجع</th><th>خامل</th><th>قبول التكليفات</th><th>معتمدة</th><th>حضور</th></tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.unit_id} className="border-t border-slate-100">
                <td className="px-2 py-2 font-semibold">{r.unit_name} <span className="text-xs font-normal text-slate-400">{UNIT_TYPES[r.unit_type]}</span></td>
                <td>{r.members}</td>
                <td className="text-navy-700">{r.active}</td>
                <td className="text-amber-700">{r.slowing}</td>
                <td>{r.dormant > 0 ? <Link href="/admin/members?status=dormant" className="font-semibold text-red-700 underline">{r.dormant}</Link> : 0}</td>
                <td>{pct(r.accepted_30, r.offers_30)}%</td>
                <td>{r.approved_30}</td>
                <td>{r.attendance_30}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
