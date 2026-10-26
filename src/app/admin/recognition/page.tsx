import Link from 'next/link';
import { CopyButton } from '@/components/CopyButton';
import { createClient } from '@/lib/supabase/server';

type C = { unit_id: string; unit_name: string; member_id: string; full_name: string; points_30: number; approved_30: number; can_publish: boolean };

export default async function RecognitionPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('recognition_candidates', { p_root: null });
  if (error) return <p className="card text-rose-600">{error.message}</p>;
  const byUnit = new Map<string, C[]>();
  for (const c of (data ?? []) as C[]) byUnit.set(c.unit_name, [...(byUnit.get(c.unit_name) ?? []), c]);
  const month = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date());

  return (
    <div className="space-y-3">
      <h1 className="h1">التقدير — نجوم {month}</h1>
      <p className="muted text-sm">
        التقدير العلني والقرب من القيادة هم الحافز الحقيقي — مش الفلوس. هنا أعلى 3 في كل وحدة آخر 30 يوم، مع بوست جاهز وشهادة.
        البوست بيظهر بس للي وافقوا على نشر اسمهم.
      </p>
      {byUnit.size === 0 && <p className="card muted">مفيش نشاط كفاية آخر 30 يوم لسه.</p>}
      {[...byUnit.entries()].map(([unit, list]) => (
        <section key={unit} className="card space-y-2">
          <h2 className="h2">{unit}</h2>
          {list.map((c, i) => {
            const post = `⭐ نجم الشهر في ${unit} ⭐\nكل التقدير لـ ${c.full_name} على مجهوده المميز الشهر ده: ${c.approved_30} مهمة اتعتمدت و${c.points_30} نقطة.\nشكراً إنك بتفرق على الأرض 💚`;
            return (
              <div key={c.member_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm">
                <span><b>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {c.full_name}</b> — {c.points_30} نقطة • {c.approved_30} مهمة</span>
                <span className="flex gap-2">
                  <Link href={`/certificate?m=${c.member_id}`} className="btn-ghost px-3 py-1" target="_blank">شهادة</Link>
                  {i === 0 && (c.can_publish
                    ? <CopyButton text={post} label="انسخ بوست التكريم" />
                    : <span className="muted text-xs">ما وافقش على النشر العلني — كرّمه في الاجتماع</span>)}
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
