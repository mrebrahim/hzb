import { RpcButton } from '@/components/RpcButton';
import { TaskCloseButton, TaskForm } from '@/components/TaskForm';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, PRIORITIES, fmtDate } from '@/lib/labels';
import { getScopeUnits } from '@/lib/units';

type T = {
  id: string; title: string; category: keyof typeof CATEGORIES; priority: keyof typeof PRIORITIES;
  capacity: number; deadline: string; status: string; base_points: number;
  units: { name: string } | null; assignments: { status: string }[];
};

export default async function TasksPage() {
  const supabase = await createClient();
  const [units, { data: tasks }] = await Promise.all([
    getScopeUnits(supabase),
    supabase.from('tasks').select('id,title,category,priority,capacity,deadline,status,base_points,units(name),assignments(status)')
      .order('created_at', { ascending: false }).limit(100).returns<T[]>(),
  ]);

  return (
    <div className="space-y-4">
      <TaskForm units={units.map(({ id, label }) => ({ id, label }))} />
      <section className="card overflow-x-auto">
        <h2 className="h2 mb-1">المهام</h2>
        <p className="muted mb-3 text-xs">
          النظام بيعرض كل مهمة على ضعف العدد المطلوب من أنسب الأعضاء، ولو حد اعتذر أو المهلة خلصت بيعرضها على غيره تلقائياً كل 15 دقيقة.
        </p>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-right text-xs text-gray-500">
            <tr><th className="py-2">المهمة</th><th>الوحدة</th><th>الأولوية</th><th>الموعد</th><th>مقبولة/مطلوب</th><th>معروضة</th><th>معتمدة</th><th></th></tr>
          </thead>
          <tbody>
            {(tasks ?? []).map((t) => {
              const c = (s: string[]) => t.assignments.filter((a) => s.includes(a.status)).length;
              const filled = c(['accepted', 'submitted', 'rework', 'approved']);
              const late = new Date(t.deadline) < new Date() && c(['accepted', 'rework']) > 0;
              return (
                <tr key={t.id} className="border-t border-gray-50 align-top">
                  <td className="py-2"><p className="font-semibold">{t.title}</p><p className="muted text-xs">{CATEGORIES[t.category]} • {t.base_points} نقطة</p></td>
                  <td>{t.units?.name}</td>
                  <td>{PRIORITIES[t.priority]}</td>
                  <td className={late ? 'text-rose-600' : ''}>{fmtDate(t.deadline)}{late && ' (متأخرة)'}</td>
                  <td><span className={`chip ${filled >= t.capacity ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{filled}/{t.capacity}</span></td>
                  <td>{c(['offered'])}</td>
                  <td>{c(['approved'])}</td>
                  <td className="space-x-1 space-x-reverse whitespace-nowrap">
                    {t.status === 'open' && (
                      <>
                        <RpcButton fn="distribute_task" args={{ p_task: t.id }} label="وزّع" className="btn-ghost px-3 py-1"
                          done={(n) => (Number(n) > 0 ? `اتعرضت على ${n}` : 'مفيش مرشحين مناسبين حالياً')} />
                        <TaskCloseButton id={t.id} />
                      </>
                    )}
                    {t.status !== 'open' && <span className="muted text-xs">مقفولة</span>}
                  </td>
                </tr>
              );
            })}
            {(tasks ?? []).length === 0 && <tr><td colSpan={8} className="muted py-4 text-center">مفيش مهام لسه — ابدأ بأول مهمة فوق.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
