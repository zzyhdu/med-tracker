-- 初始云端数据库表结构与安全策略 (Supabase Init Schema)
-- 该脚本用于在 Supabase后台 (SQL Editor) 首次初始化底层数据表和保险系统

-- 1. 创建专属的“医疗标准字典库” (Drug Profiles)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null, -- 强制绑定注册通行证
  name text not null,
  frequency text,
  dose_per_time numeric,
  daily_dosage numeric not null,
  packaging_size numeric,
  packaging_unit text,
  pill_unit text,
  alert_threshold_days numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 创建极度轻量的“动态库存追踪引擎表” (Drug Trackers)
create table public.trackers (
  drug_id uuid references public.profiles(id) on delete cascade primary key,
  user_id uuid references auth.users not null, -- 同样强制绑定通行证
  base_inventory numeric not null,
  base_date timestamp with time zone not null
);

-- 3. 拉起全球最高级别（RLS）安全数据防护网锁
alter table public.profiles enable row level security;
alter table public.trackers enable row level security;

-- 4. 刻录不可篡改的核心通行规则：您的邮箱通行证，只能看、改您自己录入的医疗数据！
create policy "Users can manage their own profiles" 
  on public.profiles for all using (auth.uid() = user_id);

create policy "Users can manage their own trackers" 
  on public.trackers for all using (auth.uid() = user_id);
