'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DemoLogin } from '@/components/DemoLogin';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(f.get('email')),
      password: String(f.get('password')),
    });
    setLoading(false);
    if (error) return setError('البريد أو كلمة السر غلط، أو الحساب لسه ما اتأكدش من الإيميل');
    router.push(next.startsWith('/') ? next : '/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required className="input" dir="ltr" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">كلمة السر</label>
        <input id="password" name="password" type="password" required className="input" dir="ltr" autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>{loading ? '...' : 'دخول'}</button>
      <p className="muted text-center">
        أول مرة؟ <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700">سجّل عضويتك</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="h1 mb-1 text-center">منظومة التنظيم</h1>
      <p className="muted mb-6 text-center">مهامك، حضورك، ونقاطك في مكان واحد</p>
      <Suspense><LoginForm /></Suspense>
      {process.env.NEXT_PUBLIC_DEMO !== 'off' && <DemoLogin />}
    </main>
  );
}
