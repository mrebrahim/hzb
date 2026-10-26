'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="whitespace-nowrap text-xs text-gray-500 hover:text-gray-800"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push('/login');
        router.refresh();
      }}
    >
      خروج
    </button>
  );
}
