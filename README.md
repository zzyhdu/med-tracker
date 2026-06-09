# med-tracker

私有药品库存追踪应用，当前仓库按部署栈组织：

- `web/`: React + Vite 前端
- `api/`: Node.js API
- `docs/`: 架构和部署文档
- `deploy/sites-stack/`: 与 `sites-stack` 总控仓库配合的部署契约
- `deploy/self-hosted/`: 单仓库自托管或本地 Docker 预览

常用命令：

```bash
# 启动前端 Vite 开发服务器
npm run web:dev

# 启动 Node.js API 开发服务器
npm run api:dev

# 构建前端生产静态资源
npm run build

# 检查前端代码规范
npm run lint

# 检查前端和 API 依赖安全问题
npm run audit
```

生产部署由 `~/workspace/sites-stack` 的根 `compose.yml` 统一编排。本仓库作为
`sites/med-tracker` submodule 时，只提供 `web/Dockerfile`、`api/Dockerfile`、
`web/nginx.conf` 和 `api/schema.sql`。

本机 Docker 预览或单仓库自托管：

```bash
cp deploy/self-hosted/.env.example deploy/self-hosted/.env
npm run selfhost:up
```

默认访问 `http://127.0.0.1:8080/`。
