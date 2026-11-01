'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, SIZES } from '@/lib/labels';
import { assignmentMessage } from '@/lib/whatsapp';
import { WhatsAppButton } from './WhatsAppButton';

export type AssignTarget = { id: string; name: string; phone: string | null; unit?: string | null };

type Sent = { title: string; deadline: string; requiresLocation: boolean; requiresPhoto: boolean; members: AssignTarget[] };

// تكليف مباشر: بيعمل تكليف جديد ويسنده للأعضاء المحددين (قيد التنفيذ) وبعدها بيجهّز رسالة واتساب لكل عضو
export function DirectAssign({ members, unitId, label, onDone }: {
  members: AssignTarget[]; unitId: string; label?: string; onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!members.length) return setError('حدد عضواً واحداً على الأقل');
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const f = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    const deadline = new Date(String(f.get('deadline'))).toISOString();
    const payload = {
      title: String(f.get('title')),
      description: String(f.get('description') || '') || null,
      category: f.get('category'),
      size: f.get('size'),
      priority: f.get('priority'),
      unit_id: unitId,
      capacity: members.length,
      deadline,
      requires_photo: f.get('requires_photo') === 'on',
      requires_location: f.get('requires_location') === 'on',
      created_by: user!.id,
    };
    const { data: task, error: err } = await supabase.from('tasks').insert(payload).select('id').single();
    if (err) { setBusy(false); return setError(err.message); }
    const r = await supabase.rpc('assign_task_direct', { p_task: task.id, p_members: members.map((m) => m.id) });
    setBusy(false);
    if (r.error) return setError(r.error.message);
    setSent({ title: payload.title, deadline, requiresLocation: payload.requires_location, requiresPhoto: payload.requires_photo, members });
    setOpen(false);
    onDone?.();
    router.refresh();
  }

  const due = new Date(Date.now() + 3 * 864e5 - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
  return (
    <div className="space-y-3">
      {!open && (
        <button className="btn-primary" disabled={!members.length} onClick={() => { setOpen(true); setSent(null); setError(null); }}>
          {label ?? `تكليف مباشر (${members.length})`}
        </button>
      )}

      {sent && (
        <div className="rounded-lg border border-brand-500/40 bg-brand-50 p-4">
          <p className="text-sm font-bold text-brand-900">تم إسناد «{sent.title}» إلى {sent.members.length} عضو، ووصلهم إشعار داخل المنظومة.</p>
          <p className="mt-1 text-xs text-slate-600">أرسل التكليف لكل عضو على واتساب (يفتح واتساب برسالة جاهزة وأنت تضغط إرسال):</p>
          <div className="mt-3 divide-y divide-brand-100 rounded-md border border-brand-100 bg-white">
            {sent.members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-semibold text-navy-800">{m.name} <span className="text-xs font-normal text-slate-400" dir="ltr">{m.phone}</span></span>
                <WhatsAppButton small phone={m.phone} text={assignmentMessage({
                  name: m.name, title: sent.title, deadline: sent.deadline, unit: m.unit,
                  url: typeof window !== 'undefined' ? window.location.origin : '',
                  requiresLocation: sent.requiresLocation, requiresPhoto: sent.requiresPhoto,
                })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-navy-200 bg-navy-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">تكليف مباشر — {members.length} عضو</h3>
            <button type="button" className="text-xs text-slate-500" onClick={() => setOpen(false)}>إلغاء</button>
          </div>
          <div><label className="label">عنوان التكليف</label><input name="title" required className="input" /></div>
          <div><label className="label">المطلوب بالتحديد</label><textarea name="description" rows={2} className="input" /></div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className="label">النوع</label><select name="category" className="input">{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">الحجم</label><select name="size" className="input">{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">الأولوية</label><select name="priority" defaultValue="p1" className="input"><option value="p0">حرجة</option><option value="p1">عالية</option><option value="p2">عادية</option></select></div>
            <div><label className="label">موعد التسليم</label><input name="deadline" type="datetime-local" required defaultValue={due} className="input" /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="requires_location" defaultChecked /> يتطلب تحديد الموقع عند التسليم</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="requires_photo" /> يتطلب صورة إثبات</label>
          </div>
          <p className="text-xs text-slate-500">يُسجَّل التكليف «قيد التنفيذ» مباشرة، ثم تظهر أزرار إرساله على واتساب لكل عضو. التأخير عن الموعد يُخفّض نسبة التزام العضو ويُصعَّد إليك تلقائياً.</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ الإسناد...' : 'إسناد التكليف'}</button>
        </form>
      )}
      {!open && error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
