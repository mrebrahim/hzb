import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { RpcButton } from '@/components/RpcButton';
import { SubmitForm } from '@/components/SubmitForm';
import { MarkRead } from '@/components/MarkRead';
import { Ring } from '@/components/Ring';
import { Icon } from '@/components/Icon';
import { requireProfile } from '@/lib/auth';
import {
  CATEGORIES, CATEGORY_STYLE, LEVELS, ROLES, type Stats, fmtDate, rating, recognitions, timeLeft,
} from '@/lib/labels';

type Standing = Stats & {
  unit_peers: number; unit_name: string | null; parent_name: string | null;
  level: { level: number; name: string; floor: number; next: number | null };
};
type Account = { reliability: number; overdue: number; accepted_total: number };
type Row = {
  id: string; status: string; match_reason: string | null; offer_expires_at: string | null; feedback: string | null;
  tasks: { title: string; description: string | null; category: keyof typeof CATEGORIES; base_points: number;
           deadline: string; requires_photo: boolean; status: string } | null;
};

const WEEKLY_TARGET = 50;

export default async function Home() {
  const { supabase, profile } = await requireProfile();
  const [{ data: standing }, { data: acc }, { data: rows }, { data: notes }, { data: events }, { data: recent }] = await Promise.all([
    supabase.rpc('my_standing').single<Standing>(),
    supabase.rpc('my_accountability').single<Account>(),
    supabase.from('assignments')
      .select('id,status,match_reason,offer_expires_at,feedback,tasks(title,description,category,base_points,deadline,requires_photo,status)')
      .eq('member_id', profile.id).order('offered_at', { ascending: false }).limit(40).returns<Row[]>(),
    supabase.from('notifications').select('*').is('read_at', null).order('created_at', { ascending: false }).limit(6),
    supabase.from('events').select('id,title,starts_at,ends_at,points,units(name)')
      .gte('ends_at', new Date().toISOString()).order('starts_at').limit(4)
      .returns<{ id: string; title: string; starts_at: string; ends_at: string; points: number; units: { name: string } | null }[]>(),
    supabase.from('point_ledger').select('id,amount,note,created_at').eq('member_id', profile.id)
      .order('created_at', { ascending: false }).limit(6),
  ]);

  const s = standing!;
  const a = acc ?? { reliability: 0.7, overdue: 0, accepted_total: 0 };
  const now = Date.now();
  const all = rows ?? [];
  const offers = all.filter((r) => r.status === 'offered' && r.tasks?.status === 'open' && r.offer_expires_at && Date.parse(r.offer_expires_at) > now);
  const active = all.filter((r) => ['accepted', 'rework', 'submitted'].includes(r.status))
    .sort((x, y) => Date.parse(x.tasks!.deadline) - Date.parse(y.tasks!.deadline));
  const lvl = s.level;
  const progress = lvl.next ? Math.round(((s.total - lvl.floor) / (lvl.next - lvl.floor)) * 100) : 100;
  const weekPct = Math.min(100, Math.round((s.points_week / WEEKLY_TARGET) * 100));
  const certs = recognitions(s);
  const nextLevel = LEVELS.find((l) => l.level === lvl.level + 1);
  const rate = rating(s.points_30);
  const commit = Math.round(a.reliability * 100);
  const today = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date());

  return (
    <>
      <Nav staff={profile.role !== 'member'} unread={notes?.length ?? 0} />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {/* ── بطاقة العضو ── */}
        <section className="overflow-hidden rounded-lg bg-navy-800 text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-2 text-xs text-navy-100">
            <span>بطاقة الأداء التنظيمي</span><span>{today}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 p-5">
            <Ring pct={progress} size={118}>
              <div>
                <p className="text-2xl font-bold">{s.total}</p>
                <p className="text-[11px] text-navy-100">نقطة</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-navy-100">{ROLES[profile.role]} • {s.unit_name ?? 'لم تُحدد الوحدة'}{s.parent_name ? ` — ${s.parent_name}` : ''}</p>
              <h1 className="mt-0.5 text-2xl font-bold">{profile.full_name}</h1>
              <p className="mt-1 text-sm">
                المستوى التنظيمي: <b className="text-gold-400">{lvl.name}</b>
                {lvl.next && <span className="text-navy-100"> — متبقٍ {lvl.next - s.total} نقطة للترقي إلى «{nextLevel?.name}»</span>}
              </p>
              {nextLevel && <p className="mt-1 text-xs text-navy-100">عند الترقي: {nextLevel.perk}</p>}
            </div>
            <div className="text-center">
              <p className="text-xs text-navy-100">التقييم الشهري</p>
              <p className={`mt-1 rounded px-3 py-1 text-sm font-bold ${rate.cls}`}>{rate.label}</p>
            </div>
          </div>
        </section>

        {/* ── تنبيه المتأخرات ── */}
        {a.overdue > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
            <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold">لديك {a.overdue} تكليف تجاوز الموعد المحدد</p>
              <p>تم إخطار الأمين المختص تلقائياً. يُرجى تسليم التقرير أو الاعتذار فوراً حفاظاً على نسبة التزامك.</p>
            </div>
          </div>
        )}

        {/* ── مؤشرات الأداء ── */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: 'shield', label: 'نسبة الالتزام', value: `${commit}%`, sub: commit >= 90 ? 'التزام مرتفع' : commit >= 70 ? 'التزام مقبول' : 'أقل من المطلوب', warn: commit < 70 },
            { icon: 'chart', label: 'رصيد آخر 30 يوماً', value: s.points_30, sub: s.points_30 >= s.points_prev_30 ? `+${s.points_30 - s.points_prev_30} عن الشهر السابق` : `${s.points_30 - s.points_prev_30} عن الشهر السابق`, warn: s.points_30 < s.points_prev_30 },
            { icon: 'trend', label: 'الترتيب داخل الوحدة', value: s.percentile_in_unit != null ? `أعلى من ${s.percentile_in_unit}%` : '—', sub: `من ${s.unit_peers} عضو` },
            { icon: 'layers', label: 'ترتيب وحدتك', value: s.unit_rank ? `${s.unit_rank} من ${s.unit_siblings}` : '—', sub: s.parent_name ? `على مستوى ${s.parent_name}` : '' },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-500"><Icon name={k.icon} className="h-4 w-4" /><span className="stat-label">{k.label}</span></div>
              <p className="mt-2 text-2xl font-bold text-navy-800">{k.value}</p>
              <p className={`mt-0.5 text-xs ${k.warn ? 'font-semibold text-red-700' : 'text-slate-500'}`}>{k.sub}</p>
            </div>
          ))}
        </section>

        {/* ── المستهدف الأسبوعي ── */}
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Icon name="target" className="h-5 w-5 text-navy-600" /><h2 className="section-title">المستهدف الأسبوعي</h2></div>
            <span className="text-sm font-bold text-navy-800">{s.points_week} من {WEEKLY_TARGET} نقطة</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${weekPct >= 100 ? 'bg-brand-600' : 'bg-navy-600'}`} style={{ width: `${Math.max(weekPct, 2)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-600">
            <span>{weekPct >= 100 ? 'تم تحقيق المستهدف الأسبوعي.' : `متبقٍ ${WEEKLY_TARGET - s.points_week} نقطة لتحقيق المستهدف.`}</span>
            <span>الانتظام: {s.streak_weeks} أسبوع متتالٍ</span>
          </div>
        </section>

        {(notes?.length ?? 0) > 0 && (
          <section className="card">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon name="bell" className="h-5 w-5 text-navy-600" /><h2 className="section-title">إشعارات جديدة</h2></div>
              <MarkRead />
            </div>
            <div className="divide-y divide-slate-100">
              {notes!.map((n) => (
                <div key={n.id} className="py-2 text-sm">
                  <p className="font-semibold text-navy-800">{n.title}</p>
                  {n.body && <p className="whitespace-pre-line text-slate-600">{n.body}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── تكليفات بانتظار الرد ── */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="section-title text-lg">تكليفات بانتظار ردك</h2>
            {offers.length > 0 && <span className="text-xs text-slate-500">يُرجى الرد قبل انتهاء المهلة</span>}
          </div>
          {offers.length === 0 && <p className="card text-sm text-slate-500">لا توجد تكليفات جديدة حالياً. تأكد من تحديث مهاراتك وأيام إتاحتك من <Link href="/profile" className="font-semibold text-navy-700 underline">ملفك الشخصي</Link>.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {offers.map((o) => {
              const st = CATEGORY_STYLE[o.tasks!.category];
              const pts = Math.round(o.tasks!.base_points * 1.1);
              const hrs = (Date.parse(o.offer_expires_at!) - now) / 3600e3;
              return (
                <article key={o.id} className={`rounded-lg border border-slate-200 border-r-4 ${st.accent} bg-white`}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Icon name={st.icon} className="h-4 w-4" />{CATEGORIES[o.tasks!.category]}</span>
                    <span className="rounded bg-gold-50 px-2 py-0.5 text-xs font-bold text-gold-600 ring-1 ring-gold-100">{pts} نقطة عند الاعتماد</span>
                  </div>
                  <div className="space-y-3 p-4">
                    <h3 className="text-base font-bold leading-snug text-navy-800">{o.tasks!.title}</h3>
                    {o.tasks!.description && <p className="text-sm text-slate-600">{o.tasks!.description}</p>}
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-slate-50 p-2"><dt className="text-slate-500">موعد التسليم</dt><dd className="font-semibold">{fmtDate(o.tasks!.deadline)}</dd></div>
                      <div className={`rounded p-2 ${hrs < 6 ? 'bg-red-50 text-red-800' : 'bg-slate-50'}`}><dt className="opacity-70">مهلة الرد</dt><dd className="font-semibold">{timeLeft(o.offer_expires_at!)}</dd></div>
                    </dl>
                    {o.match_reason && <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">أسباب الترشيح: </span>{o.match_reason.split(' • ').join('، ')}</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <RpcButton fn="accept_assignment" args={{ p_id: o.id }} label="قبول التكليف" doneMessage="تم تسجيل قبولك للتكليف" />
                      <RpcButton fn="decline_assignment" args={{ p_id: o.id }} label="اعتذار" className="btn-ghost" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── التكليفات الجارية ── */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title text-lg">التكليفات الجارية</h2>
            {active.map((x) => {
              const late = Date.parse(x.tasks!.deadline) < now && x.status !== 'submitted';
              const soon = !late && Date.parse(x.tasks!.deadline) - now < 36 * 3600e3;
              return (
                <article key={x.id} className={`rounded-lg border bg-white p-4 ${late ? 'border-red-300' : 'border-slate-200'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-navy-800">{x.tasks!.title}</h3>
                      <p className={`mt-0.5 flex items-center gap-1 text-xs ${late ? 'font-bold text-red-700' : soon ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                        <Icon name="clock" className="h-3.5 w-3.5" />
                        {late ? `متأخر — كان الموعد ${fmtDate(x.tasks!.deadline)}` : `المتبقي: ${timeLeft(x.tasks!.deadline)} (${fmtDate(x.tasks!.deadline)})`}
                      </p>
                    </div>
                    <span className={`chip ${x.status === 'submitted' ? 'bg-navy-100 text-navy-800' : x.status === 'rework' ? 'bg-amber-100 text-amber-900' : late ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-900'}`}>
                      {x.status === 'submitted' ? 'قيد المراجعة' : x.status === 'rework' ? 'مطلوب استكمال' : late ? 'متأخر' : 'قيد التنفيذ'}
                    </span>
                  </div>
                  {x.status === 'rework' && x.feedback && <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">ملاحظة الأمين: {x.feedback}</p>}
                  {x.status !== 'submitted' ? (
                    <div className="mt-3 space-y-2">
                      <SubmitForm assignmentId={x.id} memberId={profile.id} requiresPhoto={!!x.tasks?.requires_photo} />
                      <RpcButton fn="withdraw_assignment" args={{ p_id: x.id }} label="تعذّر الاستكمال"
                        className="text-xs text-slate-500 underline" confirm="سيتم تسجيل الاعتذار وإسناد التكليف لعضو آخر. هل أنت متأكد؟" />
                    </div>
                  ) : <p className="mt-2 text-sm text-slate-500">تم استلام تقريرك، وستُضاف النقاط فور اعتماده من الأمين المختص.</p>}
                </article>
              );
            })}
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* ── المسار التنظيمي ── */}
          <section className="card">
            <div className="mb-3 flex items-center gap-2"><Icon name="layers" className="h-5 w-5 text-navy-600" /><h2 className="section-title">المسار التنظيمي</h2></div>
            <ol className="relative space-y-3 border-r-2 border-slate-200 pr-5">
              {LEVELS.map((l) => {
                const done = lvl.level > l.level, cur = lvl.level === l.level;
                return (
                  <li key={l.level} className="relative">
                    <span className={`absolute -right-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 ${done ? 'border-brand-600 bg-brand-600' : cur ? 'border-gold-500 bg-gold-400' : 'border-slate-300 bg-white'}`} />
                    <p className={`text-sm font-bold ${cur ? 'text-navy-800' : done ? 'text-navy-700' : 'text-slate-500'}`}>
                      {l.name} <span className="text-xs font-normal text-slate-400">({l.floor}+ نقطة)</span>
                      {cur && <span className="mr-2 rounded bg-gold-100 px-1.5 py-0.5 text-[11px] font-semibold text-gold-600">المستوى الحالي</span>}
                    </p>
                    <p className="text-xs text-slate-500">{l.perk}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ── شهادات التقدير ── */}
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon name="award" className="h-5 w-5 text-gold-500" /><h2 className="section-title">شهادات التقدير</h2></div>
              <span className="text-xs text-slate-500">{certs.filter((c) => c.on).length} من {certs.length}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {certs.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className={`flex items-center gap-2 ${c.on ? 'font-semibold text-navy-800' : 'text-slate-400'}`}>
                    <Icon name={c.on ? 'check' : 'clock'} className={`h-4 w-4 ${c.on ? 'text-brand-600' : ''}`} />{c.name}
                  </span>
                  <span className={`text-xs ${c.on ? 'text-navy-700' : 'text-slate-400'}`}>{c.on ? 'مستحقة' : c.need}</span>
                </li>
              ))}
            </ul>
            <Link href="/certificate" className="btn-ghost mt-3 w-full">طباعة شهادة المستوى</Link>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(events?.length ?? 0) > 0 && (
            <section className="card">
              <div className="mb-2 flex items-center gap-2"><Icon name="calendar" className="h-5 w-5 text-navy-600" /><h2 className="section-title">الفعاليات القادمة</h2></div>
              <div className="divide-y divide-slate-100">
                {events!.map((e) => {
                  const live = Date.parse(e.starts_at) - 30 * 60e3 < now && Date.parse(e.ends_at) > now;
                  return (
                    <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        {live && <span className="ml-2 chip bg-red-600 text-white">جارية الآن</span>}
                        <span className="font-semibold">{e.title}</span>
                        <span className="block text-xs text-slate-500">{e.units?.name} • {fmtDate(e.starts_at)}</span>
                      </span>
                      <span className="text-xs font-semibold text-gold-600">{e.points} نقطة</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">يُسجَّل الحضور بمسح رمز QR المعروض في مقر الفعالية.</p>
            </section>
          )}
          {(recent?.length ?? 0) > 0 && (
            <section className="card">
              <div className="mb-2 flex items-center gap-2"><Icon name="file" className="h-5 w-5 text-navy-600" /><h2 className="section-title">آخر الحركات على رصيدك</h2></div>
              <div className="divide-y divide-slate-100">
                {recent!.map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{h.note}<span className="block text-xs text-slate-400">{fmtDate(h.created_at)}</span></span>
                    <span className={`font-bold ${h.amount > 0 ? 'text-navy-700' : 'text-red-700'}`}>{h.amount > 0 ? '+' : ''}{h.amount}</span>
                  </div>
                ))}
              </div>
              <Link href="/profile" className="mt-2 inline-block text-xs font-semibold text-navy-700">السجل الكامل</Link>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
