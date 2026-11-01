import { waLink } from '@/lib/whatsapp';

// زرار بيفتح واتساب برسالة جاهزة للعضو
export function WhatsAppButton({ phone, text, label = 'إرسال على واتساب', small }: { phone: string | null; text: string; label?: string; small?: boolean }) {
  const href = waLink(phone, text);
  if (!href) return <span className="text-xs text-slate-400">لا يوجد رقم موبايل صالح</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-md bg-[#1f8f4e] font-semibold text-white hover:bg-[#177a41] ${small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'}`}>
      <svg viewBox="0 0 24 24" className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.7 11.5 11.5 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z" />
      </svg>
      {label}
    </a>
  );
}
