import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { RpcButton } from '@/components/RpcButton';
import { SubmitForm } from '@/components/SubmitForm';
import { MarkRead } from '@/components/MarkRead';
import { Ring } from '@/components/Ring';
import { AcceptButton, CelebrateOnMount } from '@/components/Celebrate';
import { requireProfile } from '@/lib/auth';
import {
  ASSIGNMENT_STATUS, CATEGORIES, CATEGORY_STYLE, LEVELS, type Stats, badges, fmtDate, initials, timeLeft,
} from '@/lib/labels';

type Standing = Stats & {
  unit_peers: number; unit_name: string | null; parent_name: string | null;
  level: { level: number; name: string; floor: number; next: number | null };
};

type Row = {
  id: string; status: string; match_reason: string | null; offer_expires_at: string | null; feedback: string | null;
  tasks: { title: string; description: string | null; category: keyof typeof CATEGORIES; base_points: number;
           deadline: string; requires_photo: boolean; status: string } | null;
};

const WEEKLY_GOAL = 50;

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Africa/Cairo' }).format(new Date()));
  return h < 12 ? 'صباح الخير' : h < 18 ? 'نهارك سعيد' : 'مساء الخير';
}

export default async function Home() {
  const { supabase, profile } = await requireProfile();
  const [{ data: standing }, { data: rows }, { data: notes }, { data: events }, { data: recent }] = await Promise.all([
    supabase.rpc('my_standing').single<Standing>(),
    supabase.from('assignments')
      .select('id,status,match_reason,offer_expires_at,feedback,tasks(title,description,category,base_points,deadline,requires_photo,status)')
      .eq('member_id', profile.id).order('offered_at', { ascending: false }).limit(40).returns<Row[]>(),
    supabase.from('notifications').select('*').is('read_at', null).order('created_at', { ascending: false }).limit(6),
    supabase.from('events').select('id,title,starts_at,ends_at,points,units(name)')
      .gte('ends_at', new Date().toISOString()).order('starts_at').limit(4)
      .returns<{ id: string; title: string; starts_at: string; ends_at: string; points: number; units: { name: string } | null }[]>(),
    supabase.from('point_ledger').select('id,amount,note,created_at').eq('member_id', profile.id).gt('amount', 0)
      .order('created_at', { ascending: false }).limit(5),
  ]);

  const s = standing!;
  const now = Date.now();
  const all = rows ?? [];
  const offers = all.filter((r) => r.status === 'offered' && r.tasks?.status === 'open' && r.offer_expires_at && Date.parse(r.offer_expires_at) > now);
  const active = all.filter((r) => ['accepted', 'rework', 'submitted'].includes(r.status));
  const wins = recent ?? [];
  const lastWin = wins[0] && Date.parse(wins[0].created_at) > Date.now() - 3 * 864e5 ? wins[0] : null;
  const lvl = s.level;
  const progress = lvl.next ? Math.round(((s.total - lvl.floor) / (lvl.next - lvl.floor)) * 100) : 100;
  const weekPct = Math.min(100, Math.round((s.points_week / WEEKLY_GOAL) * 100));
  const myBadges = badges(s);
  const unlocked = myBadges.filter((b) => b.on).length;
  const nextLevel = LEVELS.find((l) => l.level === lvl.level + 1);
  const staff = profile.role !== 'member';
  const first = profile.full_name.split(' ')[0];
  const trendUp = s.points_30 >= s.points_prev_30;

  return (
    <>
      <Nav staff={staff} unread={notes?.length ?? 0} />
      {lastWin && <CelebrateOnMount keyId={`win:${lastWin.id}`} />}
      <CelebrateOnMount keyId={`level:${profile.id}:${lvl.level}`} big={lvl.level > 1} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-4">
        {/* ── البطاقة الرئيسية ── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-brand-600 to-teal-500 p-5 text-white shadow-xl shadow-emerald-200">
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-56 w-56 rounded-full bg-yellow-300/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-5">
            <Ring pct={progress} size={124}>
              <div>
                <p className="text-3xl">{LEVELS[lvl.level - 1]?.emoji}</p>
                <p className="text-xs font-semibold opacity-90">مستوى {lvl.level}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-sm opacity-90">{greeting()} يا {first} 👋</p>
              <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight">{lvl.name}</h1>
              <p className="mt-1 text-sm opacity-90">
                <b className="text-yellow-200">{s.total}</b> نقطة
                {lvl.next ? <> • فاضلك <b className="text-yellow-200">{lvl.next - s.total}</b> نقطة وتبقى <b>{nextLevel?.name}</b></> : ' • وصلت لأعلى مستوى 👑'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {s.streak_weeks > 0 && <span className="rounded-full bg-orange-500/90 px-3 py-1 shadow">🔥 {s.streak_weeks} أسابيع ورا بعض</span>}
                {s.unit_rank && <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">🏆 {s.unit_name} رقم {s.unit_rank} من {s.unit_siblings} في {s.parent_name}</span>}
                {s.percentile_in_unit != null && <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">⭐ أحسن من {s.percentile_in_unit}% من وحدتك</span>}
              </div>
            </div>
          </div>
          {nextLevel && (
            <div className="relative mt-4 rounded-2xl bg-black/15 p-3 text-sm backdrop-blur">
              🎁 <b>اللي مستنيك في &quot;{nextLevel.name}&quot;:</b> {nextLevel.perk}
            </div>
          )}
        </section>

        {/* ── أرقامي ── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['💰', s.points_30, 'نقطة آخر 30 يوم', trendUp ? `↑ ${s.points_30 - s.points_prev_30} عن الشهر اللي فات` : 'الشهر ده لسه في إيدك'],
            ['✅', s.approved_total, 'مهمة اتعتمدت', ''],
            ['📍', s.attendance_total, 'فعالية حضرتها', ''],
            ['🏅', `${unlocked}/${myBadges.length}`, 'شارة', ''],
          ].map(([e, v, l, sub]) => (
            <div key={String(l)} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="text-2xl">{e}</p>
              <p className="mt-1 text-2xl font-extrabold">{v}</p>
              <p className="text-xs text-gray-500">{l}</p>
              {sub && <p className="mt-1 text-[11px] font-semibold text-emerald-600">{sub}</p>}
            </div>
          ))}
        </section>

        {/* ── هدف الأسبوع ── */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">🎯 هدف الأسبوع</h2>
            <span className="text-sm font-bold text-brand-700">{s.points_week} / {WEEKLY_GOAL}</span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-l from-amber-400 via-orange-400 to-rose-400 transition-all" style={{ width: `${Math.max(weekPct, 3)}%` }} />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {weekPct >= 100 ? '🎉 حققت هدف الأسبوع! إنت من أبطال وحدتك.'
              : s.points_week === 0 ? `أسبوع جديد بدأ 💪 مهمة واحدة تحافظ على السلسلة${s.streak_weeks ? ` (${s.streak_weeks} أسابيع)` : ''}.`
              : `فاضلك ${WEEKLY_GOAL - s.points_week} نقطة — مهمة كمان وتوصل!`}
          </p>
        </section>

        {/* ── الإشعارات ── */}
        {(notes?.length ?? 0) > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">🔔 جديد ليك</h2><MarkRead /></div>
            <div className="space-y-2">
              {notes!.map((n) => (
                <div key={n.id} className="rounded-xl bg-gradient-to-l from-gray-50 to-white p-3 text-sm ring-1 ring-gray-100">
                  <p className="font-semibold">{n.title}</p>
                  {n.body && <p className="whitespace-pre-line text-gray-600">{n.body}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── المهمات المتاحة ── */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-extrabold">⚡ مهمات مستنياك</h2>
            {offers.length > 0 && <span className="text-xs text-gray-500">اخترناها مخصوص ليك</span>}
          </div>
          {offers.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              مفيش مهمات جديدة دلوقتي 🌙 — أول ما تنزل مهمة تناسبك هتظهر هنا. <Link href="/profile" className="font-semibold text-brand-700">حدّث مهاراتك وأيامك</Link> عشان توصلك فرص أكتر.
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {offers.map((o) => {
              const st = CATEGORY_STYLE[o.tasks!.category];
              const pts = Math.round(o.tasks!.base_points * 1.1);
              return (
                <article key={o.id} className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className={`flex items-center justify-between bg-gradient-to-l ${st.grad} px-4 py-3 text-white`}>
                    <span className="text-sm font-semibold">{st.emoji} {CATEGORIES[o.tasks!.category]}</span>
                    <span className="rounded-full bg-white/25 px-3 py-1 text-sm font-extrabold backdrop-blur">+{pts} نقطة</span>
                  </div>
                  <div className="space-y-3 p-4">
                    <h3 className="text-lg font-bold leading-snug">{o.tasks!.title}</h3>
                    {o.tasks!.description && <p className="text-sm text-gray-600">{o.tasks!.description}</p>}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1">⏰ الموعد: {fmtDate(o.tasks!.deadline)}</span>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">⌛ العرض متاح {timeLeft(o.offer_expires_at!)}</span>
                    </div>
                    {o.match_reason && (
                      <div className="rounded-2xl bg-brand-50 p-3 text-xs text-brand-900">
                        <p className="mb-1 font-bold">✨ ليه إنت بالذات؟</p>
                        <div className="flex flex-wrap gap-1.5">
                          {o.match_reason.split(' • ').map((r) => <span key={r} className="rounded-full bg-white px-2 py-0.5 ring-1 ring-brand-100">{r}</span>)}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <AcceptButton id={o.id} points={pts} />
                      <RpcButton fn="decline_assignment" args={{ p_id: o.id }} label="مش المرة دي" className="btn-ghost" />
                    </div>
                    <p className="text-[11px] text-gray-400">الاعتذار مش بيخصم أي نقاط 🙏</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── قيد التنفيذ ── */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold">🏃 شغّال عليها</h2>
            {active.map((a) => {
              const st = CATEGORY_STYLE[a.tasks!.category];
              const urgent = Date.parse(a.tasks!.deadline) - now < 36 * 3600e3;
              return (
                <article key={a.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${st.grad} text-xl`}>{st.emoji}</span>
                      <div>
                        <h3 className="font-bold">{a.tasks!.title}</h3>
                        <p className={`text-xs ${urgent ? 'font-bold text-rose-600' : 'text-gray-500'}`}>
                          {urgent ? '🔥 فاضل ' : '⏰ فاضل '}{timeLeft(a.tasks!.deadline)}
                        </p>
                      </div>
                    </div>
                    <span className={`chip ${a.status === 'submitted' ? 'bg-sky-100 text-sky-800' : a.status === 'rework' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {a.status === 'submitted' ? '⏳ مستنية مراجعة' : ASSIGNMENT_STATUS[a.status]}
                    </span>
                  </div>
                  {a.status === 'rework' && a.feedback && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">💬 ملاحظة الأمين: {a.feedback}</p>}
                  {a.status !== 'submitted' && (
                    <div className="mt-3 space-y-2">
                      <SubmitForm assignmentId={a.id} memberId={profile.id} requiresPhoto={!!a.tasks?.requires_photo} />
                      <RpcButton fn="withdraw_assignment" args={{ p_id: a.id }} label="مش هقدر أكمّل"
                        className="text-xs text-gray-400 underline" confirm="متأكد؟ النظام هيدوّر على بديل." />
                    </div>
                  )}
                  {a.status === 'submitted' && <p className="mt-3 text-sm text-gray-500">تقريرك وصل 👌 أول ما الأمين يعتمده النقاط هتنزل عندك.</p>}
                </article>
              );
            })}
          </section>
        )}

        {/* ── الشارات ── */}
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">🏅 شاراتي</h2>
            <span className="text-sm text-gray-500">{unlocked} من {myBadges.length}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {myBadges.map((b) => (
              <div key={b.name} title={b.on ? b.name : `اللي يفتحها: ${b.need}`}
                className={`flex flex-col items-center rounded-2xl p-2 text-center ${b.on ? 'bg-gradient-to-b from-amber-50 to-yellow-100 ring-1 ring-amber-200' : 'bg-gray-50 opacity-60 grayscale'}`}>
                <span className="text-3xl">{b.emoji}</span>
                <span className="mt-1 text-[11px] font-bold leading-tight">{b.name}</span>
                {!b.on && <span className="mt-0.5 text-[10px] leading-tight text-gray-500">🔒 {b.need}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ── سلّم الترقي ── */}
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 text-lg font-extrabold">🪜 طريقك في التنظيم</h2>
          <ol className="space-y-2">
            {LEVELS.map((l) => {
              const done = lvl.level > l.level, cur = lvl.level === l.level;
              return (
                <li key={l.level} className={`flex items-center gap-3 rounded-2xl p-3 ${cur ? 'bg-brand-50 ring-2 ring-brand-500' : done ? 'bg-emerald-50/60' : 'bg-gray-50'}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl ${done || cur ? 'bg-white shadow' : 'bg-gray-200 grayscale'}`}>{done ? '✅' : l.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{l.name} <span className="text-xs font-normal text-gray-500">({l.floor}+ نقطة)</span>{cur && <span className="mr-2 chip bg-brand-600 text-white">إنت هنا</span>}</p>
                    <p className="text-xs text-gray-600">{l.perk}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {(events?.length ?? 0) > 0 && (
            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-2 text-lg font-extrabold">📅 فعاليات جاية</h2>
              {events!.map((e) => {
                const live = Date.parse(e.starts_at) - 30 * 60e3 < now && Date.parse(e.ends_at) > now;
                return (
                  <div key={e.id} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm last:border-0">
                    <span>{live && <span className="ml-1 chip animate-pulse bg-rose-500 text-white">مباشر</span>}{e.title}<span className="block text-xs text-gray-500">{e.units?.name} • {fmtDate(e.starts_at)}</span></span>
                    <span className="chip bg-amber-100 font-bold text-amber-800">+{e.points}</span>
                  </div>
                );
              })}
              <p className="mt-2 text-xs text-gray-500">📱 في الفعالية: امسح الـ QR اللي على الشاشة بكاميرا موبايلك.</p>
            </section>
          )}
          {wins.length > 0 && (
            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-2 text-lg font-extrabold">🎉 آخر انتصاراتك</h2>
              {wins.map((h) => (
                <div key={h.id} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm last:border-0">
                  <span>✨ {h.note}<span className="block text-xs text-gray-400">{fmtDate(h.created_at)}</span></span>
                  <span className="font-bold text-emerald-600">+{h.amount}</span>
                </div>
              ))}
              <Link href="/certificate" className="mt-3 inline-block text-sm font-semibold text-brand-700">🖨️ اطبع شهادة مستواك</Link>
            </section>
          )}
        </div>
        <p className="pb-6 text-center text-xs text-gray-400">{initials(profile.full_name)} • {profile.units?.name}</p>
      </main>
    </>
  );
}
