import { Nav } from '@/components/Nav';
import { ProfileForm } from '@/components/ProfileForm';
import { PrivacyCenter } from '@/components/PrivacyCenter';
import { requireProfile } from '@/lib/auth';
import { fmtDate } from '@/lib/labels';

export default async function ProfilePage() {
  const { supabase, profile } = await requireProfile();
  const [{ data: consents }, { data: ledger }] = await Promise.all([
    supabase.from('consents').select('purpose,granted,recorded_at').eq('member_id', profile.id).order('recorded_at', { ascending: false }),
    supabase.from('point_ledger').select('id,amount,reason_code,note,created_at').eq('member_id', profile.id)
      .order('created_at', { ascending: false }).limit(30),
  ]);
  const latest: Record<string, boolean> = {};
  for (const c of consents ?? []) if (!(c.purpose in latest)) latest[c.purpose] = c.granted;

  return (
    <>
      <Nav staff={profile.role !== 'member'} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <ProfileForm profile={profile} />
        <PrivacyCenter consents={latest} />
        <section className="card space-y-2">
          <h2 className="h2">سجل نقاطك</h2>
          <p className="muted">كل نقطة ليها سبب ومصدر، ومحدش يقدر يعدّلها — أي تصحيح بيظهر كحركة منفصلة.</p>
          {(ledger ?? []).length === 0 && <p className="muted">لسه مفيش نقاط.</p>}
          {(ledger ?? []).map((l) => (
            <div key={l.id} className="flex justify-between border-b border-gray-50 py-1 text-sm">
              <span>{l.note ?? l.reason_code}</span>
              <span className="flex gap-3">
                <span className="muted">{fmtDate(l.created_at)}</span>
                <b className={l.amount > 0 ? 'text-emerald-700' : 'text-rose-600'}>{l.amount > 0 ? '+' : ''}{l.amount}</b>
              </span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
