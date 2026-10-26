import Link from 'next/link';
import { SignOut } from './SignOut';

export function Nav({ staff, unread = 0 }: { staff: boolean; unread?: number }) {
  return (
    <header className="no-print sticky top-0 z-10 border-b border-navy-900 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 overflow-x-auto px-4 py-3 text-sm">
        <Link href="/" className="whitespace-nowrap font-bold"><span className="ml-2 inline-block h-2.5 w-2.5 rounded-sm bg-gold-400" />منظومة المتابعة والأداء</Link>
        <nav className="flex flex-1 items-center gap-1">
          <Link href="/" className="whitespace-nowrap rounded px-3 py-1.5 text-navy-100 hover:bg-white/10 hover:text-white">
            مهامي{unread > 0 && <span className="mr-1 rounded bg-gold-500 px-1.5 text-[11px] font-bold text-navy-900">{unread}</span>}
          </Link>
          <Link href="/profile" className="whitespace-nowrap rounded px-3 py-1.5 text-navy-100 hover:bg-white/10 hover:text-white">الملف والخصوصية</Link>
          {staff && <Link href="/admin" className="whitespace-nowrap rounded px-3 py-1.5 text-navy-100 hover:bg-white/10 hover:text-white">لوحة المتابعة</Link>}
        </nav>
        <SignOut />
      </div>
    </header>
  );
}
