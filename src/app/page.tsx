import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { RpcButton } from '@/components/RpcButton';
import { SubmitForm } from '@/components/SubmitForm';
import { MarkRead } from '@/components/MarkRead';
import { requireProfile } from '@/lib/auth';
import { ASSIGNMENT_STATUS, CATEGORIES, fmtDate } from '@/lib/labels';

type Standing = {
  total: number; points_30: number; points_prev_30: number; unit_peers: number;
  percentile_in_unit: number | null;
  level: { level: number; name: string; floor: number; next: number | null };
};

type Row = {
  id: string; status: string; match_reason: string | null; offer_expires_at: string | null;
  feedback: string | null;
  tasks: { title: string; description: string | null; category: keyof typeof CATEGORIES; base_points: number;
           deadline: string; requires_photo: boolean; status: string } | null;
};

export default async function Home() {
  const { supabase, profile } = await requireProfile();
  const [{ data: standing }, { data: rows }, { data: notes }, { data: events }] = await Promise.all([
    supabase.rpc('my_standing').single<Standing>(),
    supabase.from('assignments')
      .select('id,status,match_reason,offer_expires_at,feedback,tasks(title,description,category,base_points,deadline,requires_photo,status)')
      .eq('member_id', profile.id).order('offered_at', { ascending: false }).limit(40).returns<Row[]>(),
    supabase.from('notifications').select('*').is('read_at', null).order('created_at', { ascending: false }).limit(8),
    supabase.from('events').select('id,title,starts_at,points,units(name)')
      .gte('ends_at', new Date().toISOString()).order('starts_at').limit(5)
      .returns<{ id: string; title: string; starts_at: string; points: number; units: { name: string } | null }[]>(),
  ]);

  const now = Date.now();
  const offers = (rows ?? []).filter((r) => r.status === 'offered' && r.tasks?.status === 'open' && r.offer_expires_at && Date.parse(r.offer_expires_at) > now);
  const active = (rows ?? []).filter((r) => ['accepted', 'rework', 'submitted'].includes(r.status));
  const history = (rows ?? []).filter((r) => ['approved', 'rejected'].includes(r.status)).slice(0, 6);
  const s = standing;
  const progress = s && s.level.next ? Math.min(100, Math.round(((s.total - s.level.floor) / (s.level.next - s.level.floor)) * 100)) : 100;
  const staff = profile.role !== 'member';

  return (
    <>
      <Nav staff={staff} unread={notes?.length ?? 0} />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <section className="card bg-gradient-to-l from-brand-600 to-brand-700 text-white">
          <p className="text-sm opacity-90">أهلاً {profile.full_name} — {profile.units?.name ?? 'لسه ما اتحددتش وحدتك'}</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold">{s?.level.name}</p>
              <p className="text-sm opacity-90">
                {s?.total ?? 0} نقطة{s?.level.next ? ` • فاضلك ${s.level.next - s.total} للمستوى الجاي` : ' • أعلى مستوى'}
              </p>
            </div>
            <div className="text-left text-sm">
              <p>آخر 30 يوم: <b>{s?.points_30 ?? 0}</b> نقطة</p>
              {s?.percentile_in_unit != null && <p>أحسن من {s.percentile_in_unit}% من وحدتك</p>}
              {s && s.points_prev_30 > 0 && (
                <p>{s.points_30 >= s.points_prev_30 ? '↑ أحسن من الشهر اللي فات' : '↓ أقل من الشهر اللي فات'}</p>
              )}
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/25"><div className="h-2 rounded-full bg-white" style={{ width: `${progress}%` }} /></div>
          <Link href="/certificate" className="mt-3 inline-block text-xs underline opacity-90">اطبع شهادة مستواك</Link>
        </section>

        {(notes?.length ?? 0) > 0 && (
          <section className="card space-y-2">
            <div className="flex items-center justify-between"><h2 className="h2">إشعارات جديدة</h2><MarkRead /></div>
            {notes!.map((n) => (
              <div key={n.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="whitespace-pre-line text-gray-600">{n.body}</p>}
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="h2">فرص مناسبة ليك</h2>
          {offers.length === 0 && <p className="card muted">مفيش عروض دلوقتي. لما تنزل مهمة تناسبك هتلاقيها هنا.</p>}
          {offers.map((o) => (
            <article key={o.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{o.tasks?.title}</h3>
                <span className="chip bg-brand-50 text-brand-700">{o.tasks?.base_points} نقطة عند الاعتماد</span>
              </div>
              {o.tasks?.description && <p className="text-sm text-gray-600">{o.tasks.description}</p>}
              <p className="muted">{o.tasks && CATEGORIES[o.tasks.category]} • الموعد: {fmtDate(o.tasks?.deadline)} • العرض متاح لحد {fmtDate(o.offer_expires_at)}</p>
              {o.match_reason && <p className="rounded-xl bg-brand-50 p-2 text-xs text-brand-900">ليه إنت؟ {o.match_reason}</p>}
              <div className="flex gap-2">
                <RpcButton fn="accept_assignment" args={{ p_id: o.id }} label="أقبل المهمة" />
                <RpcButton fn="decline_assignment" args={{ p_id: o.id }} label="أعتذر (من غير خصم)" className="btn-ghost" />
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="h2">مهامي الحالية</h2>
          {active.length === 0 && <p className="card muted">مفيش مهام قيد التنفيذ.</p>}
          {active.map((a) => (
            <article key={a.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{a.tasks?.title}</h3>
                <span className="chip bg-gray-100 text-gray-700">{ASSIGNMENT_STATUS[a.status]}</span>
              </div>
              <p className="muted">الموعد: {fmtDate(a.tasks?.deadline)}</p>
              {a.status === 'rework' && a.feedback && <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-900">ملاحظة المنسق: {a.feedback}</p>}
              {a.status !== 'submitted' && (
                <>
                  <SubmitForm assignmentId={a.id} memberId={profile.id} requiresPhoto={!!a.tasks?.requires_photo} />
                  <RpcButton fn="withdraw_assignment" args={{ p_id: a.id }} label="مش هقدر أكمّل"
                    className="text-xs text-gray-500 underline" confirm="متأكد؟ النظام هيدوّر على بديل." />
                </>
              )}
            </article>
          ))}
        </section>

        {(events?.length ?? 0) > 0 && (
          <section className="card space-y-2">
            <h2 className="h2">فعاليات جاية</h2>
            {events!.map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span>{e.title} <span className="muted">— {e.units?.name}</span></span>
                <span className="muted">{fmtDate(e.starts_at)} • {e.points} نقطة حضور</span>
              </div>
            ))}
            <p className="muted text-xs">في الفعالية: امسح الـ QR اللي على الشاشة بكاميرا موبايلك.</p>
          </section>
        )}

        {history.length > 0 && (
          <section className="card space-y-2">
            <h2 className="h2">آخر إنجازاتك</h2>
            {history.map((h) => (
              <div key={h.id} className="flex justify-between text-sm">
                <span>{h.tasks?.title}</span>
                <span className={h.status === 'approved' ? 'text-emerald-700' : 'text-rose-600'}>{ASSIGNMENT_STATUS[h.status]}</span>
              </div>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
