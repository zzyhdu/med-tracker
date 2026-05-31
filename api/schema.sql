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

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  frequency text,
  dose_per_time numeric,
  daily_dosage numeric not null check (daily_dosage >= 0),
  packaging_size numeric check (packaging_size is null or packaging_size > 0),
  packaging_unit text,
  pill_unit text,
  alert_threshold_days numeric not null check (alert_threshold_days >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, id)
);

create index if not exists profiles_user_id_idx on profiles(user_id);

create table if not exists trackers (
  user_id uuid not null,
  drug_id uuid not null,
  base_inventory numeric not null check (base_inventory >= 0),
  base_date timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, drug_id),
  foreign key (user_id, drug_id) references profiles(user_id, id) on delete cascade
);

create index if not exists trackers_user_id_idx on trackers(user_id);
