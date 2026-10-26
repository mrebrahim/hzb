'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CONSENT_VERSION, DAYS, MOTIVATIONS, SKILLS } from '@/lib/labels';

type Unit = { id: string; name: string; type: string; parent_id: string | null };

function SignupForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const [units, setUnits] = useState<Unit[]>([]);
  const [gov, setGov] = useState('');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    createClient().from('units').select('id,name,type,parent_id').eq('is_demo', false).order('name').then(({ data }) => setUnits(data ?? []));
  }, []);

  const govs = units.filter((u) => u.type === 'governorate');
  const subUnits = units.filter((u) => u.parent_id === gov);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('consent_membership') !== 'on') return setError('لازم توافق على معالجة بيانات العضوية عشان تكمل');
    setLoading(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email: String(f.get('email')),
      password: String(f.get('password')),
      options: {
        emailRedirectTo: `${window.location.origin}${next}`,
        data: {
          full_name: String(f.get('full_name')),
          phone: String(f.get('phone') || ''),
          unit_id: unit || gov || null,
          motivations: f.getAll('motivations'),
          skills: f.getAll('skills'),
          available_days: f.getAll('available_days'),
          weekly_hours: String(f.get('weekly_hours') || '3'),
          consent_membership: 'true',
          consent_recognition: f.get('consent_recognition') === 'on' ? 'true' : 'false',
          consent_version: CONSENT_VERSION,
        },
      },
    });
    setLoading(false);
    if (error) return setError(error.message);
    if (data.session) {
      router.push(next);
      router.refresh();
    } else setSent(true);
  }

  if (sent)
    return (
      <div className="card text-center">
        <h2 className="h2 mb-2">تمام! فاضل خطوة واحدة</h2>
        <p className="muted">بعتنالك إيميل تأكيد. افتحه واضغط على اللينك وبعدها ادخل.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="card space-y-3">
        <h2 className="h2">بياناتك</h2>
        <div><label className="label">الاسم بالكامل</label><input name="full_name" required className="input" /></div>
        <div><label className="label">رقم الموبايل</label><input name="phone" type="tel" className="input" dir="ltr" /></div>
        <div><label className="label">البريد الإلكتروني</label><input name="email" type="email" required className="input" dir="ltr" /></div>
        <div><label className="label">كلمة السر (8 حروف على الأقل)</label><input name="password" type="password" minLength={8} required className="input" dir="ltr" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">المحافظة</label>
            <select className="input" value={gov} onChange={(e) => { setGov(e.target.value); setUnit(''); }} required>
              <option value="">اختار</option>
              {govs.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">المركز/القسم</label>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!subUnits.length}>
              <option value="">{subUnits.length ? 'اختار' : '—'}</option>
              {subUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">إيه اللي بيحمّسك تشارك؟</h2>
        <p className="muted">اختار كل اللي ينطبق عليك — بنستخدمه عشان نقترح عليك المهام اللي تناسبك.</p>
        {Object.entries(MOTIVATIONS).map(([k, v]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="motivations" value={k} className="h-4 w-4 accent-brand-600" /> {v}
          </label>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">مهاراتك ووقتك</h2>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <label key={s} className="chip cursor-pointer gap-1 bg-slate-100 py-1 text-slate-700 has-[:checked]:bg-brand-100 has-[:checked]:text-brand-900">
              <input type="checkbox" name="skills" value={s} className="hidden" /> {s}
            </label>
          ))}
        </div>
        <div>
          <span className="label">الأيام اللي غالباً بتبقى فاضي فيها</span>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <label key={d} className="chip cursor-pointer gap-1 bg-slate-100 py-1 text-slate-700 has-[:checked]:bg-brand-100 has-[:checked]:text-brand-900">
                <input type="checkbox" name="available_days" value={i} className="hidden" /> {d}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label">ساعات في الأسبوع تقدر تديها</label>
          <input name="weekly_hours" type="number" min={1} max={40} defaultValue={3} className="input w-24" />
        </div>
      </section>

      <section className="card space-y-3 text-sm">
        <h2 className="h2">الموافقة على معالجة البيانات</h2>
        <p className="muted">
          بياناتك العضوية بتعتبر بيانات حساسة حسب قانون حماية البيانات الشخصية رقم 151 لسنة 2020.
          بنجمع بس اللي محتاجينه لتنظيم العمل التطوعي، ومش بنبيعه أو بنشاركه مع أي جهة.
          تقدر تسحب موافقتك أو تحمّل بياناتك في أي وقت من صفحة &quot;ملفي وخصوصيتي&quot;.{' '}
          <Link href="/privacy-policy" className="text-navy-700 underline" target="_blank">التفاصيل</Link>
        </p>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent_membership" required className="mt-1 h-4 w-4 accent-brand-600" />
          أوافق كتابياً على معالجة بيانات عضويتي (الاسم، التواصل، الوحدة، المهارات، النشاط) لغرض تنظيم العمل الداخلي.
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent_recognition" className="mt-1 h-4 w-4 accent-brand-600" />
          (اختياري) أوافق إن اسمي يتنشر في بوستات التكريم و&quot;نجم الشهر&quot;.
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>{loading ? '...' : 'سجّل عضويتي'}</button>
      <p className="muted text-center">عندك حساب؟ <Link href="/login" className="font-semibold text-navy-700">ادخل</Link></p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="h1 mb-4 text-center">تسجيل عضوية</h1>
      <Suspense><SignupForm /></Suspense>
    </main>
  );
}
