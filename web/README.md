# med-tracker web

React + Vite 前端应用。生产环境由根目录的 `docker-compose.yml` 构建，并交给 Nginx 托管静态文件。

常用命令：

```bash
npm run dev
npm run build
npm run lint
```

开发模式下，`vite.config.ts` 会把 `/api` 代理到 `http://localhost:3000`。
