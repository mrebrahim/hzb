// إرسال يدوي عبر واتساب (click-to-chat): بيفتح واتساب على موبايل الأمين برسالة جاهزة وهو اللي بيدوس إرسال.
// مش بنستخدم إرسال آلي: سياسة WhatsApp Business بتمنع الأحزاب والجهات اللي بتقدم خدمات سياسية،
// والحلول غير الرسمية (Baileys/Evolution API) بتعرّض الأرقام للحظر الدائم.

// يحوّل رقم مصري (01xxxxxxxxx أو +20...) لصيغة دولية بدون +
export function toIntl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = '2' + d;
  if (d.length === 10 && d.startsWith('1')) d = '20' + d;
  return d.length >= 11 ? d : null;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const n = toIntl(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

export function assignmentMessage(o: { name: string; title: string; deadline: string; unit?: string | null; url: string;
                                       requiresLocation?: boolean; requiresPhoto?: boolean }) {
  const due = new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
    .format(new Date(o.deadline));
  const req = [o.requiresLocation && 'تحديد موقعك عند التسليم', o.requiresPhoto && 'صورة إثبات'].filter(Boolean);
  return [
    `السلام عليكم أ/ ${o.name}`,
    `تم تكليفكم${o.unit ? ` من أمانة ${o.unit}` : ''} بـ:`,
    `«${o.title}»`,
    `موعد التسليم: ${due}`,
    req.length ? `مطلوب: ${req.join(' + ')}` : '',
    '',
    `للاطلاع على التفاصيل وتسليم التقرير: ${o.url}`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
