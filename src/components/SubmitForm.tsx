'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LocationMap } from './LocationMap';

type Loc = { lat: number; lng: number; accuracy: number };

export function SubmitForm({ assignmentId, memberId, requiresPhoto, requiresLocation }: {
  assignmentId: string; memberId: string; requiresPhoto: boolean; requiresLocation?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>تسليم التقرير</button>;

  function locate() {
    if (!('geolocation' in navigator)) return setLocError('المتصفح لا يدعم تحديد الموقع');
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }); setLocating(false); },
      (e) => {
        setLocating(false);
        setLocError(e.code === e.PERMISSION_DENIED ? 'تم رفض إذن الموقع — اسمح للمتصفح بالوصول للموقع من الإعدادات ثم أعد المحاولة' : 'تعذّر تحديد الموقع، تأكد من تشغيل GPS وأعد المحاولة');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (requiresLocation && !loc) return setError('هذا التكليف يتطلب تحديد موقعك قبل التسليم');
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const f = new FormData(e.currentTarget);
    const file = f.get('photo') as File | null;
    let path: string | null = null;
    if (file && file.size > 0) {
      path = `${memberId}/${assignmentId}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
      const up = await supabase.storage.from('evidence').upload(path, file, { contentType: file.type });
      if (up.error) { setBusy(false); return setError('تعذّر رفع الصورة: ' + up.error.message); }
    }
    const { error } = await supabase.rpc('submit_report', {
      p_id: assignmentId, p_report: String(f.get('report')), p_evidence_url: path,
      p_lat: loc?.lat ?? null, p_lng: loc?.lng ?? null, p_accuracy: loc?.accuracy ?? null,
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <textarea name="report" required minLength={5} rows={3} className="input" placeholder="ماذا أنجزت؟ كم شخصاً قابلت؟ أهم الملاحظات من الميدان" />

      <div className={`rounded-md border p-3 ${requiresLocation && !loc ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-navy-800">موقع التنفيذ {requiresLocation ? <span className="text-red-700">(إلزامي)</span> : <span className="text-slate-400">(اختياري)</span>}</p>
            <p className="text-[11px] text-slate-500">يُسجَّل موقعك لحظة التسليم فقط، ولا يتم تتبعك بعد ذلك.</p>
          </div>
          <button type="button" onClick={locate} disabled={locating} className={loc ? 'btn-ghost' : 'btn-primary'}>
            {locating ? 'جارٍ تحديد الموقع...' : loc ? 'إعادة التحديد' : 'تحديد موقعي الآن'}
          </button>
        </div>
        {locError && <p className="mt-2 text-xs text-red-700">{locError}</p>}
        {loc && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-brand-700">تم تحديد الموقع ✓</p>
            <LocationMap lat={loc.lat} lng={loc.lng} accuracy={loc.accuracy} height={160} />
          </div>
        )}
      </div>

      <label className="block text-sm">
        صورة إثبات {requiresPhoto ? <span className="text-red-700">(إلزامية)</span> : <span className="text-slate-400">(اختيارية)</span>}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required={requiresPhoto} className="mt-1 block text-xs" />
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || (requiresLocation && !loc)}>{busy ? 'جارٍ الإرسال...' : 'إرسال للمراجعة'}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </form>
  );
}
