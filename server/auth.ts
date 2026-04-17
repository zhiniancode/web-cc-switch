import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "cc_switch_web_session";
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 12);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 10 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOGIN_BLOCK_MS = Number(process.env.LOGIN_BLOCK_MS || 15 * 60 * 1000);

interface LoginAttemptState {
  count: number;
  resetAt: number;
  blockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttemptState>();

function getPasswordHash(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

function getAdminPassword(): string {
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  return configuredPassword || "";
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? getPasswordHash(getAdminPassword()).toString("hex");
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function buildToken(expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ expiresAt }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  if (sign(payload) !== signature) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      expiresAt?: number;
    };
    return typeof decoded.expiresAt === "number" && decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(headerValue: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headerValue) {
    return result;
  }

  for (const pair of headerValue.split(";")) {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) {
      continue;
    }
    result[rawKey] = decodeURIComponent(rest.join("="));
  }

  return result;
}

function createCookieValue(token: string, maxAgeSeconds: number): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function verifyPassword(input: string): boolean {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return false;
  }

  const inputHash = getPasswordHash(input);
  const passwordHash = getPasswordHash(adminPassword);
  return crypto.timingSafeEqual(inputHash, passwordHash);
}

export function setSessionCookie(response: Response): void {
  const token = buildToken(Date.now() + SESSION_TTL_SECONDS * 1000);
  response.setHeader("Set-Cookie", createCookieValue(token, SESSION_TTL_SECONDS));
}

export function clearSessionCookie(response: Response): void {
  response.setHeader("Set-Cookie", createCookieValue("", 0));
}

function normalizeIpAddress(ipAddress: string | undefined): string {
  if (!ipAddress) {
    return "unknown";
  }
  return ipAddress.trim() || "unknown";
}

function getAttemptState(ipAddress: string): LoginAttemptState {
  const normalizedIp = normalizeIpAddress(ipAddress);
  const now = Date.now();
  const existing = loginAttempts.get(normalizedIp);
  if (!existing || existing.resetAt <= now) {
    const nextState: LoginAttemptState = {
      count: 0,
      resetAt: now + LOGIN_WINDOW_MS,
      blockedUntil: 0,
    };
    loginAttempts.set(normalizedIp, nextState);
    return nextState;
  }
  return existing;
}

export function checkLoginRateLimit(ipAddress: string | undefined): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const normalizedIp = normalizeIpAddress(ipAddress);
  const now = Date.now();
  const attemptState = getAttemptState(normalizedIp);

  if (attemptState.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((attemptState.blockedUntil - now) / 1000),
      ),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function recordLoginFailure(ipAddress: string | undefined): void {
  const normalizedIp = normalizeIpAddress(ipAddress);
  const now = Date.now();
  const attemptState = getAttemptState(normalizedIp);
  attemptState.count += 1;
  if (attemptState.count >= LOGIN_MAX_ATTEMPTS) {
    attemptState.blockedUntil = now + LOGIN_BLOCK_MS;
    attemptState.count = 0;
    attemptState.resetAt = now + LOGIN_WINDOW_MS;
  }
  loginAttempts.set(normalizedIp, attemptState);
}

export function clearLoginFailures(ipAddress: string | undefined): void {
  loginAttempts.delete(normalizeIpAddress(ipAddress));
}

export function isAuthenticatedRequest(request: Request): boolean {
  const cookies = parseCookies(request.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME]);
}

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!isAuthenticatedRequest(request)) {
    response.status(401).json({ message: "未登录或登录已失效" });
    return;
  }

  next();
}
