'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ROLES } from '@/lib/labels';

type Props = {
  member: { id: string; role: string; unit_id: string | null; activity_status: string };
  units: { id: string; label: string }[];
  isAdmin: boolean;
  self: boolean;
};

export function MemberRoleForm({ member, units, isAdmin, self }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <button className="text-xs text-navy-700" onClick={() => setOpen(true)}>{ROLES[member.role as keyof typeof ROLES]} ✎</button>;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const supabase = createClient();
    const unit = String(f.get('unit_id') || '') || null;
    const status = String(f.get('status'));
    const { error } = isAdmin
      ? await supabase.rpc('set_member_role', { p_member: member.id, p_role: f.get('role'), p_unit: unit })
      : await supabase.from('profiles').update({ unit_id: unit }).eq('id', member.id);
    if (error) return setErr(error.message);
    if (status !== member.activity_status) {
      const r = await supabase.from('profiles').update({ activity_status: status }).eq('id', member.id);
      if (r.error) return setErr(r.error.message);
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="w-56 space-y-1">
      {isAdmin && (
        <select name="role" defaultValue={member.role} disabled={self} className="input py-1 text-xs">
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      )}
      <select name="unit_id" defaultValue={member.unit_id ?? ''} className="input py-1 text-xs">
        <option value="">بدون وحدة</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
      <select name="status" defaultValue={member.activity_status} className="input py-1 text-xs">
        <option value="active">نشط</option><option value="slowing">نشاطه بيقل</option>
        <option value="dormant">خامل</option><option value="suspended">موقوف</option>
      </select>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-1"><button className="btn-primary px-2 py-1 text-xs">حفظ</button>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setOpen(false)}>إلغاء</button></div>
    </form>
  );
}
