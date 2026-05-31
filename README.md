# med-tracker

私有药品库存追踪应用，当前仓库按部署栈组织：

- `web/`: React + Vite 前端
- `api/`: Node.js API
- `docs/`: 架构和部署文档
- `docker-compose.yml`: 本地或 ECS 单机部署编排

常用命令：

```bash
npm run web:dev
npm run api:dev
npm run build
npm run lint
npm run audit
```

本机 Docker 预览：

```bash
POSTGRES_PASSWORD=example WEB_PORT=8080 docker compose up -d --build
```
