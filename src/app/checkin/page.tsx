'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function CheckIn() {
  const params = useSearchParams();
  const [state, setState] = useState<{ ok: boolean; msg: string } | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const e = params.get('e'), t = params.get('t');
    if (!e || !t) return setState({ ok: false, msg: 'الكود ناقص — امسح الـ QR تاني' });

    const send = async (lat: number | null, lng: number | null) => {
      const { data, error } = await createClient().rpc('check_in', { p_event: e, p_token: t, p_lat: lat, p_lng: lng });
      if (error) return setState({ ok: false, msg: error.message });
      const r = data as { status: string; title: string; points?: number };
      setState({ ok: true, msg: r.status === 'already' ? `إنت مسجّل بالفعل في "${r.title}"` : `تم تسجيل حضورك في "${r.title}" — أُضيفت ${r.points} نقطة إلى رصيدك` });
    };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => send(p.coords.latitude, p.coords.longitude),
        () => send(null, null),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else send(null, null);
  }, [params]);

  return (
    <div className="card text-center">
      {!state && <p>جاري تسجيل حضورك... (بنستخدم موقعك لحظة التسجيل بس)</p>}
      {state && <p className={`text-lg font-semibold ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.msg}</p>}
      <Link href="/" className="btn-ghost mt-4">رجوع لمهامي</Link>
    </div>
  );
}

export default function CheckInPage() {
  return <main className="mx-auto max-w-sm px-4 py-16"><Suspense><CheckIn /></Suspense></main>;
}
