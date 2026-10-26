'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// حسابات الديمو بتتعمل وتترجع لحالتها الأصلية كل يوم (supabase seed_demo)
const DEMO = [
  { email: 'amin@demo.hzb.app', label: 'الدخول بصفة أمين', hint: 'محمود عبد الرحمن — أمين التنظيم، متابعة جميع المحافظات', to: '/admin' },
  { email: 'assistant@demo.hzb.app', label: 'الدخول بصفة أمين مساعد', hint: 'سارة حسن — أمين مساعد القاهرة، المراجعة وتوزيع التكليفات', to: '/admin' },
  { email: 'member@demo.hzb.app', label: 'الدخول بصفة عضو', hint: 'أحمد مصطفى — عضو، مدينة نصر', to: '/' },
] as const;

export function DemoLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(d: (typeof DEMO)[number]) {
    setBusy(d.email);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: d.email, password: 'Demo@2026' });
    if (error) {
      setBusy(null);
      return setError('حسابات الديمو مش جاهزة دلوقتي');
    }
    router.push(d.to);
    router.refresh();
  }

  return (
    <section className="card mt-4 space-y-2">
      <h2 className="section-title text-center">الدخول التجريبي</h2>
      <p className="muted text-center text-xs">بيانات تجريبية بأسماء افتراضية، تُعاد لحالتها الأصلية يومياً.</p>
      {DEMO.map((d) => (
        <button key={d.email} onClick={() => go(d)} disabled={!!busy}
          className="flex w-full flex-col items-start rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-right hover:border-navy-500 hover:bg-navy-50 disabled:opacity-60">
          <span className="font-semibold text-navy-800">{busy === d.email ? '...' : d.label}</span>
          <span className="text-xs text-slate-600">{d.hint}</span>
        </button>
      ))}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </section>
  );
}
