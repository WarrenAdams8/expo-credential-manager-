# Expo Credential Manager (Android)

Expo module that exposes Android Credential Manager to JavaScript for passkeys, passwords, and Sign in with Google. Includes an Expo config plugin.

## Features
- Passkey registration and sign-in using WebAuthn JSON from your backend.
- Password credential creation and retrieval.
- Google Sign-In via Credential Manager, including explicit consent flow.
- Mixed selector flow (passkey + password + Google) with a single UI.
- Optional config plugin for default `serverClientId` and `hostedDomainFilter`.

## Requirements
- iOS is a stub (methods throw `E_UNSUPPORTED_PLATFORM`).
- On Android 13 and lower, Credential Manager relies on Google Play services.
- Passkeys require Digital Asset Links between your Android app and your relying party domain.
- Your backend must provide WebAuthn registration/authentication JSON payloads.

### Android API Level Requirements

| Feature | Minimum API Level | Notes |
|---------|-------------------|-------|
| Password credentials | 21 (Android 5.0) | Basic password storage and retrieval |
| Google Sign-In (`googleId` / `signInWithGoogle`) | 21 (Android 5.0) | Requires Google Play Services |
| Passkeys (`createPasskey` / `publicKeyRequestJson`) | 21 (Android 5.0) | Requires Google Play Services on older devices |

> **Note:** `isAvailable()` returns `true` on all supported Android devices. Feature-specific errors are thrown at runtime if the device doesn't support a particular credential type.

## Install
Using npm:
```bash
npm install expo-credential-manager
```

Using Expo:
```bash
npx expo install expo-credential-manager
```

