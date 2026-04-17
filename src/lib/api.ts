import type {
  AgentId,
  AgentPayload,
  LoginPayload,
  ProviderRecord,
} from "@shared/types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as Record<string, unknown>)
    : null;

  if (!response.ok) {
    throw new ApiError(
      String(payload?.message || `请求失败 (${response.status})`),
      response.status,
    );
  }

  return payload as T;
}

export function getSession(): Promise<LoginPayload> {
  return request<LoginPayload>("/api/session", { method: "GET" });
}

export function login(password: string): Promise<LoginPayload> {
  return request<LoginPayload>("/api/session/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function logout(): Promise<LoginPayload> {
  return request<LoginPayload>("/api/session/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchAgent(agent: AgentId): Promise<AgentPayload> {
  return request<AgentPayload>(`/api/agents/${agent}`, { method: "GET" });
}

export function createProvider(
  agent: AgentId,
  provider: ProviderRecord,
): Promise<AgentPayload> {
  return request<AgentPayload>(`/api/agents/${agent}/providers`, {
    method: "POST",
    body: JSON.stringify({ provider }),
  });
}

export function updateProvider(
  agent: AgentId,
  provider: ProviderRecord,
): Promise<AgentPayload> {
  return request<AgentPayload>(`/api/agents/${agent}/providers/${provider.id}`, {
    method: "PUT",
    body: JSON.stringify({ provider }),
  });
}

export function removeProvider(
  agent: AgentId,
  providerId: string,
): Promise<AgentPayload> {
  return request<AgentPayload>(`/api/agents/${agent}/providers/${providerId}`, {
    method: "DELETE",
  });
}

export function activateProvider(
  agent: AgentId,
  providerId: string,
): Promise<AgentPayload> {
  return request<AgentPayload>(
    `/api/agents/${agent}/providers/${providerId}/switch`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}
