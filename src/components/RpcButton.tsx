'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  fn: string;
  args: Record<string, unknown>;
  label: string;
  className?: string;
  confirm?: string;
  // رسالة النجاح؛ {n} بتتبدل بنتيجة الدالة. (نص مش function عشان ينفع يتبعت من Server Component)
  doneMessage?: string;
  emptyMessage?: string;
};

export function RpcButton({ fn, args, label, className = 'btn-primary', confirm, doneMessage, emptyMessage }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setMsg(null);
    const { data, error } = await createClient().rpc(fn, args);
    if (error) {
      setErr(true);
      setMsg(error.message);
      return;
    }
    setErr(false);
    if (emptyMessage && !Number(data)) setMsg(emptyMessage);
    else if (doneMessage) setMsg(doneMessage.replace('{n}', String(data ?? '')));
    start(() => router.refresh());
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={run} disabled={pending} className={className}>{label}</button>
      {msg && <span className={`text-xs ${err ? 'text-red-600' : 'text-emerald-700'}`}>{msg}</span>}
    </span>
  );
}