After installation, rebuild your development client:
```bash
npx expo prebuild
npx expo run:android
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

**Return Types:**
- `Passkey`: `{ type: 'publicKey'; responseJson: string }`
- `Password`: `{ type: 'password'; id: string; password: string }`
- `Google`: `{ type: 'google'; userId: string; idToken: string; email?: string; displayName?: string; familyName?: string; givenName?: string; phoneNumber?: string; profilePictureUri?: string }`

## Error Codes

| Code | Description |
|------|-------------|
| `E_UNSUPPORTED_PLATFORM` | Called on iOS or web, or native module not found |
| `E_INVALID_OPTIONS` | `getCredential()` called without any credential options |
| `E_INVALID_INPUT` | Invalid input (e.g., blank username, password, or requestJson) |
| `E_NO_ACTIVITY` | No foreground activity available |
| `E_CANCELLED` | User cancelled the credential operation |
| `E_NO_CREDENTIAL` | No matching credential found |
| `E_GOOGLE_SERVER_CLIENT_ID_REQUIRED` | Missing `serverClientId` for Google Sign-In |
| `E_GOOGLE_LINKED_SERVICE_ID_REQUIRED` | `idTokenDepositionScopes` requires `linkedServiceId` |
| `E_GOOGLE_PHONE_REQUIRES_SIGN_UP` | `requestVerifiedPhoneNumber` requires `filterByAuthorizedAccounts=false` |
| `E_GOOGLE_ID_TOKEN_PARSE` | Failed to parse Google ID token from credential |
| `E_UNEXPECTED_RESPONSE` | Unexpected response type from native credential API |
| `E_UNEXPECTED_CREDENTIAL_TYPE` | Expected Google credential but received a different type |
| `E_UNSUPPORTED_CREDENTIAL` | Unsupported credential type returned by the system |
| `E_INTERRUPTED` | Operation was interrupted |
| `E_NO_CREATE_OPTION` | No create option available for credential creation |
| `E_PROVIDER_CONFIGURATION` | Credential provider configuration error |
| `E_CREATE_CREDENTIAL` | Generic credential creation error |
| `E_GET_CREDENTIAL` | Generic credential retrieval error |
| `E_CLEAR_CREDENTIAL_STATE` | Failed to clear credential state |
| `E_CUSTOM` | Custom credential provider error |
| `E_UNKNOWN` | Unknown error occurred |

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

**Option Precedence:** JavaScript options override config plugin values. If you pass `serverClientId` in JS, it takes precedence over the plugin configuration.

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

// Passkey registration (your API routes)
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

// Passkey or password sign-in (your API routes)
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

## Google Sign-In: `googleId` vs `signInWithGoogle()`

This module provides two ways to sign in with Google:

| Method | Use Case | UI Behavior |
|--------|----------|-------------|
| `getCredential({ googleId: {...} })` | Mixed credential selector (passkey + password + Google) | Shows unified bottom sheet with all available credential types |
| `signInWithGoogle({...})` | Explicit Google-only consent flow | Shows Google account picker with explicit consent UI |

**When to use `googleId`:**
- You want a unified sign-in experience where users can choose between passkeys, passwords, and Google accounts
- For returning users with `filterByAuthorizedAccounts: true`
- When combining with `publicKeyRequestJson` and/or `password: true`

**When to use `signInWithGoogle()`:**
- You need explicit user consent (GDPR, new user sign-up flows)
- You want to limit to a Google Workspace domain via `hostedDomainFilter`
- You want a dedicated Google sign-in button experience

## Google Sign-In Options
- `filterByAuthorizedAccounts`: show only accounts that already granted consent.
- `autoSelectEnabled`: auto-select when there is a single available credential.
- `nonce`: include a nonce in the ID token for backend verification.
- `hostedDomainFilter` (optional): limit to a Google Workspace domain (enterprise only; omit for consumer apps).
- `linkedServiceId` + `idTokenDepositionScopes` (optional, advanced): for [Google Account Linking](https://developers.google.com/identity/account-linking) only; omit for most apps.
- `requestVerifiedPhoneNumber`: return `phoneNumber` when available.

## Where To Get `serverClientId`, `linkedServiceId`, and `hostedDomainFilter`
### `serverClientId` (required for Google Sign-In)
Use the **Web application** OAuth client ID from Google Cloud Console. This is the client
ID your backend uses to verify Google ID tokens. Create it in Google Cloud Console under
Google Auth Platform/Clients, selecting **Web application** as the client type.

### `linkedServiceId` + `idTokenDepositionScopes` (optional, advanced)
These are only needed if you're implementing [Google Account Linking](https://developers.google.com/identity/account-linking),
an advanced feature that lets users link their Google account to an existing account on your service.

- **`linkedServiceId`**: The service ID you register with Google when setting up account linking.
- **`idTokenDepositionScopes`**: OAuth scopes (e.g., `['https://www.googleapis.com/auth/userinfo.profile']`) 
  included when Google issues ID tokens for linked accounts.

**For most apps:** Omit both entirely. Only use them if you've registered a linked service with Google.

### `hostedDomainFilter` (optional)
`hostedDomainFilter` is **optional** and only needed for enterprise use cases. Use it to
restrict Sign in with Google to a specific **Google Workspace domain** (e.g., `example.com`).

- **Omit it entirely** for consumer apps that allow any Google account.
- Only set it if you want to limit sign-in to users from a specific organization.

## Security Considerations

### Sensitive Data Handling
- **Never log** `password` or `idToken` values. These are sensitive credentials.
- **Do not persist** credentials in AsyncStorage, state, or analytics.
- **Send credentials directly to your backend** for verification.

### Backend Verification (Required)
- **Google ID tokens**: Verify server-side using Google's tokeninfo endpoint or libraries. Check `aud` matches your `serverClientId` and validate `nonce` if used.
- **WebAuthn responses**: Verify `responseJson` server-side using your WebAuthn library (e.g., SimpleWebAuthn, webauthn-rs).
- **Passwords**: Never send plaintext passwords over unencrypted connections. Use HTTPS and hash passwords server-side.

### Example: Secure ID Token Handling
```ts
const credential = await signInWithGoogle({ serverClientId: 'YOUR_ID' });
// Send directly to backend - do not log or store
await fetch('/api/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken: credential.idToken }),
});
```

## Notes and Limitations
- Do not set `origin` in request JSON for native apps. Use Digital Asset Links instead.
- Passkey UX: keep passkeys as the primary sign-in option and passwords as a fallback.
- `signInWithGoogle` must be used alone (do not combine with passkey/password requests).
- Google credentials return `userId` (stable unique identifier) and optionally `email`, plus `idToken` for backend verification.
- Use your server (web) OAuth client ID for `serverClientId` (not the Android client ID).
- `requestVerifiedPhoneNumber` requires `filterByAuthorizedAccounts=false`.
- When using the config plugin, you can omit `serverClientId` and `hostedDomainFilter` in JS.

## Dev Build (Required)
This module includes native Android code, so it **won't work in Expo Go**. Use a dev build:
```bash
# inside your app
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android
```

For a shareable build, use EAS:
```bash
eas build -p android
```
