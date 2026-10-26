import { ReviewCard } from '@/components/ReviewCard';
import { createClient } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/labels';

type R = {
  id: string; report: string | null; evidence_url: string | null; submitted_at: string; rework_count: number;
  report_lat: number | null; report_lng: number | null;
  tasks: { title: string; base_points: number; units: { name: string } | null } | null;
  member: { full_name: string } | null;
};

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('assignments')
    .select('id,report,evidence_url,submitted_at,rework_count,report_lat,report_lng,tasks(title,base_points,units(name)),member:profiles!assignments_member_id_fkey(full_name)')
    .eq('status', 'submitted').order('submitted_at').limit(50).returns<R[]>();

  const rows = data ?? [];
  const paths = rows.map((r) => r.evidence_url).filter(Boolean) as string[];
  const signed = paths.length
    ? (await supabase.storage.from('evidence').createSignedUrls(paths, 3600)).data ?? []
    : [];
  const urlFor = (p: string | null) => signed.find((s) => s.path === p)?.signedUrl ?? null;

  return (
    <div className="space-y-3">
      <h1 className="h1">مراجعة التقارير ({rows.length})</h1>
      <p className="muted text-sm">النقاط مش بتتحسب غير بعد اعتمادك. الاعتماد من أول مرة بياخد +10% جودة. مينفعش تعتمد شغلك بنفسك.</p>
      {rows.length === 0 && <p className="card muted">مفيش تقارير مستنية — عاش!</p>}
      {rows.map((r) => (
        <ReviewCard key={r.id} id={r.id}
          header={`${r.member?.full_name ?? ''} — ${r.tasks?.title ?? ''}`}
          meta={`${r.tasks?.units?.name ?? ''} • اتسلّم ${fmtDate(r.submitted_at)} • ${r.tasks?.base_points} نقطة${r.rework_count ? ` • تعديل رقم ${r.rework_count}` : ''}`}
          report={r.report ?? ''} photo={urlFor(r.evidence_url)}
          map={r.report_lat != null ? `https://maps.google.com/?q=${r.report_lat},${r.report_lng}` : null} />
      ))}
    </div>
  );
}
