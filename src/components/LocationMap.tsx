// خريطة OpenStreetMap بعلامة على الموقع (من غير مكتبات أو مفاتيح)
export function LocationMap({ lat, lng, accuracy, height = 180 }: { lat: number; lng: number; accuracy?: number | null; height?: number }) {
  const d = 0.004;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <iframe title="الموقع على الخريطة" src={src} className="w-full" style={{ height }} loading="lazy" />
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
        <span dir="ltr">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        {accuracy != null && <span>دقة التحديد: ±{accuracy} متر</span>}
        <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="font-semibold text-navy-600 underline">فتح في خرائط جوجل</a>
      </div>
    </div>
  );
}
