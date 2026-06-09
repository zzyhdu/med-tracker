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

## 备份

最低备份命令：

```bash
docker compose -f deploy/self-hosted/compose.yml --env-file deploy/self-hosted/.env exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

生产环境应把备份同步到 ECS 之外的位置，例如 OSS 或本地机器。
