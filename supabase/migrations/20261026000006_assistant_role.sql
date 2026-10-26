-- التقسيم الحزبي: أمين (coordinator) ← أمين مساعد (assistant) ← عضو (member)
alter type public.member_role add value if not exists 'assistant' before 'coordinator';
