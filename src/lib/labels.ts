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

export const CATEGORY_STYLE: Record<string, { emoji: string; grad: string }> = {
  field_report: { emoji: '📋', grad: 'from-sky-500 to-indigo-500' },
  door_to_door: { emoji: '🚪', grad: 'from-amber-500 to-orange-500' },
  outreach: { emoji: '📣', grad: 'from-fuchsia-500 to-pink-500' },
  community_service: { emoji: '🤝', grad: 'from-emerald-500 to-teal-500' },
  recruitment: { emoji: '🧲', grad: 'from-violet-500 to-purple-600' },
  event_support: { emoji: '🎪', grad: 'from-rose-500 to-red-500' },
  training: { emoji: '🎓', grad: 'from-cyan-500 to-blue-500' },
  media: { emoji: '📸', grad: 'from-pink-500 to-rose-500' },
  organizing: { emoji: '🧭', grad: 'from-lime-500 to-green-600' },
};

// المستويات = مسؤوليات حقيقية في التنظيم، مش نقاط تتصرف
export const LEVELS = [
  { level: 1, name: 'عضو', floor: 0, emoji: '🌱', perk: 'بداية الرحلة — مهام قصيرة وواضحة' },
  { level: 2, name: 'عضو نشط', floor: 100, emoji: '⚡', perk: 'دعوة لبرنامج تدريب القيادات الشابة' },
  { level: 3, name: 'منسّق شارع/قرية', floor: 300, emoji: '🛡️', perk: 'قيادة فريق صغير + لقاء مع أمين المحافظة' },
  { level: 4, name: 'مرشّح لأمانة', floor: 800, emoji: '👑', perk: 'ترشيح لعضوية الأمانة + حضور المؤتمر المركزي' },
];

export type Stats = {
  total: number; points_30: number; points_prev_30: number; points_week: number;
  approved_total: number; attendance_total: number; streak_weeks: number;
  percentile_in_unit: number | null; unit_rank: number | null; unit_siblings: number;
};

export function badges(s: Stats) {
  return [
    { emoji: '🚀', name: 'أول خطوة', need: 'خلّص أول مهمة', on: s.approved_total >= 1 },
    { emoji: '🔥', name: 'نَفَس طويل', need: '3 أسابيع ورا بعض', on: s.streak_weeks >= 3 },
    { emoji: '📍', name: 'دايماً حاضر', need: 'احضر 5 فعاليات', on: s.attendance_total >= 5 },
    { emoji: '🎯', name: 'قنّاص المهام', need: '10 مهام معتمدة', on: s.approved_total >= 10 },
    { emoji: '⭐', name: 'نجم وحدته', need: 'أعلى 10% في وحدتك', on: (s.percentile_in_unit ?? 0) >= 90 },
    { emoji: '🏆', name: 'فريق البطولة', need: 'وحدتك رقم 1', on: s.unit_rank === 1 },
    { emoji: '💎', name: 'المحارب', need: '8 أسابيع ورا بعض', on: s.streak_weeks >= 8 },
    { emoji: '👑', name: 'الأسطورة', need: '800 نقطة', on: s.total >= 800 },
  ];
}

export function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join(' ');
}

export function timeLeft(d: string) {
  const ms = Date.parse(d) - Date.now();
  if (ms <= 0) return 'انتهى';
  const h = Math.floor(ms / 3600e3);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60e3))} دقيقة`;
  if (h < 48) return `${h} ساعة`;
  return `${Math.floor(h / 24)} يوم`;
}
