# med-tracker web

React + Vite 前端应用。生产镜像由 `web/Dockerfile` 构建，并交给 Nginx 托管静态文件。
在 `sites-stack` 中，前端容器通过 Docker DNS 访问 `api:3000`。

常用命令：

```bash
npm run dev
npm run build
npm run lint
```

开发模式下，`vite.config.ts` 会把 `/api` 代理到 `http://localhost:3000`。
