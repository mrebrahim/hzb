'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/auth';
import { DAYS, MOTIVATIONS, SKILLS } from '@/lib/labels';

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await createClient().from('profiles').update({
      full_name: String(f.get('full_name')),
      phone: String(f.get('phone') || '') || null,
      motivations: f.getAll('motivations'),
      skills: f.getAll('skills'),
      available_days: f.getAll('available_days').map(Number),
      weekly_hours: Number(f.get('weekly_hours') || 3),
      max_open_tasks: Number(f.get('max_open_tasks') || 3),
    }).eq('id', profile.id);
    setMsg(error ? error.message : 'اتحفظ ✓');
    router.refresh();
  }

  const chip = 'chip cursor-pointer gap-1 bg-gray-100 py-1 text-gray-700 has-[:checked]:bg-brand-100 has-[:checked]:text-brand-900';
  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="h2">بياناتي وتفضيلاتي</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">الاسم</label><input name="full_name" defaultValue={profile.full_name} required className="input" /></div>
        <div><label className="label">الموبايل</label><input name="phone" defaultValue={profile.phone ?? ''} className="input" dir="ltr" /></div>
      </div>
      <p className="muted">الوحدة: {profile.units?.name ?? '—'} (تغييرها عن طريق المنسق)</p>
      <div>
        <span className="label">دوافعك</span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(MOTIVATIONS).map(([k, v]) => (
            <label key={k} className={chip}><input type="checkbox" name="motivations" value={k} defaultChecked={profile.motivations.includes(k)} className="hidden" />{v}</label>
          ))}
        </div>
      </div>
      <div>
        <span className="label">مهاراتك</span>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <label key={s} className={chip}><input type="checkbox" name="skills" value={s} defaultChecked={profile.skills.includes(s)} className="hidden" />{s}</label>
          ))}
        </div>
      </div>
      <div>
        <span className="label">الأيام المتاحة</span>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className={chip}><input type="checkbox" name="available_days" value={i} defaultChecked={profile.available_days.includes(i)} className="hidden" />{d}</label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <div><label className="label">ساعات/أسبوع</label><input name="weekly_hours" type="number" min={0} max={40} defaultValue={profile.weekly_hours} className="input w-24" /></div>
        <div>
          <label className="label">أقصى عدد مهام مفتوحة في نفس الوقت</label>
          <input name="max_open_tasks" type="number" min={1} max={10} defaultValue={profile.max_open_tasks} className="input w-24" />
          <p className="muted mt-1 text-xs">النظام مش هيعرض عليك أكتر من كده — الاستمرارية أهم من الكمية.</p>
        </div>
      </div>
      <div className="flex items-center gap-3"><button className="btn-primary">حفظ</button>{msg && <span className="text-sm text-emerald-700">{msg}</span>}</div>
    </form>
  );
}
