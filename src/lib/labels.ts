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
  offered: 'بانتظار ردك',
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
  slowing: { label: 'متراجع', cls: 'bg-amber-100 text-amber-800' },
  dormant: { label: 'خامل', cls: 'bg-rose-100 text-rose-800' },
  suspended: { label: 'موقوف', cls: 'bg-gray-200 text-gray-700' },
};

export const ROLES = { member: 'عضو', assistant: 'أمين مساعد', coordinator: 'أمين', admin: 'أدمن النظام' } as const;
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

export const CATEGORY_STYLE: Record<string, { icon: string; accent: string }> = {
  field_report: { icon: 'file', accent: 'border-navy-600' },
  door_to_door: { icon: 'users', accent: 'border-brand-600' },
  outreach: { icon: 'layers', accent: 'border-navy-500' },
  community_service: { icon: 'shield', accent: 'border-brand-500' },
  recruitment: { icon: 'users', accent: 'border-gold-500' },
  event_support: { icon: 'calendar', accent: 'border-navy-600' },
  training: { icon: 'award', accent: 'border-gold-500' },
  media: { icon: 'layers', accent: 'border-navy-500' },
  organizing: { icon: 'target', accent: 'border-brand-600' },
};

// المسار التنظيمي: كل مستوى = مسؤولية حقيقية في التنظيم
export const LEVELS = [
  { level: 1, name: 'عضو', floor: 0, perk: 'المشاركة في التكليفات الأساسية للوحدة' },
  { level: 2, name: 'عضو نشط', floor: 100, perk: 'الترشيح لبرنامج إعداد الكوادر والقيادات' },
  { level: 3, name: 'منسّق شارع/قرية', floor: 300, perk: 'قيادة فريق ميداني ولقاء دوري مع أمين المحافظة' },
  { level: 4, name: 'مرشّح لأمانة', floor: 800, perk: 'الترشيح لعضوية الأمانة وحضور المؤتمر العام' },
];

export type Stats = {
  total: number; points_30: number; points_prev_30: number; points_week: number;
  approved_total: number; attendance_total: number; streak_weeks: number;
  percentile_in_unit: number | null; unit_rank: number | null; unit_siblings: number;
};

// شهادات التقدير الرسمية اللي العضو بيستحقها بناءً على سجله
export function recognitions(s: Stats) {
  return [
    { name: 'شهادة بدء المشاركة', need: 'إنجاز أول تكليف معتمد', on: s.approved_total >= 1 },
    { name: 'شهادة الانتظام', need: 'نشاط 3 أسابيع متتالية', on: s.streak_weeks >= 3 },
    { name: 'شهادة الحضور التنظيمي', need: 'حضور 5 فعاليات', on: s.attendance_total >= 5 },
    { name: 'شهادة الإنجاز', need: '10 تكليفات معتمدة', on: s.approved_total >= 10 },
    { name: 'شهادة التميز على مستوى الوحدة', need: 'ضمن أعلى 10% في الوحدة', on: (s.percentile_in_unit ?? 0) >= 90 },
    { name: 'شهادة الوحدة الأولى', need: 'وحدتك في المركز الأول', on: s.unit_rank === 1 },
    { name: 'شهادة الالتزام المستمر', need: 'نشاط 8 أسابيع متتالية', on: s.streak_weeks >= 8 },
    { name: 'وسام الكادر التنظيمي', need: 'رصيد 800 نقطة', on: s.total >= 800 },
  ];
}

// التقييم الشهري حسب رصيد آخر 30 يوم
export function rating(points30: number) {
  if (points30 >= 120) return { label: 'ممتاز', cls: 'bg-brand-600 text-white' };
  if (points30 >= 60) return { label: 'جيد جداً', cls: 'bg-brand-100 text-brand-900' };
  if (points30 >= 25) return { label: 'جيد', cls: 'bg-navy-100 text-navy-800' };
  return { label: 'يحتاج تحسين', cls: 'bg-red-100 text-red-800' };
}

export function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join(' ');
}

export function timeLeft(d: string) {
  const ms = Date.parse(d) - Date.now();
  if (ms <= 0) return 'انتهت المهلة';
  const h = Math.floor(ms / 3600e3);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60e3))} دقيقة`;
  if (h < 48) return `${h} ساعة`;
  return `${Math.floor(h / 24)} يوم`;
}
