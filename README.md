# Expo Credential Manager (Android)

Expo module that exposes Android Credential Manager to JavaScript for passkeys, passwords, and Sign in with Google. Includes an Expo config plugin, an example app, and a reusable Convex auth component wired through Expo Router API routes.

## Features
- Passkey registration and sign-in using WebAuthn JSON from your backend.
- Password credential creation and retrieval.
- Google Sign-In via Credential Manager, including explicit consent flow.
- Mixed selector flow (passkey + password + Google) with a single UI.
- Optional config plugin for default `serverClientId` and `hostedDomainFilter`.
- Example app with Expo Router API routes that proxy to a Convex backend.
- Reusable Convex component that encapsulates passkeys + Google + password auth.

## Requirements
- Android 4.4 (API 19) and higher for password and federated sign-in.
- Android 9 (API 28) and higher for passkeys.
- On Android 13 and lower, Credential Manager relies on Google Play services.
- Passkeys require Digital Asset Links between your Android app and your relying party domain.
- Your backend must provide WebAuthn registration/authentication JSON payloads.
- iOS is a stub (methods throw `E_UNSUPPORTED_PLATFORM`).

## Install
```
# package name for this repo is expo-credential-manager
```

## API Summary
```ts
isAvailable(): Promise<boolean>
createPasskey(requestJson: string): Promise<{ type: 'publicKey'; responseJson: string }>
createPassword(username: string, password: string): Promise<{ type: 'password' }>
getCredential(options: {
  publicKeyRequestJson?: string
  password?: boolean
  googleId?: {
    serverClientId?: string
    nonce?: string
    filterByAuthorizedAccounts?: boolean
    autoSelectEnabled?: boolean
    linkedServiceId?: string
    idTokenDepositionScopes?: string[]
    requestVerifiedPhoneNumber?: boolean
  }
}): Promise<Passkey | Password | Google>
signInWithGoogle(options: {
  serverClientId?: string
  nonce?: string
  hostedDomainFilter?: string
}): Promise<Google>
clearCredentialState(): Promise<void>
```

## Expo Config Plugin (Optional)
Add a config plugin to provide default values on Android. These are used when
`serverClientId` (and `hostedDomainFilter` for Sign in with Google) are omitted in JS.

```json
{
  "expo": {
    "plugins": [
      [
        "expo-credential-manager",
        {
          "serverClientId": "YOUR_SERVER_CLIENT_ID",
          "hostedDomainFilter": "example.com"
        }
      ]
    ]
  }
}
```

## Usage
```ts
import {
  createPasskey,
  createPassword,
  signInWithGoogle,
  clearCredentialState,
  getCredential,
  isAvailable,
} from 'expo-credential-manager';

const available = await isAvailable();

// Passkey registration (Expo API routes)
const email = 'user@example.com';
const registrationJson = await fetch(`/api/webauthn/registration?email=${encodeURIComponent(email)}`).then(
  (r) => r.text()
);
const createResult = await createPasskey(registrationJson);
await fetch('/api/webauthn/registration/finish', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, responseJson: createResult.responseJson }),
});

// Passkey or password sign-in (Expo API routes)
const authJson = await fetch('/api/webauthn/authentication').then((r) => r.text());
const credential = await getCredential({
  publicKeyRequestJson: authJson,
  password: true,
  googleId: {
    serverClientId: 'YOUR_SERVER_CLIENT_ID',
    filterByAuthorizedAccounts: true,
    linkedServiceId: 'YOUR_LINKED_SERVICE_ID',
    idTokenDepositionScopes: ['https://www.googleapis.com/auth/userinfo.profile'],
  },
});

if (credential.type === 'publicKey') {
  await fetch('/api/webauthn/authentication/finish', {
    method: 'POST',
    body: credential.responseJson,
  });
} else if (credential.type === 'password') {
  // credential.id + credential.password
} else {
  // credential.idToken for backend verification
}

// Store a password credential
await createPassword('user@example.com', 's3cret');

// Sign in with Google (explicit consent flow)
const googleCredential = await signInWithGoogle({
  serverClientId: 'YOUR_SERVER_CLIENT_ID',
  hostedDomainFilter: 'example.com',
});

// Send ID token to backend for verification
await fetch('/api/google/verify', {
  method: 'POST',
  body: googleCredential.idToken,
});

// Sign out (clears cached state)
await clearCredentialState();
```

