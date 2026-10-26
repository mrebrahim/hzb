import type { SupabaseClient } from '@supabase/supabase-js';

export type ScopeUnit = { id: string; name: string; type: string; parent_id: string | null; label: string };

// كل الوحدات اللي في نطاق المستخدم، مع اسم كامل (المحافظة › المركز › الوحدة)
export async function getScopeUnits(supabase: SupabaseClient): Promise<ScopeUnit[]> {
  const { data: root } = await supabase.rpc('scope_root');
  if (!root) return [];
  const [{ data: closure }, { data: units }] = await Promise.all([
    supabase.from('unit_closure').select('descendant_id').eq('ancestor_id', root),
    supabase.from('units').select('id,name,type,parent_id'),
  ]);
  const byId = new Map((units ?? []).map((u) => [u.id, u]));
  const label = (id: string): string => {
    const u = byId.get(id);
    if (!u) return '';
    if (!u.parent_id || u.type === 'national' || u.id === root) return u.name;
    const p = byId.get(u.parent_id);
    return p && p.type !== 'national' ? `${label(u.parent_id)} › ${u.name}` : u.name;
  };
  return (closure ?? [])
    .map((c) => byId.get(c.descendant_id))
    .filter(Boolean)
    .map((u) => ({ ...u!, label: label(u!.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}
