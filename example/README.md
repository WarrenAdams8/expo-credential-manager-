# Example App

This is a minimal Expo app that exercises the module on Android and proxies
`/api/*` routes to a Convex backend.

## Quick Start
1. Install dependencies.
2. Replace `SERVER_CLIENT_ID` in `example/App.tsx`.
3. Run `npm run convex:dev` in `example/` and follow the prompts to create a Convex project.
4. Copy `example/.env.example` to `example/.env` and set `CONVEX_HTTP_URL`.
5. Set `EXPO_PUBLIC_API_BASE_URL` if your API routes are not on the Metro host.
6. Run `npm run android`.

## Notes
- Use your server (web) OAuth client ID.
- Passkeys require backend WebAuthn endpoints.
- The example uses Expo API routes under `/api/*` (see `app/api` in Expo Router).
- The `app/api` routes proxy to Convex HTTP actions under `example/convex/http.ts`.

## Convex Env
Set these in your Convex deployment (via `npx convex env set`):
- `RP_ID`, `ORIGIN`
- `CONVEX_ISSUER`, `CONVEX_AUDIENCE`
- `JWT_PRIVATE_KEY_PEM`, `JWT_PUBLIC_JWK`, `JWT_KID`
- `GOOGLE_SERVER_CLIENT_ID` (optional: `GOOGLE_HOSTED_DOMAIN`)
