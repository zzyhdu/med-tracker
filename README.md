# med-tracker

私有药品库存追踪应用，当前仓库按部署栈组织：

- `web/`: React + Vite 前端
- `api/`: Node.js API
- `docs/`: 架构和部署文档
- `docker-compose.yml`: 本地或 ECS 单机部署编排

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

本机 Docker 预览：

```bash
POSTGRES_PASSWORD=example WEB_PORT=8080 docker compose up -d --build
```
