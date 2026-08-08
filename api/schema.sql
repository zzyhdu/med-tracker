create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_email_lowercase check (email = lower(email))
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

-- 共享药物规格库：所有用户可读共用，仅创建者可修改/删除
create table if not exists drugs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references users(id) on delete cascade,
  name text not null,
  packaging_size numeric check (packaging_size is null or packaging_size > 0),
  packaging_unit text,
  pill_unit text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists drugs_created_by_idx on drugs(created_by);

-- 个人医嘱：每个用户对某款药自己的服用方法
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  drug_id uuid not null references drugs(id) on delete cascade,
  frequency text,
  dose_per_time numeric,
  daily_dosage numeric not null check (daily_dosage >= 0),
  alert_threshold_days numeric not null check (alert_threshold_days >= 0),
  timing_instruction text,
  dose_times text[],
  dose_slots text[],
  dose_weekdays smallint[], -- 周频次服药日（1=周一…7=周日），仅 qw/biw/tiw 用
  dose_anchor_date date, -- 隔 N 天频次的锚定服药日（该日服药、之后每隔 N-1 天服），仅 qod 等用
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, drug_id),
  unique (user_id, id)
);

create index if not exists profiles_user_id_idx on profiles(user_id);
create index if not exists profiles_drug_id_idx on profiles(drug_id);

create table if not exists trackers (
  user_id uuid not null,
  profile_id uuid not null,
  base_inventory numeric not null check (base_inventory >= 0),
  base_date timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, profile_id),
  foreign key (user_id, profile_id) references profiles(user_id, id) on delete cascade
);

create index if not exists trackers_user_id_idx on trackers(user_id);
