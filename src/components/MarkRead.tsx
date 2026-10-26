'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function MarkRead() {
  const router = useRouter();
  return (
    <button
      className="text-xs text-navy-700"
      onClick={async () => {
        await createClient().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
        router.refresh();
      }}
    >
      تعليم الكل كمقروء
    </button>
  );
}
