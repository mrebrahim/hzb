'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const PURPOSES = {
  membership_processing: { label: 'معالجة بيانات العضوية', note: 'لو سحبتها مش هيتعرض عليك مهام جديدة.' },
  public_recognition: { label: 'نشر اسمي في التكريم', note: 'بوستات "نجم الشهر" والتكريم العلني.' },
  whatsapp_optin: { label: 'تنبيهات واتساب', note: 'تنبيهات قليلة ومهمة بس، وتقدر توقفها في أي وقت.' },
} as const;

export function PrivacyCenter({ consents }: { consents: Record<string, boolean> }) {
  const router = useRouter();

  async function toggle(purpose: string, granted: boolean) {
    if (!granted && purpose === 'membership_processing' && !confirm('متأكد؟ مش هيتعرض عليك مهام جديدة.')) return;
    const { error } = await createClient().rpc('set_consent', { p_purpose: purpose, p_granted: granted });
    if (error) alert(error.message);
    router.refresh();
  }

  async function exportData() {
    const { data, error } = await createClient().rpc('export_my_data');
    if (error) return alert(error.message);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-data.json';
    a.click();
  }

  return (
    <section className="card space-y-3">
      <h2 className="h2">مركز الخصوصية</h2>
      {Object.entries(PURPOSES).map(([k, v]) => {
        const on = !!consents[k];
        return (
          <div key={k} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3">
            <div><p className="text-sm font-semibold">{v.label}</p><p className="muted text-xs">{v.note}</p></div>
            <button className={on ? 'btn-danger' : 'btn-primary'} onClick={() => toggle(k, !on)}>{on ? 'سحب الموافقة' : 'موافق'}</button>
          </div>
        );
      })}
      <button className="btn-ghost" onClick={exportData}>حمّل نسخة من كل بياناتي</button>
    </section>
  );
}
