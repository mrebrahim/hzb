import Link from 'next/link';
import { EventForm } from '@/components/EventForm';
import { createClient } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/labels';
import { getScopeUnits } from '@/lib/units';

type E = { id: string; unit_id: string; title: string; starts_at: string; ends_at: string; points: number; lat: number | null;
           units: { name: string } | null; attendance: { count: number }[] };

export default async function EventsPage() {
  const supabase = await createClient();
  const [units, { data: events }] = await Promise.all([
    getScopeUnits(supabase),
    supabase.from('events').select('id,unit_id,title,starts_at,ends_at,points,lat,units(name),attendance(count)')
      .order('starts_at', { ascending: false }).limit(50).returns<E[]>(),
  ]);
  const scopeIds = new Set(units.map((u) => u.id));

  return (
    <div className="space-y-4">
      <EventForm units={units.map(({ id, label }) => ({ id, label }))} />
      <section className="card space-y-2">
        <h2 className="h2">الفعاليات</h2>
        {(events ?? []).length === 0 && <p className="muted">مفيش فعاليات لسه.</p>}
        {(events ?? []).map((e) => {
          const live = Date.now() > Date.parse(e.starts_at) - 30 * 60e3 && Date.now() < Date.parse(e.ends_at);
          return (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm">
              <div>
                <p className="font-semibold">{e.title} {live && <span className="chip bg-rose-500 text-white">مباشر</span>}</p>
                <p className="muted text-xs">{e.units?.name} • {fmtDate(e.starts_at)} • {e.points} نقطة • {e.lat != null ? 'بتأكيد الموقع' : 'من غير تأكيد موقع'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip bg-gray-100">{e.attendance[0]?.count ?? 0} حضور</span>
                {scopeIds.has(e.unit_id) && (
                  <Link href={`/admin/events/${e.id}`} className="btn-ghost px-3 py-1">{live ? 'اعرض الـ QR' : 'التفاصيل'}</Link>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
