import { requireProfile } from '@/lib/auth';
import { PrintButton } from '@/components/PrintButton';

export default async function Certificate({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const { supabase, profile } = await requireProfile();
  let name = profile.full_name, unit = profile.units?.name, total = 0;
  if (m && m !== profile.id && profile.role !== 'member') {
    // RLS بتضمن إن المنسق يشوف بس الأعضاء اللي في نطاقه
    const { data: p } = await supabase.from('profiles').select('full_name, units(name)').eq('id', m)
      .single<{ full_name: string; units: { name: string } | null }>();
    if (!p) return <p className="p-8">العضو مش في نطاقك</p>;
    const { data: l } = await supabase.from('point_ledger').select('amount').eq('member_id', m);
    name = p.full_name; unit = p.units?.name; total = (l ?? []).reduce((a, r) => a + r.amount, 0);
  } else {
    const { data } = await supabase.rpc('my_standing').single<{ total: number }>();
    total = data?.total ?? 0;
  }
  const { data: level } = await supabase.rpc('level_for', { p_points: total }).single<{ name: string }>();
  const today = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(new Date());
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-3xl border-8 border-double border-brand-600 bg-white p-10 text-center">
        <p className="text-sm tracking-widest text-brand-700">شهادة تقدير</p>
        <h1 className="mt-6 text-3xl font-bold">{name}</h1>
        <p className="mt-4 text-lg">تقديراً لمجهوده في العمل التطوعي والتنظيمي{unit ? ` في ${unit}` : ''}</p>
        <p className="mt-6 text-2xl font-bold text-brand-700">مستوى: {level?.name}</p>
        <p className="mt-1 text-gray-600">{total} نقطة موثّقة</p>
        <p className="mt-10 text-sm text-gray-500">{today}</p>
      </div>
      <div className="no-print mt-4 text-center"><PrintButton /></div>
    </main>
  );
}
