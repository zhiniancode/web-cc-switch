import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import type { AgentId, PromptRecord, ProviderRecord } from "../shared/types.js";
import { appendAuditEvent } from "./audit.js";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  clearSessionCookie,
  isAuthenticatedRequest,
  recordLoginFailure,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from "./auth.js";
import {
  deletePrompt,
  deleteProvider,
  listAgent,
  savePrompt,
  saveProvider,
  switchPrompt,
  switchProvider,
} from "./config-store.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";
const clientDistPath = path.resolve(process.cwd(), "dist/client");

app.set(
  "trust proxy",
  process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal",
);

function isAgentId(value: string): value is AgentId {
  return value === "claude" || value === "codex" || value === "gemini";
}

function getSingleParam(value: string | string[] | undefined, label: string): string {
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`无效的 ${label}`);
}

function getAgentId(request: Request): AgentId {
  const agent = getSingleParam(request.params.agent, "agent");
  if (!isAgentId(agent)) {
    throw new Error("无效的 agent");
  }
  return agent;
}

function getProviderFromBody(request: Request): ProviderRecord {
  const provider = request.body?.provider;
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    throw new Error("缺少 provider 数据");
  }
  return provider as ProviderRecord;
}

function getPromptFromBody(request: Request): PromptRecord {
  const prompt = request.body?.prompt;
  if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) {
    throw new Error("缺少 prompt 数据");
  }
  return prompt as PromptRecord;
}

function getClientOrigin(request: Request): string | null {
  const hostValue = request.get("host");
  if (!hostValue) {
    return null;
  }
  return `${request.protocol}://${hostValue}`;
}

function getAllowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const directOrigin = getClientOrigin(request);
  if (directOrigin) {
    origins.add(directOrigin);
  }

  const configuredOrigins = process.env.ALLOWED_ORIGINS;
  if (configuredOrigins) {
    for (const entry of configuredOrigins.split(",")) {
      const trimmed = entry.trim();
      if (trimmed) {
        origins.add(trimmed);
      }
    }
  }

  return origins;
}

function inferStatusCode(error: unknown): number {
  if (error instanceof SyntaxError) {
    return 400;
  }

  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("无效") ||
    message.includes("不能为空") ||
    message.includes("不存在") ||
    message.includes("缺少") ||
    message.includes("不一致") ||
    message.includes("必须是")
  ) {
    return 400;
  }

  return 500;
}

function sendError(response: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "服务器错误";
  response.status(inferStatusCode(error)).json({ message });
}

function buildAuditContext(request: Request) {
  return {
    ip: request.ip,
    userAgent: request.get("user-agent") || undefined,
    origin: request.get("origin") || undefined,
  };
}

function setSecurityHeaders(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.setHeader("Content-Security-Policy", csp);
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );

  next();
}

function validateRequestOrigin(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }

  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }

  if (getAllowedOrigins(request).has(origin)) {
    next();
    return;
  }

  response.status(403).json({ message: "Origin 不在允许列表中" });
}

app.disable("x-powered-by");
app.use(setSecurityHeaders);
app.use(validateRequestOrigin);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/session", (request, response) => {
  response.json({ authenticated: isAuthenticatedRequest(request) });
});

app.post("/api/session/login", async (request, response) => {
  const auditContext = buildAuditContext(request);
  const rateLimit = checkLoginRateLimit(request.ip);
  if (!rateLimit.allowed) {
    response.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    response.status(429).json({ message: "登录失败次数过多，请稍后再试" });
    await appendAuditEvent({
      type: "login_blocked",
      success: false,
      detail: `retry_after=${rateLimit.retryAfterSeconds}`,
      ...auditContext,
    }).catch(() => undefined);
    return;
  }

  const password = request.body?.password;
  if (typeof password !== "string" || !verifyPassword(password)) {
    recordLoginFailure(request.ip);
    response.status(401).json({ message: "密码错误" });
    await appendAuditEvent({
      type: "login_failed",
      success: false,
      ...auditContext,
    }).catch(() => undefined);
    return;
  }

  clearLoginFailures(request.ip);
  setSessionCookie(response);
  response.json({ authenticated: true });
  await appendAuditEvent({
    type: "login_success",
    success: true,
    ...auditContext,
  }).catch(() => undefined);
});

app.post("/api/session/logout", async (request, response) => {
  clearSessionCookie(response);
  response.json({ authenticated: false });
  await appendAuditEvent({
    type: "logout",
    success: true,
    ...buildAuditContext(request),
  }).catch(() => undefined);
});

