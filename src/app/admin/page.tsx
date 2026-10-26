import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { UNIT_TYPES, pct } from '@/lib/labels';

type Kpi = {
  unit_id: string; unit_name: string; unit_type: keyof typeof UNIT_TYPES; child_count: number;
  members: number; active: number; slowing: number; dormant: number;
  offers_30: number; accepted_30: number; approved_30: number; attendance_30: number; points_30: number;
};
type Week = { week: string; active_members: number; points: number; approved: number; attendance: number };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ root?: string }> }) {
  const { root } = await searchParams;
  const supabase = await createClient();
  const args = { p_root: root ?? null };
  const [{ data: kpiData, error }, { data: weekData }, { data: rootUnit }] = await Promise.all([
    supabase.rpc('unit_kpis', args),
    supabase.rpc('weekly_activity', { ...args, p_weeks: 8 }),
    root ? supabase.from('units').select('name,parent_id').eq('id', root).single() : Promise.resolve({ data: null }),
  ]);
  if (error) return <p className="card text-rose-600">{error.message}</p>;

  const rows = (kpiData ?? []) as Kpi[];
  const weeks = (weekData ?? []) as Week[];
  const sum = (k: keyof Kpi) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const members = sum('members');
  const tiles = [
    ['إجمالي الأعضاء', members, ''],
    ['نشطين', sum('active'), `${pct(sum('active'), members)}%`],
    ['نشاطهم بيقل', sum('slowing'), `${pct(sum('slowing'), members)}%`],
    ['خاملين', sum('dormant'), `${pct(sum('dormant'), members)}%`],
    ['مهام اتعتمدت (30 يوم)', sum('approved_30'), ''],
    ['قبول العروض', `${pct(sum('accepted_30'), sum('offers_30'))}%`, `${sum('offers_30')} عرض`],
    ['حضور فعاليات (30 يوم)', sum('attendance_30'), ''],
    ['نقاط (30 يوم)', sum('points_30'), ''],
  ] as const;

  const maxActive = Math.max(1, ...weeks.map((w) => w.active_members));
  const ranked = [...rows].filter((r) => r.members > 0)
    .sort((a, b) => b.active / b.members - a.active / a.members || b.points_30 / b.members - a.points_30 / a.members);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">لوحة قياس الأداء {rootUnit ? `— ${rootUnit.name}` : ''}</h1>
        {rootUnit && <Link href={rootUnit.parent_id ? `/admin?root=${rootUnit.parent_id}` : '/admin'} className="btn-ghost">↑ المستوى الأعلى</Link>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card">
            <p className="muted text-xs">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-gray-500">{sub}</p>}
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="h2 mb-3">الأعضاء النشطين أسبوعياً</h2>
        <div className="flex h-40 items-end gap-2">
          {weeks.map((w) => (
            <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold">{w.active_members}</span>
              <div className="w-full rounded-t-lg bg-brand-500" style={{ height: `${(w.active_members / maxActive) * 100}%`, minHeight: 2 }}
                title={`${w.points} نقطة • ${w.approved} مهمة • ${w.attendance} حضور`} />
              <span className="text-[10px] text-gray-500">{new Date(w.week).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="h2 mb-1">ترتيب الوحدات (منافسة بين فرق، مش أفراد)</h2>
        <p className="muted mb-3 text-xs">الترتيب حسب نسبة الأعضاء النشطين، وبعدها النقاط لكل عضو. اضغط على الاسم للتفاصيل.</p>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-right text-xs text-gray-500">
            <tr><th className="py-2">#</th><th>الوحدة</th><th>أعضاء</th><th>نشط</th><th>خامل</th><th>قبول العروض</th><th>مهام معتمدة</th><th>حضور</th><th>نقاط/عضو</th></tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.unit_id} className="border-t border-gray-50">
                <td className="py-2">{i + 1}</td>
                <td>
                  {r.child_count > 0
                    ? <Link className="font-semibold text-brand-700" href={`/admin?root=${r.unit_id}`}>{r.unit_name}</Link>
                    : <span className="font-semibold">{r.unit_name}</span>}
                  <span className="muted mr-1 text-xs">{UNIT_TYPES[r.unit_type]}</span>
                </td>
                <td>{r.members}</td>
                <td><span className="chip bg-emerald-50 text-emerald-800">{pct(r.active, r.members)}%</span></td>
                <td>{r.dormant > 0 ? <span className="chip bg-rose-50 text-rose-700">{r.dormant}</span> : 0}</td>
                <td>{pct(r.accepted_30, r.offers_30)}%</td>
                <td>{r.approved_30}</td>
                <td>{r.attendance_30}</td>
                <td>{r.members ? Math.round(r.points_30 / r.members) : 0}</td>
              </tr>
            ))}
            {ranked.length === 0 && <tr><td colSpan={9} className="muted py-4 text-center">مفيش أعضاء في النطاق ده لسه.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
