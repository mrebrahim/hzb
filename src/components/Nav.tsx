import Link from 'next/link';
import { SignOut } from './SignOut';

export function Nav({ staff, unread = 0 }: { staff: boolean; unread?: number }) {
  return (
    <header className="no-print sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 overflow-x-auto px-4 py-3 text-sm">
        <Link href="/" className="whitespace-nowrap font-bold text-brand-700">منظومة التنظيم</Link>
        <nav className="flex flex-1 items-center gap-1">
          <Link href="/" className="btn-ghost whitespace-nowrap px-3 py-1.5">
            مهامي{unread > 0 && <span className="chip bg-rose-500 text-white">{unread}</span>}
          </Link>
          <Link href="/profile" className="btn-ghost whitespace-nowrap px-3 py-1.5">ملفي وخصوصيتي</Link>
          {staff && <Link href="/admin" className="btn-ghost whitespace-nowrap px-3 py-1.5">لوحة الأمانة</Link>}
        </nav>
        <SignOut />
      </div>
    </header>
  );
}