app.get("/api/agents/:agent", requireAuth, async (request, response) => {
  try {
    response.json(await listAgent(getAgentId(request)));
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/agents/:agent/providers", requireAuth, async (request, response) => {
  const auditContext = buildAuditContext(request);
  try {
    const agent = getAgentId(request);
    const provider = getProviderFromBody(request);
    const payload = await saveProvider(agent, provider);
    response.json(payload);
    await appendAuditEvent({
      type: "provider_save",
      success: true,
      agent,
      providerId: provider.id,
      providerName: provider.name,
      ...auditContext,
    }).catch(() => undefined);
  } catch (error) {
    await appendAuditEvent({
      type: "provider_save",
      success: false,
      detail: error instanceof Error ? error.message : "unknown",
      ...auditContext,
    }).catch(() => undefined);
    sendError(response, error);
  }
});

app.put("/api/agents/:agent/providers/:id", requireAuth, async (request, response) => {
  const auditContext = buildAuditContext(request);
  try {
    const agent = getAgentId(request);
    const provider = getProviderFromBody(request);
    const providerId = getSingleParam(request.params.id, "provider");
    if (provider.id !== providerId) {
      throw new Error("Provider ID 不一致");
    }
    const payload = await saveProvider(agent, provider);
    response.json(payload);
    await appendAuditEvent({
      type: "provider_update",
      success: true,
      agent,
      providerId: provider.id,
      providerName: provider.name,
      ...auditContext,
    }).catch(() => undefined);
  } catch (error) {
    await appendAuditEvent({
      type: "provider_update",
      success: false,
      detail: error instanceof Error ? error.message : "unknown",
      ...auditContext,
    }).catch(() => undefined);
    sendError(response, error);
  }
});

app.delete("/api/agents/:agent/providers/:id", requireAuth, async (request, response) => {
  const auditContext = buildAuditContext(request);
  try {
    const agent = getAgentId(request);
    const providerId = getSingleParam(request.params.id, "provider");
    const payload = await deleteProvider(agent, providerId);
    response.json(payload);
    await appendAuditEvent({
      type: "provider_delete",
      success: true,
      agent,
      providerId,
      ...auditContext,
    }).catch(() => undefined);
  } catch (error) {
    await appendAuditEvent({
      type: "provider_delete",
      success: false,
      detail: error instanceof Error ? error.message : "unknown",
      ...auditContext,
    }).catch(() => undefined);
    sendError(response, error);
  }
});

app.post(
  "/api/agents/:agent/providers/:id/switch",
  requireAuth,
  async (request, response) => {
    const auditContext = buildAuditContext(request);
    try {
      const agent = getAgentId(request);
      const providerId = getSingleParam(request.params.id, "provider");
      const payload = await switchProvider(agent, providerId);
      response.json(payload);
      await appendAuditEvent({
        type: "provider_switch",
        success: true,
        agent,
        providerId,
        ...auditContext,
      }).catch(() => undefined);
    } catch (error) {
      await appendAuditEvent({
        type: "provider_switch",
        success: false,
        detail: error instanceof Error ? error.message : "unknown",
        ...auditContext,
      }).catch(() => undefined);
      sendError(response, error);
    }
  },
);

app.post("/api/agents/:agent/prompts", requireAuth, async (request, response) => {
  const auditContext = buildAuditContext(request);
  try {
    const agent = getAgentId(request);
    const prompt = getPromptFromBody(request);
    const payload = await savePrompt(agent, prompt);
    response.json(payload);
    await appendAuditEvent({
      type: "prompt_save",
      success: true,
      agent,
      promptId: prompt.id,
      promptName: prompt.name,
      ...auditContext,
    }).catch(() => undefined);
  } catch (error) {
    await appendAuditEvent({
      type: "prompt_save",
      success: false,
      detail: error instanceof Error ? error.message : "unknown",
      ...auditContext,
    }).catch(() => undefined);
    sendError(response, error);
  }
});

app.put("/api/agents/:agent/prompts/:id", requireAuth, async (request, response) => {
  const auditContext = buildAuditContext(request);
  try {
    const agent = getAgentId(request);
    const prompt = getPromptFromBody(request);
    const promptId = getSingleParam(request.params.id, "prompt");
    if (prompt.id !== promptId) {
      throw new Error("Prompt ID 不一致");
    }
    const payload = await savePrompt(agent, prompt);
    response.json(payload);
    await appendAuditEvent({
      type: "prompt_update",
      success: true,
      agent,
      promptId: prompt.id,
      promptName: prompt.name,
      ...auditContext,
    }).catch(() => undefined);
  } catch (error) {
    await appendAuditEvent({
      type: "prompt_update",
      success: false,
      detail: error instanceof Error ? error.message : "unknown",
      ...auditContext,
    }).catch(() => undefined);
    sendError(response, error);
  }
});

app.delete("/api/agents/:agent/prompts/:id", requireAuth, async (request, response) => {
  const auditContext = buildAuditContext(request);
  try {
    const agent = getAgentId(request);
    const promptId = getSingleParam(request.params.id, "prompt");
    const payload = await deletePrompt(agent, promptId);
    response.json(payload);
    await appendAuditEvent({
      type: "prompt_delete",
      success: true,
      agent,
      promptId,
      ...auditContext,
    }).catch(() => undefined);
  } catch (error) {
    await appendAuditEvent({
      type: "prompt_delete",
      success: false,
      detail: error instanceof Error ? error.message : "unknown",
      ...auditContext,
    }).catch(() => undefined);
    sendError(response, error);
  }
});

app.post(
  "/api/agents/:agent/prompts/:id/switch",
  requireAuth,
  async (request, response) => {
    const auditContext = buildAuditContext(request);
    try {
      const agent = getAgentId(request);
      const promptId = getSingleParam(request.params.id, "prompt");
      const payload = await switchPrompt(agent, promptId);
      response.json(payload);
      await appendAuditEvent({
        type: "prompt_switch",
        success: true,
        agent,
        promptId,
        ...auditContext,
      }).catch(() => undefined);
    } catch (error) {
      await appendAuditEvent({
        type: "prompt_switch",
        success: false,
        detail: error instanceof Error ? error.message : "unknown",
        ...auditContext,
      }).catch(() => undefined);
      sendError(response, error);
    }
  },
);

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api).*/, (_request, response) => {
    response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    sendError(response, error);
  },
);

app.listen(port, host, () => {
  console.log(`cc-switch-web listening on http://${host}:${port}`);
});
