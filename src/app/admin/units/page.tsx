import { UnitForm } from '@/components/UnitForm';
import { createClient } from '@/lib/supabase/server';
import { UNIT_TYPES } from '@/lib/labels';
import { getScopeUnits } from '@/lib/units';

export default async function UnitsPage() {
  const supabase = await createClient();
  const units = await getScopeUnits(supabase);
  return (
    <div className="space-y-4">
      <UnitForm parents={units.filter((u) => u.type !== 'unit').map(({ id, label, type }) => ({ id, label, type }))} />
      <section className="card">
        <h2 className="h2 mb-2">الهيكل التنظيمي في نطاقك ({units.length})</h2>
        <ul className="columns-1 text-sm sm:columns-2">
          {units.map((u) => (
            <li key={u.id} className="break-inside-avoid py-0.5">{u.label} <span className="muted text-xs">{UNIT_TYPES[u.type as keyof typeof UNIT_TYPES]}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
