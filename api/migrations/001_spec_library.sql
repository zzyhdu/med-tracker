-- 迁移 001：规格库拆分
-- 旧模型：profiles 内联 name/packaging_*，trackers.drug_id 存的是 profiles.id
-- 新模型：共享 drugs 表，profiles.drug_id 引用之，并新增服药时刻调度列
--
-- 幂等：可重复执行，已迁移的库上所有步骤空转。
-- 安全：单事务执行；旧数据异常（回填后仍有空 drug_id）会整体回滚，不会留下半迁移状态。
--
-- 执行：psql "$DATABASE_URL" -f api/migrations/001_spec_library.sql

begin;

-- 1) 共享规格表（与 api/schema.sql 中的定义保持一致）
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

-- 2) profiles 新增列（先可空，回填后再收紧）
alter table profiles add column if not exists drug_id uuid;
alter table profiles add column if not exists timing_instruction text;
alter table profiles add column if not exists dose_times text[];
alter table profiles add column if not exists dose_slots text[];
alter table profiles add column if not exists dose_weekdays smallint[];
alter table profiles add column if not exists dose_anchor_date date;

-- 3) 把旧 profiles 内联的规格搬进 drugs 并回填 drug_id：每用户每药名一条。
--    distinct 防同用户重名重复建行；重复执行时 drug_id 已非空，本步骤自然空转。
--    整段包在 name 列存在性判断里：迁移过的库 name 已删除，直接引用会导致解析期报错。
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'name'
  ) then
    insert into drugs (created_by, name, packaging_size, packaging_unit, pill_unit)
    select distinct on (p.user_id, p.name)
      p.user_id, p.name, p.packaging_size, p.packaging_unit, p.pill_unit
    from profiles p
    where p.drug_id is null and p.name is not null
    order by p.user_id, p.name, p.created_at;

    update profiles p
    set drug_id = d.id
    from drugs d
    where p.drug_id is null
      and d.created_by = p.user_id
      and d.name = p.name;
  end if;
end $$;

-- 4) 完整性闸门：有残留即旧数据异常，回滚整个事务，人工排查后重跑
do $$
begin
  if exists (select 1 from profiles where drug_id is null) then
    raise exception 'migration 001 failed: % profiles rows have no drug to reference',
      (select count(*) from profiles where drug_id is null);
  end if;
end $$;

-- 5) 收紧 profiles：NOT NULL、外键、唯一约束；旧内联规格列下线
alter table profiles alter column drug_id set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_drug_id_fkey') then
    alter table profiles add constraint profiles_drug_id_fkey
      foreign key (drug_id) references drugs(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_user_id_drug_id_key') then
    alter table profiles add constraint profiles_user_id_drug_id_key unique (user_id, drug_id);
  end if;
end $$;
create index if not exists profiles_drug_id_idx on profiles(drug_id);

alter table profiles
  drop column if exists name,
  drop column if exists packaging_size,
  drop column if exists packaging_unit,
  drop column if exists pill_unit;

-- 6) trackers：旧 drug_id 列存的一直是 profiles.id（旧外键即指向 profiles(user_id, id)），改名即可
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'trackers' and column_name = 'drug_id'
  ) then
    alter table trackers drop constraint if exists trackers_user_id_drug_id_fkey;
    alter table trackers rename column drug_id to profile_id;
  end if;
end $$;
alter table trackers drop constraint if exists trackers_pkey;
alter table trackers add constraint trackers_pkey primary key (user_id, profile_id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trackers_user_id_profile_id_fkey') then
    alter table trackers add constraint trackers_user_id_profile_id_fkey
      foreign key (user_id, profile_id) references profiles(user_id, id) on delete cascade;
  end if;
end $$;

commit;