## Example Expo API Route: `/api/webauthn/authentication`
In the example app, API routes proxy to Convex HTTP actions. This keeps your client code
on `/api/*` while the backend lives in Convex. Set `CONVEX_HTTP_URL` in `example/.env`.

```ts
// example/app/api/webauthn/authentication+api.ts
import { proxyToConvex } from '../_convex';

export async function GET(req: Request) {
  return await proxyToConvex(req, '/api/webauthn/authentication');
}
```

## Google Sign-In Options
- `filterByAuthorizedAccounts`: show only accounts that already granted consent.
- `autoSelectEnabled`: auto-select when there is a single available credential.
- `nonce`: include a nonce in the ID token for backend verification.
- `hostedDomainFilter`: limit to a Google Workspace domain (Sign in with Google only).
- `linkedServiceId` + `idTokenDepositionScopes`: associate linked accounts.
- `requestVerifiedPhoneNumber`: return `phoneNumber` when available.

## Where To Get `serverClientId`, `linkedServiceId`, and `hostedDomainFilter`
### `serverClientId` (required for Google Sign-In)
Use the **Web application** OAuth client ID from Google Cloud Console. This is the client
ID your backend uses to verify Google ID tokens. Create it in Google Cloud Console under
Google Auth Platform/Clients, selecting **Web application** as the client type.

### `linkedServiceId` (only if you use linked accounts)
`linkedServiceId` is the **service ID used for linked account sign-in**. It is only needed
when you want Google to associate a Google account with an existing account on your backend
and issue ID tokens for linked accounts. If you are not implementing linked accounts, omit it.

### `hostedDomainFilter`
Use this to limit Sign in with Google to a **Google Workspace domain**, e.g. `example.com`
for enterprise-only sign-in. Leave it empty for consumer accounts.

## Convex Component (Example)
The example app includes a reusable Convex component under
`example/convex/components/credentialAuth` with:
- WebAuthn challenge generation + verification (actions).
- Google ID token verification (action).
- Email/password registration and login endpoints.
- Custom JWT signing and JWKS endpoint.

The app mounts the component in `example/convex/convex.config.ts` and proxies
`/api/*` routes to Convex HTTP actions.

To use the component in your own Convex app:
1. Copy `example/convex/components/credentialAuth` into your `convex/components/`.
2. Mount it in your `convex/convex.config.ts` with `defineApp().use(...)`.
3. Add HTTP routes that proxy to the component actions.
4. Run `setupAuth:configure` once to store config.

To run it locally:
1. In `example/`, run `npm run convex:dev` and follow the prompts.
2. Set Convex envs (see list below).
3. Run `npx convex run setupAuth:configure` once to store config in the component.
4. Copy `example/.env.example` to `example/.env` and set `CONVEX_HTTP_URL`.
5. Start the Expo app (`npm run android`).

Required Convex env variables:
- `RP_ID`, `ORIGIN`, `RP_NAME` (optional)
- `CONVEX_ISSUER`, `CONVEX_AUDIENCE`
- `JWT_PRIVATE_KEY_PEM`, `JWT_PUBLIC_JWK`, `JWT_KID`, `JWT_TTL_SECONDS` (optional)
- `GOOGLE_SERVER_CLIENT_ID` (optional: `GOOGLE_HOSTED_DOMAIN`)
## Notes and Limitations
- Do not set `origin` in request JSON for native apps. Use Digital Asset Links instead.
- Passkey UX: keep passkeys as the primary sign-in option and passwords as a fallback.
- `signInWithGoogle` must be used alone (do not combine with passkey/password requests).
- Google credentials return `id` (email) and `idToken` for backend verification.
- Use your server (web) OAuth client ID for `serverClientId` (not the Android client ID).
- `requestVerifiedPhoneNumber` requires `filterByAuthorizedAccounts=false`.
- When using the config plugin, you can omit `serverClientId` and `hostedDomainFilter` in JS.

## Example App
See `example/` for a minimal Expo app using Google Sign-In, mixed credential retrieval,
and Expo Router API routes that proxy to Convex HTTP actions under `example/app/api`.
