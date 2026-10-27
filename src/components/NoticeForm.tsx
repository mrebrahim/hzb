'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const TEMPLATES = [
  { title: 'تذكير بتكليف متأخر', body: 'نذكّركم بوجود تكليف تجاوز موعد التسليم. يُرجى تسليم التقرير أو التواصل مع الأمانة خلال 24 ساعة.' },
  { title: 'تنبيه بانخفاض نسبة الالتزام', body: 'لوحظ انخفاض نسبة التزامكم بالتكليفات المقبولة خلال الفترة الأخيرة. نرجو الحرص على الالتزام بالمواعيد أو الاعتذار المبكر.' },
  { title: 'دعوة لاستئناف النشاط', body: 'نفتقد مشاركتكم في أنشطة الوحدة. توجد تكليفات قصيرة متاحة هذا الأسبوع، ونرجو تحديث أيام إتاحتكم.' },
  { title: 'شكر وتقدير', body: 'تتقدم الأمانة بالشكر والتقدير على أدائكم المتميز والتزامكم خلال الفترة الماضية.' },
];

export function NoticeForm({ memberId }: { memberId: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    const { error } = await createClient().rpc('send_member_notice', { p_member: memberId, p_title: title, p_body: body });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'تم إرسال التنبيه وتسجيله' });
    if (!error) { setTitle(''); setBody(''); }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button key={t.title} type="button" onClick={() => { setTitle(t.title); setBody(t.body); }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:border-navy-500">{t.title}</button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="عنوان التنبيه" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="input" placeholder="نص التنبيه" />
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={send} disabled={!title.trim()}>إرسال تنبيه رسمي</button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-brand-700' : 'text-red-700'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
