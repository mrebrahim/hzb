export const MOTIVATIONS = {
  values: 'عايز أخدم بلدي ومجتمعي',
  understanding: 'عايز أتعلم وأتدرب',
  social: 'عايز أتعرف على ناس وأكون مع صحابي',
  career: 'عايز أطلع في الهيكل ويبقى ليّا دور',
  enhancement: 'عايز أحس إن ليّا قيمة وتقدير',
  protective: 'التطوع بيريّحني من ضغوط الحياة',
} as const;

export const CATEGORIES = {
  field_report: 'تقرير ميداني',
  door_to_door: 'طرق أبواب',
  outreach: 'تواصل ونشر',
  community_service: 'خدمة مجتمعية',
  recruitment: 'تجنيد أعضاء',
  event_support: 'دعم فعالية',
  training: 'تدريب',
  media: 'إعلام ومحتوى',
  organizing: 'تنظيم وقيادة',
} as const;

export const SIZES = { small: 'صغيرة (10)', medium: 'متوسطة (25)', large: 'كبيرة (50)' } as const;
export const PRIORITIES = { p0: 'حرجة', p1: 'عالية', p2: 'عادية', p3: 'مؤجلة' } as const;

export const ASSIGNMENT_STATUS: Record<string, string> = {
  offered: 'معروضة عليك',
  accepted: 'قيد التنفيذ',
  declined: 'اعتذرت',
  expired: 'انتهت مهلتها',
  withdrawn: 'انسحبت',
  submitted: 'مستنية مراجعة',
  rework: 'محتاجة تعديل',
  approved: 'اتعتمدت',
  rejected: 'ما اتعتمدتش',
};

export const ACTIVITY_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'نشط', cls: 'bg-emerald-100 text-emerald-800' },
  slowing: { label: 'نشاطه بيقل', cls: 'bg-amber-100 text-amber-800' },
  dormant: { label: 'خامل', cls: 'bg-rose-100 text-rose-800' },
  suspended: { label: 'موقوف', cls: 'bg-gray-200 text-gray-700' },
};

export const ROLES = { member: 'عضو', coordinator: 'منسق/أمين', admin: 'أدمن' } as const;
export const UNIT_TYPES = { national: 'مركزي', governorate: 'محافظة', center: 'مركز/قسم', unit: 'وحدة/قرية' } as const;

export const DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

export const SKILLS = [
  'تصوير', 'تصميم', 'كتابة محتوى', 'إدارة صفحات', 'تنظيم فعاليات', 'خطابة',
  'تواصل ميداني', 'إدخال بيانات', 'قانون', 'طب وإسعافات', 'تدريس', 'قيادة فرق',
];

export const CONSENT_VERSION = 'v1-2026-10';

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(d));
}

export function pct(n: number, d: number) {
  return d > 0 ? Math.round((100 * n) / d) : 0;
}
