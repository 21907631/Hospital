-- Hospital Appointment Scheduler schema for Supabase
-- Run this in Supabase SQL Editor before testing the app.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'patient' check (role in ('patient', 'doctor', 'admin')),
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key references public.profiles(id) on delete cascade,
  specialty text not null,
  bio text,
  experience_years integer default 0,
  license_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  max_patients integer not null default 1,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  reason text default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "doctors_select_public" on public.doctors
  for select using (true);

create policy "availability_select_public" on public.availability_slots
  for select using (true);

create policy "appointments_select_own" on public.appointments
  for select using (auth.uid() = patient_id or auth.uid() = doctor_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'patient')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
