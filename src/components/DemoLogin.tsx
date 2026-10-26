'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// حسابات الديمو بتتعمل وتترجع لحالتها الأصلية كل يوم (supabase seed_demo)
const DEMO = [
  { email: 'amin@demo.hzb.app', label: 'ادخل كأمين', hint: 'محمود عبد الرحمن — أمين التنظيم، بيشوف كل المحافظات', to: '/admin' },
  { email: 'assistant@demo.hzb.app', label: 'ادخل كأمين مساعد', hint: 'سارة حسن — أمين مساعد القاهرة، بتراجع وتوزع المهام', to: '/admin' },
  { email: 'member@demo.hzb.app', label: 'ادخل كعضو', hint: 'أحمد مصطفى — عضو في مدينة نصر', to: '/' },
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
      <h2 className="h2 text-center">جرّب الديمو</h2>
      <p className="muted text-center text-xs">بيانات تجريبية بأسماء وهمية، وبترجع لحالتها الأصلية كل يوم.</p>
      {DEMO.map((d) => (
        <button key={d.email} onClick={() => go(d)} disabled={!!busy}
          className="flex w-full flex-col items-start rounded-xl bg-brand-50 px-4 py-2 text-right ring-1 ring-brand-100 hover:bg-brand-100 disabled:opacity-60">
          <span className="font-semibold text-brand-900">{busy === d.email ? '...' : d.label}</span>
          <span className="text-xs text-gray-600">{d.hint}</span>
        </button>
      ))}
      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
    </section>
  );
}
