import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { ROLES, UNIT_TYPES, initials, pct } from '@/lib/labels';

type Kpi = {
  unit_id: string; unit_name: string; unit_type: keyof typeof UNIT_TYPES; child_count: number;
  members: number; active: number; slowing: number; dormant: number;
  offers_30: number; accepted_30: number; approved_30: number; attendance_30: number; points_30: number;
};
type Week = { week: string; active_members: number; points: number; approved: number; attendance: number };
type Champ = { member_id: string; full_name: string; unit_name: string; points_30: number; approved_30: number;
               attendance_30: number; streak_weeks: number; total_points: number };
type Staff = { staff_id: string; full_name: string; role: keyof typeof ROLES; unit_name: string; reviews_30: number;
               tasks_30: number; events_30: number; team_members: number; team_active: number; score: number };

const MEDAL = ['🥇', '🥈', '🥉'];

function Avatar({ name, size = 'h-12 w-12 text-base', ring = 'ring-white' }: { name: string; size?: string; ring?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-teal-400 font-bold text-white ring-4 ${ring}`}>
      {initials(name)}
    </span>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ root?: string }> }) {
  const { root } = await searchParams;
  const { supabase, profile } = await requireStaff();
  const args = { p_root: root ?? null };
  const [k, w, rootUnit, champs, staff, pending] = await Promise.all([
    supabase.rpc('unit_kpis', args),
    supabase.rpc('weekly_activity', { ...args, p_weeks: 8 }),
    root ? supabase.from('units').select('name,parent_id').eq('id', root).single() : Promise.resolve({ data: null }),
    supabase.rpc('leaderboard_members', { ...args, p_limit: 10 }),
    supabase.rpc('leaderboard_staff', args),
    supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
  ]);
  if (k.error) return <p className="card text-rose-600">{k.error.message}</p>;

  const rows = (k.data ?? []) as Kpi[];
  const weeks = (w.data ?? []) as Week[];
  const top = (champs.data ?? []) as Champ[];
  const team = ((staff.data ?? []) as Staff[]).filter((s) => s.staff_id !== profile.id);
  const sum = (key: keyof Kpi) => rows.reduce((a, r) => a + (r[key] as number), 0);
  const members = sum('members');
  const activeRate = pct(sum('active'), members);
  const lastWeek = weeks.at(-2)?.active_members ?? 0, thisWeek = weeks.at(-1)?.active_members ?? 0;
  const maxActive = Math.max(1, ...weeks.map((x) => x.active_members));
  const maxScore = Math.max(1, ...team.map((s) => s.score));
  const ranked = [...rows].filter((r) => r.members > 0)
    .sort((a, b) => b.active / b.members - a.active / a.members || b.points_30 / b.members - a.points_30 / a.members);
  const podium = [top[1], top[0], top[2]];
  const first = profile.full_name.split(' ')[0];

  return (
    <div className="space-y-5">
      {/* ── الهيدر ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-900 to-brand-600 p-5 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-48 w-48 rounded-full bg-yellow-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm opacity-80">أهلاً يا {first} 👋 — {ROLES[profile.role]}</p>
            <h1 className="text-2xl font-extrabold">{rootUnit?.data ? rootUnit.data.name : 'لوحة قيادة التنظيم'} 🚀</h1>
          </div>
          {rootUnit?.data && (
            <Link href={rootUnit.data.parent_id ? `/admin?root=${rootUnit.data.parent_id}` : '/admin'} className="rounded-xl bg-white/15 px-3 py-2 text-sm backdrop-blur hover:bg-white/25">↑ المستوى الأعلى</Link>
          )}
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['⚡', `${activeRate}%`, 'أعضاء نشطين', `${sum('active')} من ${members}`],
            ['✅', sum('approved_30'), 'مهمة اتعتمدت', 'آخر 30 يوم'],
            ['📍', sum('attendance_30'), 'حضور فعاليات', 'آخر 30 يوم'],
            ['💰', sum('points_30').toLocaleString('ar-EG'), 'نقطة اتكسبت', 'آخر 30 يوم'],
          ].map(([e, v, l, sub]) => (
            <div key={String(l)} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
              <p className="text-xl">{e}</p>
              <p className="text-3xl font-extrabold">{v}</p>
              <p className="text-xs font-semibold opacity-90">{l}</p>
              <p className="text-[11px] opacity-70">{sub}</p>
            </div>
          ))}
        </div>
        <div className="relative mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className={`rounded-full px-3 py-1 ${thisWeek >= lastWeek ? 'bg-emerald-400/30' : 'bg-rose-400/30'}`}>
            {thisWeek >= lastWeek ? '📈' : '📉'} {thisWeek} نشطين الأسبوع ده (اللي فات {lastWeek})
          </span>
          {(pending.count ?? 0) > 0 && <Link href="/admin/review" className="rounded-full bg-yellow-300 px-3 py-1 text-yellow-950 hover:bg-yellow-200">📝 {pending.count} تقرير مستني مراجعتك ←</Link>}
          {sum('dormant') > 0 && <Link href="/admin/members?status=dormant" className="rounded-full bg-rose-400/30 px-3 py-1 hover:bg-rose-400/40">😴 {sum('dormant')} عضو خامل محتاج اهتمام ←</Link>}
        </div>
      </section>

      {/* ── أبطال الشهر ── */}
      <section className="rounded-3xl bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm ring-1 ring-amber-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">🏆 أبطال الشهر</h2>
          <Link href="/admin/recognition" className="text-sm font-semibold text-amber-700">كرّمهم ←</Link>
        </div>
        {top.length === 0 ? <p className="muted">لسه مفيش نشاط كفاية الشهر ده.</p> : (
          <>
            <div className="mx-auto grid max-w-xl grid-cols-3 items-end gap-2 text-center">
              {podium.map((c, i) => c ? (
                <div key={c.member_id} className="flex flex-col items-center">
                  <span className="text-3xl">{MEDAL[i === 1 ? 0 : i === 0 ? 1 : 2]}</span>
                  <Avatar name={c.full_name} size={i === 1 ? 'h-16 w-16 text-lg' : 'h-12 w-12 text-sm'} ring={i === 1 ? 'ring-amber-300' : 'ring-white'} />
                  <p className="mt-1 line-clamp-1 text-sm font-bold">{c.full_name}</p>
                  <p className="text-[11px] text-gray-500">{c.unit_name}</p>
                  <div className={`mt-2 w-full rounded-t-2xl bg-gradient-to-t ${i === 1 ? 'h-28 from-amber-400 to-yellow-300' : i === 0 ? 'h-20 from-slate-300 to-slate-200' : 'h-14 from-orange-300 to-amber-200'} grid place-items-center`}>
                    <div><p className="text-xl font-extrabold">{c.points_30}</p><p className="text-[10px] font-semibold">نقطة</p></div>
                  </div>
                </div>
              ) : <div key={i} />)}
            </div>
            <div className="mt-4 space-y-1.5">
              {top.slice(3).map((c, i) => (
                <div key={c.member_id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-gray-100">
                  <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 4}</span>
                  <Avatar name={c.full_name} size="h-9 w-9 text-xs" ring="ring-gray-50" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.full_name}</p>
                    <p className="text-[11px] text-gray-500">{c.unit_name} • {c.approved_30} مهمة • {c.attendance_30} حضور</p>
                  </div>
                  {c.streak_weeks >= 2 && <span className="chip bg-orange-100 text-orange-700">🔥 {c.streak_weeks}</span>}
                  <span className="font-extrabold text-brand-700">{c.points_30}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── ترتيب المساعدين ── */}
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-xl font-extrabold">⭐ ترتيب الأمناء المساعدين</h2>
          <p className="mb-3 text-xs text-gray-500">النقاط = مراجعات×2 + مهام نزّلها×3 + فعاليات×4 + نسبة نشاط فريقه</p>
          {team.length === 0 && <p className="muted">مفيش أمناء مساعدين في نطاقك لسه.</p>}
          <div className="space-y-3">
            {team.map((s, i) => (
              <div key={s.staff_id} className={`rounded-2xl p-3 ${i === 0 ? 'bg-gradient-to-l from-violet-50 to-fuchsia-50 ring-2 ring-violet-200' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-xl">{MEDAL[i] ?? <span className="text-sm font-bold text-gray-400">{i + 1}</span>}</span>
                  <Avatar name={s.full_name} size="h-10 w-10 text-sm" ring="ring-white" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.full_name}</p>
                    <p className="text-[11px] text-gray-500">{ROLES[s.role]} • {s.unit_name}</p>
                  </div>
                  <span className="text-xl font-extrabold text-violet-700">{s.score}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-gradient-to-l from-violet-500 to-fuchsia-400" style={{ width: `${(s.score / maxScore) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-white px-2 py-0.5">📝 {s.reviews_30} مراجعة</span>
                  <span className="rounded-full bg-white px-2 py-0.5">📋 {s.tasks_30} مهمة</span>
                  <span className="rounded-full bg-white px-2 py-0.5">🎪 {s.events_30} فعالية</span>
                  <span className="rounded-full bg-white px-2 py-0.5">⚡ فريقه {pct(s.team_active, s.team_members)}% نشط</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── سباق الوحدات ── */}
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-xl font-extrabold">🏁 سباق الوحدات</h2>
          <p className="mb-3 text-xs text-gray-500">منافسة فرق مش أفراد — الترتيب بنسبة الأعضاء النشطين. اضغط على الوحدة للتفاصيل.</p>
          <div className="space-y-3">
            {ranked.map((r, i) => {
              const rate = pct(r.active, r.members);
              return (
                <div key={r.unit_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-bold">
                      {MEDAL[i] ?? `${i + 1}.`}{' '}
                      {r.child_count > 0 ? <Link href={`/admin?root=${r.unit_id}`} className="text-brand-700 hover:underline">{r.unit_name}</Link> : r.unit_name}
                    </span>
                    <span className="text-xs text-gray-500">{r.active}/{r.members} • {r.members ? Math.round(r.points_30 / r.members) : 0} نقطة/عضو</span>
                  </div>
                  <div className="h-5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`flex h-full items-center justify-end rounded-full px-2 text-[11px] font-bold text-white ${i === 0 ? 'bg-gradient-to-l from-amber-400 to-orange-500' : 'bg-gradient-to-l from-brand-500 to-teal-400'}`} style={{ width: `${Math.max(rate, 8)}%` }}>{rate}%</div>
                  </div>
                </div>
              );
            })}
            {ranked.length === 0 && <p className="muted">مفيش أعضاء في النطاق ده لسه.</p>}
          </div>

          <h3 className="mb-2 mt-6 font-bold">📊 النشاط الأسبوعي</h3>
          <div className="flex h-32 items-end gap-2">
            {weeks.map((x, i) => (
              <div key={x.week} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-bold">{x.active_members}</span>
                <div className={`w-full rounded-t-lg ${i === weeks.length - 1 ? 'bg-gradient-to-t from-amber-500 to-yellow-300' : 'bg-gradient-to-t from-brand-600 to-teal-400'}`}
                  style={{ height: `${(x.active_members / maxActive) * 100}%`, minHeight: 3 }} title={`${x.points} نقطة • ${x.approved} مهمة • ${x.attendance} حضور`} />
                <span className="text-[10px] text-gray-500">{new Date(x.week).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── الجدول التفصيلي ── */}
      <section className="card overflow-x-auto">
        <h2 className="h2 mb-3">📋 التفاصيل لكل وحدة</h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-right text-xs text-gray-500">
            <tr><th className="py-2">الوحدة</th><th>أعضاء</th><th>نشط</th><th>بيقل</th><th>خامل</th><th>قبول العروض</th><th>مهام معتمدة</th><th>حضور</th></tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.unit_id} className="border-t border-gray-50">
                <td className="py-2 font-semibold">{r.unit_name} <span className="muted text-xs">{UNIT_TYPES[r.unit_type]}</span></td>
                <td>{r.members}</td>
                <td><span className="chip bg-emerald-50 text-emerald-800">{r.active}</span></td>
                <td><span className="chip bg-amber-50 text-amber-800">{r.slowing}</span></td>
                <td>{r.dormant > 0 ? <Link href="/admin/members?status=dormant" className="chip bg-rose-50 text-rose-700">{r.dormant}</Link> : 0}</td>
                <td>{pct(r.accepted_30, r.offers_30)}%</td>
                <td>{r.approved_30}</td>
                <td>{r.attendance_30}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
