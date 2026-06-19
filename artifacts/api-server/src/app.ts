import express, { type Express } from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
const pinoHttp =
  (pinoHttpModule as unknown as { default?: typeof pinoHttpModule }).default ??
  pinoHttpModule;
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const corsOriginsRaw = process.env["CORS_ORIGINS"] ?? "";
const allowedOrigins = corsOriginsRaw
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

if (allowedOrigins.length === 0) {
  logger.warn(
    "CORS_ORIGINS is empty — all browser requests will be rejected. Set it to a comma-separated whitelist.",
  );
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id: unknown; method: string; url?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, cb) {
      // Allow requests with no Origin header (curl, server-to-server, healthchecks).
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "X-Org-Id"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
