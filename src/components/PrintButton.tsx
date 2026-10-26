'use client';
export function PrintButton({ label = 'طباعة / حفظ PDF' }: { label?: string }) {
  return <button className="btn-primary" onClick={() => window.print()}>{label}</button>;
}
