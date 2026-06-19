// Vercel serverless entry for the API.
//
// Vercel routes every request under /api/* to this single function. The
// Express app (artifacts/api-server) already mounts its router at "/api", so
// it handles all sub-routing internally — we just hand the request off to it.
//
// An Express application instance is itself a (req, res) request listener, so
// it can be used directly as a Vercel Node handler. @vercel/node transpiles
// this file and bundles the imported app + its workspace dependencies.
import app from "../artifacts/api-server/src/app";

export default app;
