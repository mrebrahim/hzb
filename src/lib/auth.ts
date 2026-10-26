import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  unit_id: string | null;
  role: 'member' | 'coordinator' | 'admin';
  activity_status: string;
  motivations: string[];
  skills: string[];
  available_days: number[];
  weekly_hours: number;
  max_open_tasks: number;
  units: { name: string } | null;
};

export async function requireProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, units(name)')
    .eq('id', user.id)
    .single<Profile>();
  if (!profile) redirect('/login');
  return { supabase, user, profile };
}

export async function requireStaff() {
  const ctx = await requireProfile();
  if (ctx.profile.role === 'member') redirect('/');
  return ctx;
}
