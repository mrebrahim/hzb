import { notFound } from 'next/navigation';
import { LiveQr } from '@/components/LiveQr';
import { ManualCheckIn } from '@/components/ManualCheckIn';
import { createClient } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/labels';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: e } = await supabase.from('events').select('*, units(name)').eq('id', id).single();
  if (!e) notFound();
  const [{ data: att }, { data: members }] = await Promise.all([
    supabase.from('attendance').select('id,method,checked_in_at,distance_m,profiles!attendance_member_id_fkey(full_name)')
      .eq('event_id', id).order('checked_in_at', { ascending: false })
      .returns<{ id: number; method: string; checked_in_at: string; distance_m: number | null; profiles: { full_name: string } | null }[]>(),
    supabase.from('profiles').select('id,full_name').order('full_name').limit(1000),
  ]);
  const live = Date.now() > Date.parse(e.starts_at) - 30 * 60e3 && Date.now() < Date.parse(e.ends_at);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card text-center">
        <h1 className="h1">{e.title}</h1>
        <p className="muted mb-4">{e.units?.name} • {fmtDate(e.starts_at)} – {fmtDate(e.ends_at)}</p>
        {live ? <LiveQr eventId={id} /> : <p className="muted py-10">الـ QR بيشتغل من قبل البداية بنص ساعة لحد النهاية.</p>}
      </section>
      <section className="card space-y-3">
        <h2 className="h2">الحضور ({att?.length ?? 0})</h2>
        <ManualCheckIn eventId={id} members={members ?? []} />
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {(att ?? []).map((a) => (
            <div key={a.id} className="flex justify-between text-sm">
              <span>{a.profiles?.full_name}</span>
              <span className="muted text-xs">{fmtDate(a.checked_in_at)} • {a.method === 'qr' ? `QR${a.distance_m != null ? ` (${a.distance_m}م)` : ''}` : 'يدوي'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
