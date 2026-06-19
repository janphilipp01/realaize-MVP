// Serverless entry for Vercel (Build Output API).
//
// The existing Express `app` mounts its router at "/api" and is itself a
// (req, res) request listener, so it works directly as a Node serverless
// handler. We add one defensive step: ensure the incoming URL keeps its
// "/api" prefix before handing it to Express, regardless of how the platform
// router rewrites the destination path.
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

const listener = app as unknown as (
  req: IncomingMessage,
  res: ServerResponse,
) => void;

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? "/";
  if (!url.startsWith("/api")) {
    req.url = url === "/" ? "/api" : `/api${url.startsWith("/") ? "" : "/"}${url}`;
  }
  listener(req, res);
}
