# 部署形态决策文档

## 背景

当前仓库已经整理为部署根目录。`web/` 是 Vite + React 前端应用，生产构建后产物是 `web/dist/` 静态文件；`api/` 是自托管 Node API。

现有数据层依赖 Supabase，Supabase 同时承担了以下职责：

- 邮箱密码登录
- 用户身份识别
- `profiles` 和 `trackers` 两张业务表的 CRUD
- 基于用户 ID 的数据隔离
- RLS 权限保护

后续计划将 Supabase 这类免费数据库 API 替换掉，并部署到自己的阿里云 ECS 上。

## 结论

采用以下部署形态：

```text
ECS
  Docker Compose
    nginx-web
      - 对外暴露 80/443
      - 托管 React 构建产物
      - 将 /api/* 反向代理到 api 服务

    api
      - Node.js 服务端
      - 负责登录、权限、业务接口
      - 只在 Docker 内网暴露端口

    postgres
      - PostgreSQL 数据库
      - 只在 Docker 内网暴露端口
      - 使用 volume 持久化数据
```

浏览器只访问 Nginx，不直接访问 Node API 容器或 PostgreSQL 容器。

## 为什么选择这个方案

### 适合少数人使用

该系统使用人数少，业务表也少。将 Nginx、Node API、PostgreSQL 都部署在同一台 ECS 上，结构简单、成本低、排查问题直接。

相比一开始就使用 RDS，这个方案减少了云资源成本。后续如果使用量增加，或对数据可靠性要求提高，可以再把 PostgreSQL 迁移到阿里云 RDS PostgreSQL。

### 必须增加服务端

替换 Supabase 后，不建议让前端直接连接数据库。

原因是传统 PostgreSQL/RDS 不能安全地把数据库账号暴露给浏览器。Supabase 之前隐藏了这部分复杂度，它实际提供了 Auth、API、权限校验、RLS 等能力。

因此替换 Supabase 时，需要由自己的 Node API 承担这些职责：

- 校验登录状态
- 管理 session
- 根据当前用户 ID 过滤数据
- 执行业务表读写
- 隐藏数据库连接信息

### 前端也使用 Docker

前端建议 Docker 化，但生产环境不运行 `vite dev` 或 `vite preview`。

推荐方式是多阶段构建：

```text
Node 镜像
  -> npm ci
  -> npm run build
  -> 生成 dist

Nginx 镜像
  -> 复制 dist 到 Nginx 静态目录
  -> 对外提供静态文件访问
```

这样 ECS 上不需要直接安装 Node/npm 来构建前端，部署时可以通过 Docker Compose 统一管理前端、API、数据库和网络。

## 目标架构

```text
用户浏览器
  |
  | HTTPS
  v
Nginx 容器
  |
  | /                 -> React dist 静态文件
  | /assets/*          -> React 静态资源
  | /api/*             -> 反向代理到 api:3000
  v
Node API 容器
  |
  | postgres://postgres:5432
  v
PostgreSQL 容器
```

只有 Nginx 需要暴露公网端口：

- `80`: HTTP，后续可重定向到 HTTPS
- `443`: HTTPS

API 和数据库不暴露到公网。

## 服务职责划分

### nginx-web

职责：

- 托管 React 构建产物
- 配置 HTTPS
- HTTP 跳转 HTTPS
- 反向代理 `/api/*` 到 Node API
- 设置静态资源缓存策略

不负责：

- 业务逻辑
- 登录校验
- 数据库连接

### api

职责：

- 用户登录
- 用户登出
- 当前用户信息查询
- `profiles` CRUD
- `trackers` CRUD
- 权限校验
- 数据库访问

推荐技术栈：

- Node.js
- Fastify 或 Express
- PostgreSQL driver，例如 `pg`
- 密码哈希，例如 `bcrypt` 或 `argon2`
- HttpOnly Cookie session

### postgres

职责：

- 存储用户和业务数据

推荐表：

- `users`
- `profiles`
- `trackers`

数据库容器必须挂载持久化 volume，避免容器重建后数据丢失。

## Supabase 替换范围

