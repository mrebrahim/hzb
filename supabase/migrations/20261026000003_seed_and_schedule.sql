-- الهيكل التنظيمي المبدئي: المستوى المركزي + 27 محافظة
-- (المراكز والأقسام والوحدات بيضيفها الأدمن/المنسق من لوحة التحكم)
insert into public.units(name, type) values ('الأمانة المركزية', 'national');

insert into public.units(name, type, parent_id)
select g, 'governorate', (select id from public.units where type = 'national' limit 1)
from unnest(array[
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية',
  'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء',
  'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مطروح'
]) as g;

-- الأتمتة كل 15 دقيقة: انتهاء العروض وإعادة التوزيع، التذكير، التصعيد، كشف الخاملين
create extension if not exists pg_cron;
select cron.schedule('hzb-automation', '*/15 * * * *', $$select public.run_automation()$$);
