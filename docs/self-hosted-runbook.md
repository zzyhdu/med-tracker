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

## ECS 部署

1. 复制 `.env.example` 为 `.env`，替换 `POSTGRES_PASSWORD`。
2. 构建并启动：

```bash
docker compose up -d --build
```

3. 创建登录账号：

```bash
docker compose exec api npm run create-user -- user@example.com strong-password
```

4. 浏览器访问 ECS 公网 IP 或域名。

本机预览时可以临时换端口，避免占用 80：

```bash
WEB_PORT=8080 docker compose up -d --build
```

## 备份

最低备份命令：

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

生产环境应把备份同步到 ECS 之外的位置，例如 OSS 或本地机器。
