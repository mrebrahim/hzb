'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, SIZES } from '@/lib/labels';

type Props = {
  memberIds: string[];
  unitId: string; // الوحدة اللي التكليف هيتسجل عليها (لازم تكون في نطاق الأمين)
  label?: string;
  onDone?: () => void;
};

// تكليف مباشر: بيعمل تكليف جديد ويسنده للأعضاء المحددين على طول (قيد التنفيذ)
export function DirectAssign({ memberIds, unitId, label, onDone }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!memberIds.length) return setMsg({ ok: false, text: 'حدد عضواً واحداً على الأقل' });
    setBusy(true);
    const supabase = createClient();
    const f = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: task, error } = await supabase.from('tasks').insert({
      title: String(f.get('title')),
      description: String(f.get('description') || '') || null,
      category: f.get('category'),
      size: f.get('size'),
      priority: f.get('priority'),
      unit_id: unitId,
      capacity: memberIds.length,
      deadline: new Date(String(f.get('deadline'))).toISOString(),
      requires_photo: f.get('requires_photo') === 'on',
      created_by: user!.id,
    }).select('id').single();
    if (error) { setBusy(false); return setMsg({ ok: false, text: error.message }); }
    const r = await supabase.rpc('assign_task_direct', { p_task: task.id, p_members: memberIds });
    setBusy(false);
    if (r.error) return setMsg({ ok: false, text: r.error.message });
    setMsg({ ok: true, text: `تم إسناد التكليف إلى ${r.data} عضو وإخطارهم` });
    setOpen(false);
    onDone?.();
    router.refresh();
  }

  const due = new Date(Date.now() + 3 * 864e5 - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
  return (
    <div>
      {!open && (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={!memberIds.length} onClick={() => { setOpen(true); setMsg(null); }}>
            {label ?? `تكليف مباشر (${memberIds.length})`}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-brand-700' : 'text-red-700'}`}>{msg.text}</span>}
        </div>
      )}
      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-navy-200 bg-navy-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">تكليف مباشر — {memberIds.length} عضو</h3>
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
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requires_photo" /> يتطلب صورة إثبات</label>
          <p className="text-xs text-slate-500">يُسجَّل التكليف «قيد التنفيذ» مباشرة ويصل للعضو إشعار رسمي. التأخير عن الموعد يُخفّض نسبة التزامه ويُصعَّد إليك تلقائياً.</p>
          {msg && !msg.ok && <p className="text-sm text-red-700">{msg.text}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ الإسناد...' : 'إسناد التكليف'}</button>
        </form>
      )}
    </div>
  );
}