当前替换代码主要集中在：

- `web/src/utils/StorageUtils.ts`
- `web/src/App.tsx` 中的登录和 session 调用
- `web/src/utils/apiClient.ts`

目标是将前端从 Supabase SDK 改成访问自有 API：

```text
GET    /api/session
POST   /api/login
POST   /api/logout

GET    /api/profiles
POST   /api/profiles
PUT    /api/profiles/:id
DELETE /api/profiles/:id

GET    /api/trackers
POST   /api/trackers
PUT    /api/trackers/:drugId
DELETE /api/trackers/:drugId
```

前端只关心 API 返回的数据结构，不再直接关心数据库结构。

## 数据隔离策略

Supabase 原本通过 `auth.uid() = user_id` 的 RLS 策略隔离用户数据。

替换后，数据隔离由 Node API 实现：

- 登录成功后建立 session
- 每个请求从 session 中读取当前用户 ID
- 查询时始终附带 `where user_id = 当前用户ID`
- 写入时由服务端写入 `user_id`，不信任前端传入的 `user_id`
- 删除和更新时也必须同时校验资源归属

示例原则：

```sql
select * from profiles where user_id = $1;
delete from trackers where drug_id = $1 and user_id = $2;
```

## 数据库建议

第一阶段使用 ECS 上的 PostgreSQL Docker 容器。

必须做：

- 使用 Docker volume 持久化 `/var/lib/postgresql/data`
- 数据库端口不映射到公网
- 使用强密码
- 定期备份
- 备份文件不要只放在同一块系统盘上

后续升级路径：

```text
ECS PostgreSQL
  -> pg_dump 导出
  -> 阿里云 RDS PostgreSQL 导入
  -> API 修改 DATABASE_URL
```

## 备份策略

最低要求：

- 每日自动执行 `pg_dump`
- 保留最近 7 到 14 天备份
- 备份文件压缩
- 定期把备份同步到 ECS 以外的位置，例如 OSS、本地电脑或另一台服务器

不建议只依赖 Docker volume。volume 解决的是容器重建不丢数据，不等于备份。

## 安全要求

ECS 安全组：

- 开放 `22` 给固定 IP 或尽量收窄来源
- 开放 `80`
- 开放 `443`
- 不开放 PostgreSQL `5432`
- 不开放 Node API 端口

应用安全：

- 密码必须哈希存储
- Cookie 使用 `HttpOnly`
- 生产环境 Cookie 使用 `Secure`
- API 不信任前端传来的 `user_id`
- `.env` 不提交 Git
- 数据库密码、session secret 使用强随机值

Nginx：

- 配置 HTTPS
- HTTP 自动跳转 HTTPS
- 上传大小限制按实际需要设置
- 静态资源设置合理缓存

## 部署流程草案

1. 在项目中新增 `api/` 服务端目录。已完成。
2. 设计 PostgreSQL schema，替代 Supabase 的 `auth.users`、`profiles`、`trackers`。已完成。
3. 实现 Node API 的登录、session 和业务接口。已完成。
4. 将前端 Supabase 调用替换为 `/api` 调用。已完成。
5. 新增前端 Nginx Dockerfile。已完成。
6. 新增 API Dockerfile。已完成。
7. 新增 `docker-compose.yml`。已完成。
8. 在 ECS 安装 Docker 和 Docker Compose。
9. 配置 `.env`。
10. 执行 `docker compose up -d --build`。
11. 配置域名解析到 ECS 公网 IP。
12. 配置 HTTPS 证书。
13. 配置数据库自动备份。

## 后续可能升级

如果系统使用量增加，或数据可靠性要求提高，可以升级为：

```text
ECS
  nginx-web
  api

阿里云 RDS PostgreSQL
  托管数据库
  自动备份
  监控告警
```

此时应用侧主要改动是数据库连接字符串，业务 API 不需要大改。

## 当前决策

当前阶段采用：

```text
ECS + Docker Compose + Nginx 静态前端 + Node API + PostgreSQL 容器
```

该方案成本低、部署统一、适合少数人使用，并为后续迁移到 RDS 保留了清晰路径。
