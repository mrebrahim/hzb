'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, PRIORITIES, SIZES, SKILLS } from '@/lib/labels';

const TEMPLATES: { title: string; category: keyof typeof CATEGORIES; size: keyof typeof SIZES; description: string; photo?: boolean }[] = [
  { title: 'تقرير ميداني أسبوعي عن احتياجات المنطقة', category: 'field_report', size: 'small', description: 'زور مكانين في منطقتك واكتب أهم 3 احتياجات للأهالي مع صورة.', photo: true },
  { title: 'طرق أبواب للتعريف بالأنشطة', category: 'door_to_door', size: 'medium', description: 'زور 15 بيت في الشارع المحدد وسجّل الملاحظات.' },
  { title: 'نشر إعلان الفعالية على الجروبات', category: 'outreach', size: 'small', description: 'انشر الإعلان الرسمي في 3 جروبات ومجتمعات محلية.' },
  { title: 'يوم خدمة مجتمعية', category: 'community_service', size: 'large', description: 'المشاركة في يوم الخدمة (تنظيف/توزيع/قافلة).', photo: true },
  { title: 'ضم عضو جديد', category: 'recruitment', size: 'medium', description: 'اعزم حد من معارفك يسجل ويكمل أول نشاط ليه.' },
  { title: 'تنظيم واستقبال في الفعالية', category: 'event_support', size: 'medium', description: 'استقبال الحضور وتنظيم القاعة.' },
];

type U = { id: string; label: string };

export function TaskForm({ units }: { units: U[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState<(typeof TEMPLATES)[number] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const f = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('tasks').insert({
      title: String(f.get('title')),
      description: String(f.get('description') || '') || null,
      category: f.get('category'),
      size: f.get('size'),
      priority: f.get('priority'),
      unit_id: f.get('unit_id'),
      capacity: Number(f.get('capacity') || 1),
      deadline: new Date(String(f.get('deadline'))).toISOString(),
      required_skills: f.getAll('required_skills'),
      requires_photo: f.get('requires_photo') === 'on',
      created_by: user!.id,
    }).select('id').single();
    if (error) { setBusy(false); return setMsg(error.message); }
    const { data: n } = await supabase.rpc('distribute_task', { p_task: data.id });
    setBusy(false);
    setMsg(`اتعملت المهمة واتعرضت على ${n ?? 0} عضو مناسب`);
    (e.target as HTMLFormElement).reset();
    setTpl(null);
    router.refresh();
  }

  if (!open)
    return (
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => setOpen(true)}>+ مهمة جديدة</button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>
    );

  const tomorrow = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 16);
  return (
    <form key={tpl?.title ?? 'blank'} onSubmit={onSubmit} className="card space-y-3">
      <div className="flex items-center justify-between"><h2 className="h2">مهمة جديدة</h2>
        <button type="button" className="text-sm text-slate-500" onClick={() => setOpen(false)}>إغلاق</button></div>
      <div>
        <span className="label">ابدأ من قالب</span>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => <button type="button" key={t.title} className="chip bg-slate-100 py-1" onClick={() => setTpl(t)}>{t.title}</button>)}
        </div>
      </div>
      <div><label className="label">العنوان</label><input name="title" required defaultValue={tpl?.title} className="input" /></div>
      <div><label className="label">التفاصيل (إيه المطلوب بالظبط؟)</label><textarea name="description" rows={2} defaultValue={tpl?.description} className="input" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">النوع</label><select name="category" defaultValue={tpl?.category} className="input">{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">الحجم (النقاط)</label><select name="size" defaultValue={tpl?.size ?? 'small'} className="input">{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">الأولوية</label><select name="priority" defaultValue="p2" className="input">{Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="label">الوحدة (المهمة بتتعرض على أعضائها وكل اللي تحتها)</label>
          <select name="unit_id" required className="input">{units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></div>
        <div><label className="label">العدد المطلوب</label><input name="capacity" type="number" min={1} max={500} defaultValue={1} className="input" /></div>
        <div><label className="label">آخر موعد</label><input name="deadline" type="datetime-local" required defaultValue={tomorrow} className="input" /></div>
      </div>
      <div>
        <span className="label">مهارات مطلوبة (اختياري — اللي معندوش ولا واحدة منها مش هيتعرض عليه)</span>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <label key={s} className="chip cursor-pointer bg-slate-100 py-1 has-[:checked]:bg-brand-100"><input type="checkbox" name="required_skills" value={s} className="hidden" />{s}</label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requires_photo" defaultChecked={tpl?.photo} className="accent-brand-600" /> لازم صورة إثبات</label>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? '...' : 'إنشاء ووزّع تلقائياً'}</button>
    </form>
  );
}

export function TaskCloseButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button className="btn-ghost px-3 py-1" onClick={async () => {
      if (!confirm('قفل المهمة؟ العروض المفتوحة هتتلغي.')) return;
      await createClient().from('tasks').update({ status: 'closed' }).eq('id', id);
      router.refresh();
    }}>قفل</button>
  );
}
