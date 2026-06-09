# med-tracker self-hosted compose

This compose file is for standalone preview or a single-repo self-hosted run.
Production on the shared ECS should normally be started from `sites-stack`.

```bash
cp deploy/self-hosted/.env.example deploy/self-hosted/.env
docker compose -f deploy/self-hosted/compose.yml --env-file deploy/self-hosted/.env up -d --build
```

The web container listens on `WEB_PORT`, defaulting to `8080`.

Create or reset an app user:

```bash
docker compose -f deploy/self-hosted/compose.yml --env-file deploy/self-hosted/.env exec api npm run create-user -- user@example.com strong-password
```

Stop the standalone stack:

```bash
docker compose -f deploy/self-hosted/compose.yml --env-file deploy/self-hosted/.env down
```
