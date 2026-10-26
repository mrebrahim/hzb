import Link from 'next/link';
import { MemberRoleForm } from '@/components/MemberRoleForm';
import { requireStaff } from '@/lib/auth';
import { ACTIVITY_STATUS, ROLES, fmtDate } from '@/lib/labels';
import { getScopeUnits } from '@/lib/units';

type M = { id: string; full_name: string; phone: string | null; role: keyof typeof ROLES; activity_status: string;
           unit_id: string | null; last_active_at: string; skills: string[] };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const { supabase, profile } = await requireStaff();
  let query = supabase.from('profiles').select('id,full_name,phone,role,activity_status,unit_id,last_active_at,skills')
    .order('last_active_at').limit(300);
  if (status) query = query.eq('activity_status', status);
  if (q) query = query.ilike('full_name', `%${q}%`);
  const [{ data: members }, units] = await Promise.all([query.returns<M[]>(), getScopeUnits(supabase)]);
  const unitLabel = new Map(units.map((u) => [u.id, u.label]));
  const isAdmin = profile.role === 'admin';
  const canEdit = profile.role !== 'assistant';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="h1 ml-auto">الأعضاء ({members?.length ?? 0})</h1>
        <form className="flex gap-1"><input name="q" defaultValue={q} className="input w-40" placeholder="بحث بالاسم" />{status && <input type="hidden" name="status" value={status} />}</form>
        <Link href="/admin/members" className={`chip py-1 ${!status ? 'bg-brand-100' : 'bg-slate-100'}`}>الكل</Link>
        {Object.entries(ACTIVITY_STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/members?status=${k}`} className={`chip py-1 ${status === k ? 'ring-2 ring-navy-500' : ''} ${v.cls}`}>{v.label}</Link>
        ))}
      </div>
      {status === 'dormant' && (
        <p className="card bg-amber-50 text-sm text-amber-900">
          الأعضاء دول ما شاركوش من 3 أسابيع. أبحاث التطوع بتقول إن أغلب الانسحاب سببه إن المتطوع مش عارف يعمل إيه — كلّمهم أو اعمل مهمة صغيرة وواضحة لوحدتهم.
        </p>
      )}
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-right text-xs text-slate-500">
            <tr><th className="py-2">الاسم</th><th>الوحدة</th><th>الحالة</th><th>آخر نشاط</th><th>المهارات</th><th>الدور</th></tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-t border-slate-50 align-top">
                <td className="py-2"><p className="font-semibold">{m.full_name}</p><p className="muted text-xs" dir="ltr">{m.phone}</p></td>
                <td className="text-xs">{m.unit_id ? unitLabel.get(m.unit_id) ?? '—' : <span className="text-red-600">بدون وحدة</span>}</td>
                <td><span className={`chip ${ACTIVITY_STATUS[m.activity_status]?.cls}`}>{ACTIVITY_STATUS[m.activity_status]?.label}</span></td>
                <td className="text-xs">{fmtDate(m.last_active_at)}</td>
                <td className="text-xs">{m.skills.join('، ') || '—'}</td>
                <td>
                  {canEdit ? (
                    <MemberRoleForm member={{ id: m.id, role: m.role, unit_id: m.unit_id, activity_status: m.activity_status }}
                      units={units.map(({ id, label }) => ({ id, label }))} isAdmin={isAdmin} self={m.id === profile.id} />
                  ) : <span className="text-xs">{ROLES[m.role]}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
