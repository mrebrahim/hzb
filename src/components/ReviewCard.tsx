'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = { id: string; header: string; meta: string; report: string; photo: string | null; map: string | null };

export function ReviewCard({ id, header, meta, report, photo, map }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function review(approve: boolean) {
    if (!approve && !feedback.trim()) return setErr('اكتب للعضو محتاج يعدّل إيه');
    setBusy(true);
    const { error } = await createClient().rpc('review_assignment', { p_id: id, p_approve: approve, p_feedback: feedback || null });
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <article className="card space-y-2">
      <h3 className="font-bold">{header}</h3>
      <p className="muted text-xs">{meta}</p>
      <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm">{report}</p>
      <div className="flex flex-wrap gap-3 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <a href={photo} target="_blank" rel="noreferrer"><img src={photo} alt="إثبات" className="h-32 rounded-md object-cover" /></a>}
        {map && <a href={map} target="_blank" rel="noreferrer" className="text-navy-700 underline">الموقع على الخريطة</a>}
      </div>
      <input value={feedback} onChange={(e) => setFeedback(e.target.value)} className="input" placeholder="كلمة شكر أو ملاحظة للعضو (بتوصله مع النتيجة)" />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => review(true)}>اعتماد</button>
        <button className="btn-ghost" disabled={busy} onClick={() => review(false)}>محتاج تعديل</button>
      </div>
    </article>
  );
}
