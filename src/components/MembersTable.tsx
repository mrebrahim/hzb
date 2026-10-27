'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DirectAssign } from './DirectAssign';
import { ACTIVITY_STATUS, ROLES, fmtDate, pct, rating } from '@/lib/labels';

export type MemberRow = {
  member_id: string; full_name: string; phone: string | null; role: keyof typeof ROLES; unit_id: string; unit_name: string;
  activity_status: string; last_active_at: string; created_at: string; points_30: number; total_points: number;
  offers_30: number; accepted_30: number; approved_30: number; attendance_30: number; open_tasks: number; overdue: number;
  reliability: number;
};

const SORTS = {
  points: { label: 'الأعلى نقاطاً', fn: (a: MemberRow, b: MemberRow) => b.points_30 - a.points_30 },
  weakest: { label: 'الأضعف أداءً', fn: (a: MemberRow, b: MemberRow) => a.points_30 - b.points_30 },
  commit: { label: 'الأقل التزاماً', fn: (a: MemberRow, b: MemberRow) => a.reliability - b.reliability },
  overdue: { label: 'الأكثر تأخيراً', fn: (a: MemberRow, b: MemberRow) => b.overdue - a.overdue },
  idle: { label: 'الأطول غياباً', fn: (a: MemberRow, b: MemberRow) => Date.parse(a.last_active_at) - Date.parse(b.last_active_at) },
} as const;

export function MembersTable({ rows, units, scopeUnit, initialStatus }: {
  rows: MemberRow[]; units: { id: string; label: string }[]; scopeUnit: string; initialStatus?: string;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initialStatus ?? '');
  const [unit, setUnit] = useState('');
  const [sort, setSort] = useState<keyof typeof SORTS>(initialStatus ? 'idle' : 'points');
  const [sel, setSel] = useState<Set<string>>(new Set());

  const shown = useMemo(() => rows
    .filter((r) => r.role === 'member')
    .filter((r) => !q || r.full_name.includes(q) || (r.phone ?? '').includes(q))
    .filter((r) => !status || (status === 'overdue' ? r.overdue > 0 : status === 'low' ? r.reliability < 0.7 : r.activity_status === status))
    .filter((r) => !unit || r.unit_id === unit)
    .sort(SORTS[sort].fn), [rows, q, status, unit, sort]);

  const selUnits = new Set(rows.filter((r) => sel.has(r.member_id)).map((r) => r.unit_id));
  const assignUnit = selUnits.size === 1 ? [...selUnits][0] : scopeUnit;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((r) => sel.has(r.member_id));

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1"><label className="label">بحث</label><input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="الاسم أو الموبايل" /></div>
        <div><label className="label">الحالة</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">الكل</option>
            {Object.entries(ACTIVITY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            <option value="overdue">لديه تكليف متأخر</option>
            <option value="low">التزام أقل من 70%</option>
          </select></div>
        <div><label className="label">الوحدة</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input max-w-56">
            <option value="">كل الوحدات</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select></div>
        <div><label className="label">الترتيب</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className="input">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{shown.length} عضو • محدد {sel.size}</p>
        <DirectAssign memberIds={[...sel]} unitId={assignUnit} onDone={() => setSel(new Set())} />
      </div>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-right text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((r) => r.member_id)))} /></th>
              <th>العضو</th><th>الوحدة</th><th>الحالة</th><th>التقييم</th><th>نقاط 30 يوم</th>
              <th>قبول التكليفات</th><th>معتمدة</th><th>حضور</th><th>الالتزام</th><th>متأخر</th><th>آخر نشاط</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const rt = rating(r.points_30);
              const commit = Math.round(r.reliability * 100);
              return (
                <tr key={r.member_id} className={`border-t border-slate-100 ${sel.has(r.member_id) ? 'bg-navy-50' : ''}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={sel.has(r.member_id)} onChange={() => toggle(r.member_id)} /></td>
                  <td>
                    <Link href={`/admin/members/${r.member_id}`} className="font-semibold text-navy-700 hover:underline">{r.full_name}</Link>
                    <p className="text-[11px] text-slate-400" dir="ltr">{r.phone}</p>
                  </td>
                  <td className="text-xs">{r.unit_name}</td>
                  <td><span className={`chip ${ACTIVITY_STATUS[r.activity_status]?.cls}`}>{ACTIVITY_STATUS[r.activity_status]?.label}</span></td>
                  <td><span className={`chip ${rt.cls}`}>{rt.label}</span></td>
                  <td className="font-bold text-navy-800">{r.points_30}</td>
                  <td>{r.offers_30 ? `${pct(r.accepted_30, r.offers_30)}%` : '—'} <span className="text-[11px] text-slate-400">({r.accepted_30}/{r.offers_30})</span></td>
                  <td>{r.approved_30}</td>
                  <td>{r.attendance_30}</td>
                  <td className={commit < 70 ? 'font-bold text-red-700' : commit < 90 ? 'text-amber-700' : 'text-brand-700'}>{commit}%</td>
                  <td>{r.overdue > 0 ? <span className="chip bg-red-100 text-red-800">{r.overdue}</span> : '—'}</td>
                  <td className="text-xs text-slate-500">{fmtDate(r.last_active_at)}</td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={12} className="py-6 text-center text-slate-500">لا يوجد أعضاء مطابقون.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
