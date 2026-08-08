# 自托管运行手册

## 本地开发

1. 启动 PostgreSQL，导入 `api/schema.sql`。
2. 在 `api/.env` 中配置。可以使用连接字符串：

```text
DATABASE_URL=postgres://med_tracker:password@localhost:5432/med_tracker
```

也可以使用独立环境变量：

```text
PGHOST=localhost
PGPORT=5432
PGDATABASE=med_tracker
PGUSER=med_tracker
PGPASSWORD=password
```

3. 安装前端和 API 依赖，并创建账号：

```bash
npm --prefix web install
npm --prefix api install
npm --prefix api run create-user -- user@example.com strong-password
```

4. 分别启动 API 和前端：

```bash
npm run api:dev
npm run web:dev
```

Vite 已把 `/api` 代理到 `http://localhost:3000`。

## sites-stack 生产部署

共享 ECS 生产环境由 `sites-stack` 统一管理。本仓库作为
`sites/med-tracker` submodule 提供应用源码、Dockerfile、nginx 配置和数据库
schema，不在仓库根目录维护生产 Compose 拓扑。

生产启动、域名入口、Docker network、PostgreSQL volume 和环境变量都在
`~/workspace/sites-stack` 中处理。

详见：

```text
deploy/sites-stack/README.md
```

## 数据库升级（已有数据的实例）

`api/schema.sql` 只适用于全新实例（`create table if not exists`，不会改动已有表）。
旧版本升级时必须先按顺序执行 `api/migrations/` 里的迁移脚本，再重建容器：

```bash
# 在 ECS 上、重建新容器之前执行（容器名以 sites-stack 实际为准）
cat sites/med-tracker/api/migrations/001_spec_library.sql \
  | docker exec -i med-tracker-postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

迁移脚本是幂等、单事务的：可重复执行；旧数据异常会整体回滚并报错，
不会留下半迁移状态。执行完再 `./scripts/up-stack.sh` 重建。

注意：`001_spec_library.sql` 会把旧医嘱按（用户， 药名）拆出共享规格。
若同一用户曾建过两条同名药品的医嘱，唯一约束会让迁移报错——先手工合并再重跑。

## 单仓库自托管

这套 Compose 只用于本地 Docker 预览或脱离 `sites-stack` 的单仓库运行。

1. 复制环境变量示例并替换 `POSTGRES_PASSWORD`。

```bash
cp deploy/self-hosted/.env.example deploy/self-hosted/.env
```

2. 构建并启动。

```bash
npm run selfhost:up
```

3. 创建登录账号。

```bash
npm run selfhost:create-user -- user@example.com strong-password
```

4. 浏览器访问 `http://127.0.0.1:8080/`，或在
`deploy/self-hosted/.env` 中调整 `WEB_PORT`。

直接使用 Docker Compose 也可以：

```bash
docker compose -f deploy/self-hosted/compose.yml --env-file deploy/self-hosted/.env up -d --build
```

停止单仓库自托管：

```bash
npm run selfhost:down
```

## 数据同步（本地 → 线上）

### 网页界面（推荐）

「标准规格字典库」页 →「备份与迁移」：源实例登录后点「下载备份文件（JSON）」，
目标实例登录后点「导入备份」选择该文件。关联键是药品名，与实例无关；
规格按名字复用或新建，医嘱按药品覆盖，追踪 upsert，重复导入不产生重复数据。

### 命令行脚本

`api/scripts/sync-to-remote.js` 通过 HTTP API 把一台实例的数据搬到另一台实例，
不需要 SSH 或数据库端口暴露。同步内容：共享药物规格、当前账号的医嘱、库存追踪。

幂等：规格按名字复用、医嘱按 (用户, 药品) 更新、追踪 upsert，重复执行不产生重复数据。

预演（只读，先核对要搬什么）：

```bash
SOURCE_EMAIL=dev@example.com SOURCE_PASSWORD=xxx npm --prefix api run sync-remote -- --dry-run
```

正式执行（默认目标 `https://med.yangsan.online`，用 `TARGET_BASE` 可改）：

```bash
SOURCE_EMAIL=dev@example.com SOURCE_PASSWORD=xxx \
TARGET_EMAIL=you@example.com TARGET_PASSWORD=yyy \
npm --prefix api run sync-remote
```

## 备份

最低备份命令：

```bash
docker compose -f deploy/self-hosted/compose.yml --env-file deploy/self-hosted/.env exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

生产环境应把备份同步到 ECS 之外的位置，例如 OSS 或本地机器。
