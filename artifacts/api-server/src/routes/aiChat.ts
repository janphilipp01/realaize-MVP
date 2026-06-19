import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AiChatBody, AiChatResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { rateLimitByUser } from "../middlewares/rateLimitByUser";

const router: IRouter = Router();

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const aiChatRateLimit = rateLimitByUser({
  bucket: "ai_chat",
  windows: [
    { name: "minute", windowMs: 60_000, max: 20 },
    { name: "hour", windowMs: 60 * 60_000, max: 200 },
  ],
});

router.post("/ai/chat", requireAuth, aiChatRateLimit, async (req, res) => {
  const authId = req.auth?.authId ?? "unknown";
  const startedAt = Date.now();

  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    logger.info({ authId, status: 400 }, "ai_chat invalid body");
    res.status(400).json({
      error: `Invalid request body: ${parsed.error.message}`,
    });
    return;
  }

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    logger.warn({ authId }, "ai_chat called without ANTHROPIC_API_KEY configured");
    res.status(500).json({
      error: "ANTHROPIC_API_KEY is not configured on the server.",
    });
    return;
  }

  const { system, messages, maxTokens, model, webSearch } = parsed.data;
  const usedModel = model ?? DEFAULT_MODEL;

  logger.info(
    {
      authId,
      model: usedModel,
      messageCount: messages.length,
      maxTokens,
      webSearch: !!webSearch,
      hasSystem: !!system,
    },
    "ai_chat request",
  );

  try {
    const client = new Anthropic({ apiKey });
    const completion = await client.messages.create({
      model: usedModel,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(webSearch
        ? {
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 1,
              } as unknown as Anthropic.Messages.ToolUnion,
            ],
          }
        : {}),
    });

    const text = completion.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const payload = AiChatResponse.parse({
      text,
      model: completion.model,
      stopReason: completion.stop_reason,
    });

    logger.info(
      {
        authId,
        model: completion.model,
        stopReason: completion.stop_reason,
        inputTokens: completion.usage?.input_tokens,
        outputTokens: completion.usage?.output_tokens,
        latencyMs: Date.now() - startedAt,
      },
      "ai_chat success",
    );

    res.json(payload);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error(
      { authId, model: usedModel, latencyMs: Date.now() - startedAt, err: message },
      "ai_chat upstream error",
    );
    res.status(502).json({ error: `Upstream LLM error: ${message}` });
    return;
  }
});

export default router;
