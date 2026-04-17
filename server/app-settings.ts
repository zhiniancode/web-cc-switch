import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentId } from "../shared/types.js";

export interface AppSettings {
  claudeConfigDir?: string;
  codexConfigDir?: string;
  geminiConfigDir?: string;
}

export const HOME_DIR = os.homedir();
export const CC_SWITCH_HOME =
  process.env.CC_SWITCH_HOME || path.join(HOME_DIR, ".cc-switch");
export const SETTINGS_PATH = path.join(CC_SWITCH_HOME, "settings.json");
export const LIVE_BACKUP_DIR = path.join(CC_SWITCH_HOME, "backups", "live");
export const AUDIT_LOG_PATH = path.join(CC_SWITCH_HOME, "audit.log");

function expandHomePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed === "~") {
    return HOME_DIR;
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(HOME_DIR, trimmed.slice(2));
  }
  return trimmed;
}

async function readSettingsFile(): Promise<AppSettings> {
  try {
    const content = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(content) as AppSettings;
    return parsed ?? {};
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const settings = await readSettingsFile();
  return {
    claudeConfigDir: settings.claudeConfigDir?.trim() || undefined,
    codexConfigDir: settings.codexConfigDir?.trim() || undefined,
    geminiConfigDir: settings.geminiConfigDir?.trim() || undefined,
  };
}

export async function getConfigDir(agent: AgentId): Promise<string> {
  const settings = await getAppSettings();

  switch (agent) {
    case "claude":
      return settings.claudeConfigDir
        ? expandHomePath(settings.claudeConfigDir)
        : path.join(HOME_DIR, ".claude");
    case "codex":
      return settings.codexConfigDir
        ? expandHomePath(settings.codexConfigDir)
        : path.join(HOME_DIR, ".codex");
    case "gemini":
      return settings.geminiConfigDir
        ? expandHomePath(settings.geminiConfigDir)
        : path.join(HOME_DIR, ".gemini");
  }
}
