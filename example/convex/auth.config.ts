import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      type: "customJwt",
      // Must match the values stored via setupAuth:configure.
      issuer: "https://<your-deployment>.convex.site",
      applicationID: "your-application-id",
      jwks: "https://<your-deployment>.convex.site/.well-known/jwks.json",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
