import { MembersTable, type MemberRow } from '@/components/MembersTable';
import { requireStaff } from '@/lib/auth';
import { pct } from '@/lib/labels';
import { getScopeUnits } from '@/lib/units';

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase } = await requireStaff();
  const [{ data, error }, units, { data: root }] = await Promise.all([
    supabase.rpc('members_performance', { p_root: null }),
    getScopeUnits(supabase),
    supabase.rpc('scope_root'),
  ]);
  if (error) return <p className="card text-red-700">{error.message}</p>;
  const rows = ((data ?? []) as MemberRow[]);
  const members = rows.filter((r) => r.role === 'member');
  const active = members.filter((r) => r.activity_status === 'active').length;
  const overdue = members.filter((r) => r.overdue > 0).length;
  const low = members.filter((r) => r.reliability < 0.7).length;
  const avgCommit = members.length ? Math.round((members.reduce((a, r) => a + Number(r.reliability), 0) / members.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1 text-navy-800">متابعة أداء الأعضاء</h1>
        <p className="muted">اضغط على اسم العضو لعرض ملف أدائه الكامل، أو حدد أعضاء وأسند لهم تكليفاً مباشراً.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['إجمالي الأعضاء', members.length, `${pct(active, members.length)}% نشطون`],
          ['متوسط نسبة الالتزام', `${avgCommit}%`, 'على مستوى نطاقك'],
          ['لديهم تكليفات متأخرة', overdue, 'يستلزم متابعة فورية'],
          ['التزام أقل من 70%', low, 'يحتاجون تنبيهاً'],
        ].map(([l, v, s]) => (
          <div key={String(l)} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="stat-label">{l}</p><p className="mt-1 text-2xl font-bold text-navy-800">{v}</p><p className="text-xs text-slate-500">{s}</p>
          </div>
        ))}
      </div>
      <MembersTable rows={rows} units={units.map(({ id, label }) => ({ id, label }))} scopeUnit={String(root)} initialStatus={status} />
    </div>
  );
}
