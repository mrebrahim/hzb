'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const CHILD: Record<string, 'governorate' | 'center' | 'unit'> = { national: 'governorate', governorate: 'center', center: 'unit' };

export function UnitForm({ parents }: { parents: { id: string; label: string; type: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parent = parents.find((p) => p.id === f.get('parent_id'));
    if (!parent) return;
    const names = String(f.get('names')).split('\n').map((s) => s.trim()).filter(Boolean);
    const { error } = await createClient().from('units').insert(names.map((name) => ({ name, parent_id: parent.id, type: CHILD[parent.type] })));
    setMsg(error ? error.message : `اتضاف ${names.length}`);
    if (!error) (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="h2">إضافة مراكز/أقسام أو وحدات/قرى</h2>
      <div><label className="label">تحت</label>
        <select name="parent_id" className="input">{parents.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
      <div><label className="label">الأسماء (كل اسم في سطر)</label><textarea name="names" rows={4} required className="input" placeholder={'مدينة نصر\nمصر الجديدة'} /></div>
      <div className="flex items-center gap-3"><button className="btn-primary">إضافة</button>{msg && <span className="text-sm">{msg}</span>}</div>
    </form>
  );
}
