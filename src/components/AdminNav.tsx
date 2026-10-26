import Link from 'next/link';

const LINKS = [
  ['/admin', 'المؤشرات'],
  ['/admin/tasks', 'التكليفات'],
  ['/admin/review', 'المراجعة والاعتماد'],
  ['/admin/events', 'الفعاليات والحضور'],
  ['/admin/members', 'الأعضاء'],
  ['/admin/recognition', 'التكريم'],
  ['/admin/units', 'الهيكل التنظيمي'],
] as const;

export function AdminNav() {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 text-sm">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="whitespace-nowrap rounded px-3 py-2 text-slate-700 hover:bg-navy-50 hover:text-navy-800">{label}</Link>
      ))}
    </div>
  );
}
