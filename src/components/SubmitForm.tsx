'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SubmitForm({ assignmentId, memberId, requiresPhoto }: { assignmentId: string; memberId: string; requiresPhoto: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>سلّم التقرير</button>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const f = new FormData(e.currentTarget);
    const file = f.get('photo') as File | null;
    let path: string | null = null;
    if (file && file.size > 0) {
      path = `${memberId}/${assignmentId}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
      const up = await supabase.storage.from('evidence').upload(path, file, { contentType: file.type });
      if (up.error) { setBusy(false); return setError('الصورة ما اترفعتش: ' + up.error.message); }
    }
    let lat: number | null = null, lng: number | null = null;
    if (f.get('share_location') === 'on' && 'geolocation' in navigator) {
      await new Promise<void>((res) => navigator.geolocation.getCurrentPosition(
        (p) => { lat = p.coords.latitude; lng = p.coords.longitude; res(); }, () => res(), { timeout: 8000 }));
    }
    const { error } = await supabase.rpc('submit_assignment', {
      p_id: assignmentId, p_report: String(f.get('report')), p_evidence_url: path, p_lat: lat, p_lng: lng,
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-md bg-slate-50 p-3">
      <textarea name="report" required minLength={5} rows={3} className="input" placeholder="عملت إيه؟ قابلت كام حد؟ أي ملاحظات من الأرض؟" />
      <label className="block text-sm">
        صورة {requiresPhoto ? '(مطلوبة)' : '(اختياري)'}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required={requiresPhoto} className="mt-1 block text-xs" />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="share_location" className="accent-brand-600" /> أرفق موقعي الحالي مع التقرير (مرة واحدة)
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'جاري الإرسال...' : 'إرسال للمراجعة'}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </form>
  );
}
