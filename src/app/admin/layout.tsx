import { AdminNav } from '@/components/AdminNav';
import { Nav } from '@/components/Nav';
import { requireStaff } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  return (
    <>
      <Nav staff />
      <main className="mx-auto max-w-5xl px-4 py-4">
        <p className="muted mb-2 text-xs no-print">نطاقك: {profile.role === 'admin' ? 'كل التنظيم (أدمن)' : profile.units?.name ?? '—'}</p>
        <AdminNav />
        {children}
      </main>
    </>
  );
}
