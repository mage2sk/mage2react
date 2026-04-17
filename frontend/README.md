# mage2react frontend

Astro + React + Tailwind v4 storefront for headless Magento.

## Run with Docker (dev)

From the project root:

```
docker compose up -d frontend
```

Then open https://mage2react.local (Traefik terminates TLS and routes the catch-all to this service; Magento paths stay on nginx).

## Local (without Docker)

```
pnpm install
pnpm dev   # http://localhost:4321
```

Magento GraphQL is reachable from the container at `http://nginx/graphql` via `dev_network`.
