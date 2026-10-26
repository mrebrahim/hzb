'use client';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// الكود بيتغير كل 30 ثانية عشان محدش يصوّره ويبعته لصاحبه
export function LiveQr({ eventId }: { eventId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [left, setLeft] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let tick: ReturnType<typeof setInterval>;
    const refresh = async () => {
      const { data, error } = await createClient().rpc('event_qr_token', { p_event: eventId });
      if (error) return setError(error.message);
      const { token, expires_in } = data as { token: string; expires_in: number };
      const url = `${window.location.origin}/checkin?e=${eventId}&t=${token}`;
      if (canvas.current) await QRCode.toCanvas(canvas.current, url, { width: 320, margin: 1 });
      setLeft(expires_in);
      clearInterval(tick);
      tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
      timer = setTimeout(refresh, expires_in * 1000 + 300);
    };
    refresh();
    return () => { clearTimeout(timer); clearInterval(tick); };
  }, [eventId]);

  if (error) return <p className="text-rose-600">{error}</p>;
  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvas} className="rounded-xl" />
      <p className="text-sm">امسح بكاميرا الموبايل • الكود بيتغير بعد <b>{left}</b> ثانية</p>
    </div>
  );
}
