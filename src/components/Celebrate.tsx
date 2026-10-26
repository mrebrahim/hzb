'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

export async function confetti(opts: { big?: boolean } = {}) {
  const c = (await import('canvas-confetti')).default;
  const colors = ['#16714a', '#fbbf24', '#f472b6', '#38bdf8', '#a78bfa'];
  c({ particleCount: opts.big ? 180 : 90, spread: opts.big ? 100 : 70, origin: { y: 0.7 }, colors });
  if (opts.big) setTimeout(() => c({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0 }, colors }), 250);
  if (opts.big) setTimeout(() => c({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1 }, colors }), 400);
}

// زرار قبول المهمة مع احتفال
export function AcceptButton({ id, points }: { id: string; points: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  return (
    <span className="inline-flex flex-col gap-1">
      <button disabled={pending} className="btn rounded-2xl bg-gradient-to-l from-amber-400 to-yellow-300 px-5 py-2.5 text-base font-bold text-amber-950 shadow-lg shadow-amber-200 hover:scale-105 active:scale-95"
        onClick={async () => {
          const { error } = await createClient().rpc('accept_assignment', { p_id: id });
          if (error) { setErr(true); return setMsg(error.message); }
          setErr(false);
          setMsg(`يلا بينا! 💪 ${points} نقطة مستنياك`);
          confetti();
          setTimeout(() => start(() => router.refresh()), 1400);
        }}>
        🚀 أنا ليها!
      </button>
      {msg && <span className={`text-xs font-semibold ${err ? 'text-rose-600' : 'text-emerald-700'}`}>{msg}</span>}
    </span>
  );
}

// احتفال مرة واحدة لكل إنجاز جديد (نقاط اتضافت أو مستوى جديد)
export function CelebrateOnMount({ keyId, big }: { keyId: string; big?: boolean }) {
  useEffect(() => {
    try {
      const k = `celebrated:${keyId}`;
      if (localStorage.getItem(k)) return;
      localStorage.setItem(k, '1');
    } catch { /* التخزين مقفول — نحتفل وخلاص */ }
    const t = setTimeout(() => confetti({ big }), 500);
    return () => clearTimeout(t);
  }, [keyId, big]);
  return null;
}
