import Link from 'next/link';

const LINKS = [
  ['/admin', 'المؤشرات'],
  ['/admin/tasks', 'المهام'],
  ['/admin/review', 'المراجعة'],
  ['/admin/events', 'الفعاليات والحضور'],
  ['/admin/members', 'الأعضاء'],
  ['/admin/recognition', 'التقدير'],
  ['/admin/units', 'الهيكل'],
] as const;

export function AdminNav() {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 text-sm shadow-sm ring-1 ring-gray-100">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="whitespace-nowrap rounded-xl px-3 py-2 hover:bg-brand-50">{label}</Link>
      ))}
    </div>
  );
}
