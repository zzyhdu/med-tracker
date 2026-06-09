# sites-stack integration

`sites-stack` owns the production topology for this app. This repository is
included there as `sites/med-tracker` and provides only the application build
inputs.

The expected contract is:

- `web/Dockerfile` builds the React app and serves it with nginx on port `80`.
- `web/nginx.conf` proxies `/api/` to `http://api:3000/api/`.
- `api/Dockerfile` builds the Node API and exposes port `3000`.
- `api/schema.sql` initializes the PostgreSQL schema.

The `api` hostname is supplied by the `med-api` network alias in the
`sites-stack` root `compose.yml`. Do not change `web/nginx.conf` to point at a
host-only address; the frontend container must use Docker DNS.

`sites-stack` is responsible for:

- Caddy and public `80/443` ports.
- Docker service names and networks.
- PostgreSQL volume ownership.
- Production environment variables.

This repo's `deploy/self-hosted/compose.yml` is only for standalone runs.
