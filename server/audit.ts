import fs from "node:fs/promises";
import path from "node:path";
import { AUDIT_LOG_PATH } from "./app-settings.js";

export interface AuditEvent {
  type: string;
  ip?: string;
  userAgent?: string;
  origin?: string;
  agent?: string;
  providerId?: string;
  providerName?: string;
  promptId?: string;
  promptName?: string;
  detail?: string;
  success?: boolean;
}

export async function appendAuditEvent(event: AuditEvent): Promise<void> {
  const record = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  await fs.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true });
  await fs.appendFile(AUDIT_LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
}
