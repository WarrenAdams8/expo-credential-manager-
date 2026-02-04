import { defineApp } from "convex/server";
import credentialAuth from "./components/credentialAuth/convex.config";

const app = defineApp();
app.use(credentialAuth);

export default app;
