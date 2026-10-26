'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function EventForm({ units }: { units: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = createClient();
    const f = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('events').insert({
      title: String(f.get('title')),
      unit_id: f.get('unit_id'),
      starts_at: new Date(String(f.get('starts_at'))).toISOString(),
      ends_at: new Date(String(f.get('ends_at'))).toISOString(),
      points: Number(f.get('points') || 10),
      radius_m: Number(f.get('radius_m') || 300),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      created_by: user!.id,
    }).select('id').single();
    if (error) return setMsg(error.message);
    router.push(`/admin/events/${data.id}`);
  }

  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>+ فعالية جديدة</button>;

  const local = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="h2">فعالية جديدة</h2>
      <div><label className="label">الاسم</label><input name="title" required className="input" placeholder="اجتماع أمانة الشباب الشهري" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">الوحدة</label>
          <select name="unit_id" className="input">{units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></div>
        <div><label className="label">البداية</label><input name="starts_at" type="datetime-local" required defaultValue={local(Date.now())} className="input" /></div>
        <div><label className="label">النهاية</label><input name="ends_at" type="datetime-local" required defaultValue={local(Date.now() + 2 * 3600e3)} className="input" /></div>
        <div><label className="label">نقاط الحضور</label><input name="points" type="number" min={0} max={100} defaultValue={10} className="input" /></div>
        <div><label className="label">نطاق الموقع (متر)</label><input name="radius_m" type="number" min={50} max={5000} defaultValue={300} className="input" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="btn-ghost" onClick={() =>
          navigator.geolocation.getCurrentPosition((p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => setMsg('مقدرناش نجيب الموقع'), { enableHighAccuracy: true })}>
          استخدم موقعي الحالي كمكان الفعالية
        </button>
        {coords ? <span className="text-emerald-700">✓ الحضور هيتطلب يكون في حدود النطاق</span>
                : <span className="muted">(اختياري — من غيره QR بس)</span>}
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button className="btn-primary">إنشاء</button>
    </form>
  );
}
