'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ManualCheckIn({ eventId, members }: { eventId: string; members: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const hits = q.length >= 2 ? members.filter((m) => m.full_name.includes(q)).slice(0, 6) : [];

  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="mb-2 text-xs text-slate-600">عضو موبايله فاصل أو كبير في السن؟ سجّله يدوي (بيتسجل باسمك في سجل التدقيق).</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="ابحث بالاسم" />
      {hits.map((m) => (
        <button key={m.id} className="mt-1 block w-full rounded-lg px-2 py-1 text-right text-sm hover:bg-white" onClick={async () => {
          const { error } = await createClient().rpc('manual_check_in', { p_event: eventId, p_member: m.id });
          setMsg(error ? error.message : `اتسجل ${m.full_name}`);
          setQ('');
          router.refresh();
        }}>+ {m.full_name}</button>
      ))}
      {msg && <p className="mt-1 text-xs text-emerald-700">{msg}</p>}
    </div>
  );
}
