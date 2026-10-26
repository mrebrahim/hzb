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
  done?: (data: unknown) => string | void;
};

export function RpcButton({ fn, args, label, className = 'btn-primary', confirm, done }: Props) {
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
    const m = done?.(data);
    if (m) setMsg(m);
    start(() => router.refresh());
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={run} disabled={pending} className={className}>{label}</button>
      {msg && <span className={`text-xs ${err ? 'text-rose-600' : 'text-emerald-700'}`}>{msg}</span>}
    </span>
  );
}
