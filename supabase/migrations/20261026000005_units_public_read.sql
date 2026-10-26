-- أسماء المحافظات والمراكز معلومات عامة؛ صفحة التسجيل محتاجاها قبل تسجيل الدخول
create policy units_select_anon on public.units for select to anon using (true);
