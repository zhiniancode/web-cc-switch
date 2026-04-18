import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import type {
  AgentConfig,
  AgentId,
  AgentPayload,
  PromptRecord,
  ProviderCategory,
  ProviderRecord,
  SwitchConfigFile,
} from "../shared/types.js";
import {
  CC_SWITCH_HOME,
  LIVE_BACKUP_DIR,
  getConfigDir,
} from "./app-settings.js";

const AGENTS: AgentId[] = ["claude", "codex", "gemini"];
const CONFIG_PATH = path.join(CC_SWITCH_HOME, "config.json");
const LIVE_BACKUP_RETENTION = Math.max(
  1,
  Number(process.env.LIVE_BACKUP_RETENTION || 60),
);

const DEFAULT_CATEGORY: Record<AgentId, ProviderCategory> = {
  claude: "official",
  codex: "official",
  gemini: "official",
};

interface LiveArtifact {
  path: string;
  content: string | null;
}

interface LiveSnapshot {
  agent: AgentId;
  capturedAt: string;
  files: LiveArtifact[];
}

interface BackupMetadata {
  reason: string;
  fromProviderId?: string;
  toProviderId?: string;
  providerName?: string;
  fromPromptId?: string;
  toPromptId?: string;
  promptName?: string;
}

let mutationChain: Promise<void> = Promise.resolve();

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const pending = mutationChain.catch(() => undefined).then(operation);
  mutationChain = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

function sortProviders(providers: Record<string, ProviderRecord>): ProviderRecord[] {
  return Object.values(providers).sort((left, right) => {
    const leftSort = left.sortIndex ?? Number.MAX_SAFE_INTEGER;
    const rightSort = right.sortIndex ?? Number.MAX_SAFE_INTEGER;
    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    const leftCreated = left.createdAt ?? 0;
    const rightCreated = right.createdAt ?? 0;
    if (leftCreated !== rightCreated) {
      return leftCreated - rightCreated;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function sortPrompts(prompts: Record<string, PromptRecord>): PromptRecord[] {
  return Object.values(prompts).sort((left, right) => {
    const leftSort = left.sortIndex ?? Number.MAX_SAFE_INTEGER;
    const rightSort = right.sortIndex ?? Number.MAX_SAFE_INTEGER;
    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    const leftCreated = left.createdAt ?? 0;
    const rightCreated = right.createdAt ?? 0;
    if (leftCreated !== rightCreated) {
      return leftCreated - rightCreated;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function ensureObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`);
  }

  return value as Record<string, unknown>;
}

function ensureString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} 必须是字符串`);
  }

  return value;
}

function ensureStringRecord(
  value: unknown,
  label: string,
): Record<string, string> {
  const objectValue = ensureObject(value, label);
  const result: Record<string, string> = {};

  for (const [key, entry] of Object.entries(objectValue)) {
    if (typeof entry !== "string") {
      throw new Error(`${label}.${key} 必须是字符串`);
    }
    result[key] = entry;
  }

  return result;
}

function normalizeProvider(agent: AgentId, provider: ProviderRecord): ProviderRecord {
  const name = provider.name.trim();
  if (!name) {
    throw new Error("Provider 名称不能为空");
  }

  const normalized: ProviderRecord = {
    id: provider.id || crypto.randomUUID(),
    name,
    settingsConfig: ensureObject(provider.settingsConfig, "settingsConfig"),
    websiteUrl: provider.websiteUrl?.trim() || undefined,
    category: provider.category ?? DEFAULT_CATEGORY[agent],
    createdAt: provider.createdAt ?? Date.now(),
    sortIndex:
      typeof provider.sortIndex === "number" && Number.isFinite(provider.sortIndex)
        ? provider.sortIndex
        : undefined,
    notes: provider.notes?.trim() || undefined,
    meta: provider.meta ?? undefined,
  };

  switch (agent) {
    case "claude": {
      normalized.settingsConfig = ensureObject(
        normalized.settingsConfig,
        "Claude settingsConfig",
      );
      break;
    }
    case "codex": {
      const settings = ensureObject(normalized.settingsConfig, "Codex settingsConfig");
      settings.auth = ensureObject(settings.auth, "Codex auth");
      const configText =
        settings.config === undefined || settings.config === null
          ? ""
          : ensureString(settings.config, "Codex config");
      if (configText.trim()) {
        parseToml(configText);
      }
      normalized.settingsConfig = {
        auth: settings.auth,
        config: configText,
      };
      break;
    }
    case "gemini": {
      const settings = ensureObject(normalized.settingsConfig, "Gemini settingsConfig");
      const envValue =
        settings.env === undefined ? {} : ensureStringRecord(settings.env, "Gemini env");
      const configValue =
        settings.config === undefined || settings.config === null
          ? {}
          : ensureObject(settings.config, "Gemini settings");
      normalized.settingsConfig = {
        env: envValue,
        config: configValue,
      };
      break;
    }
  }

  return normalized;
}

function normalizePrompt(prompt: PromptRecord): PromptRecord {
  const name = prompt.name.trim();
  if (!name) {
    throw new Error("提示词名称不能为空");
  }

  if (typeof prompt.content !== "string") {
    throw new Error("提示词内容必须是字符串");
  }

  return {
    id: prompt.id || crypto.randomUUID(),
    name,
    content: prompt.content,
    createdAt: prompt.createdAt ?? Date.now(),
    sortIndex:
      typeof prompt.sortIndex === "number" && Number.isFinite(prompt.sortIndex)
        ? prompt.sortIndex
        : undefined,
  };
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  const text = await readFileIfExists(filePath);
  if (text === null) {
    return null;
  }
  return JSON.parse(text) as T;
}

async function ensurePrivateFileMode(filePath: string): Promise<void> {
  if (process.platform === "win32") {
    return;
  }

  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // Best effort only.
  }
}

async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError.code !== "ENOENT") {
      throw error;
    }
  }
}

async function writeTextAtomic(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
  await ensurePrivateFileMode(filePath);
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeTextAtomic(filePath, content);
}

function createEmptyAgentConfig(): AgentConfig {
  return {
    providers: {},
    current: "",
    prompts: {},
    currentPrompt: "",
  };
}

function ensureConfigShape(config: SwitchConfigFile): SwitchConfigFile {
  for (const agent of AGENTS) {
    config[agent] ??= createEmptyAgentConfig();
    config[agent]!.providers ??= {};
    config[agent]!.current ??= "";
    config[agent]!.prompts ??= {};
    config[agent]!.currentPrompt ??= "";
  }
  return config;
}

async function readConfigFile(): Promise<SwitchConfigFile> {
  const config = (await readJsonIfExists<SwitchConfigFile>(CONFIG_PATH)) ?? {};
  return ensureConfigShape(config);
}

async function saveConfigFile(config: SwitchConfigFile): Promise<void> {
  await fs.mkdir(CC_SWITCH_HOME, { recursive: true });
  await writeJsonAtomic(CONFIG_PATH, ensureConfigShape(config));
}

async function getClaudeSettingsPath(): Promise<string> {
  const claudeDir = await getConfigDir("claude");
  const primary = path.join(claudeDir, "settings.json");
  const legacy = path.join(claudeDir, "claude.json");

  if ((await readFileIfExists(primary)) !== null) {
    return primary;
  }
  if ((await readFileIfExists(legacy)) !== null) {
    return legacy;
  }
  return primary;
}

async function getCodexAuthPath(): Promise<string> {
  return path.join(await getConfigDir("codex"), "auth.json");
}

async function getCodexConfigPath(): Promise<string> {
  return path.join(await getConfigDir("codex"), "config.toml");
}

async function getGeminiEnvPath(): Promise<string> {
  return path.join(await getConfigDir("gemini"), ".env");
}

async function getGeminiSettingsPath(): Promise<string> {
  return path.join(await getConfigDir("gemini"), "settings.json");
}

async function getPromptPath(agent: AgentId): Promise<string> {
  const fileName = (() => {
    switch (agent) {
      case "claude":
        return "CLAUDE.md";
      case "codex":
        return "AGENTS.md";
      case "gemini":
        return "GEMINI.md";
    }
  })();

  return path.join(await getConfigDir(agent), fileName);
}

async function resolveLiveFilePaths(agent: AgentId): Promise<string[]> {
  switch (agent) {
    case "claude":
      return [await getClaudeSettingsPath()];
    case "codex":
      return [await getCodexAuthPath(), await getCodexConfigPath()];
    case "gemini":
      return [await getGeminiEnvPath(), await getGeminiSettingsPath()];
  }
}

async function captureLiveSnapshot(agent: AgentId): Promise<LiveSnapshot> {
  const filePaths = await resolveLiveFilePaths(agent);
  const files = await Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      content: await readFileIfExists(filePath),
    })),
  );

  return {
    agent,
    capturedAt: new Date().toISOString(),
    files,
  };
}

async function restoreLiveSnapshot(snapshot: LiveSnapshot): Promise<void> {
  for (const artifact of snapshot.files) {
    if (artifact.content === null) {
      await deleteFileIfExists(artifact.path);
      continue;
    }
    await writeTextAtomic(artifact.path, artifact.content);
  }
}

async function capturePromptSnapshot(agent: AgentId): Promise<LiveSnapshot> {
  const promptPath = await getPromptPath(agent);
  return {
    agent,
    capturedAt: new Date().toISOString(),
    files: [
      {
        path: promptPath,
        content: await readFileIfExists(promptPath),
      },
    ],
  };
}

async function readLivePrompt(agent: AgentId): Promise<string | null> {
  return readFileIfExists(await getPromptPath(agent));
}

async function pruneLiveBackups(agent: AgentId): Promise<void> {
  try {
    const entries = await fs.readdir(LIVE_BACKUP_DIR, { withFileTypes: true });
    const snapshots = entries
      .filter((entry) => entry.isFile() && entry.name.includes(`-${agent}-`))
      .map((entry) => entry.name)
      .sort()
      .reverse();

    if (snapshots.length <= LIVE_BACKUP_RETENTION) {
      return;
    }

    for (const snapshotName of snapshots.slice(LIVE_BACKUP_RETENTION)) {
      await deleteFileIfExists(path.join(LIVE_BACKUP_DIR, snapshotName));
    }
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError.code !== "ENOENT") {
      throw error;
    }
  }
}

async function persistLiveBackup(
  snapshot: LiveSnapshot,
  metadata: BackupMetadata,
): Promise<void> {
  await fs.mkdir(LIVE_BACKUP_DIR, { recursive: true });
  const fileName = [
    Date.now(),
    snapshot.agent,
    metadata.reason,
    crypto.randomUUID(),
  ].join("-");
  const backupPath = path.join(LIVE_BACKUP_DIR, `${fileName}.json`);
  await writeJsonAtomic(backupPath, {
    ...metadata,
    ...snapshot,
  });
  await pruneLiveBackups(snapshot.agent);
}

function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    result[key] = value;
  }

  return result;
}

function stringifyEnvContent(envMap: Record<string, string>): string {
  const lines = Object.keys(envMap)
    .sort()
    .map((key) => `${key}=${envMap[key] ?? ""}`);

  return lines.join("\n");
}

function findSnapshotContent(snapshot: LiveSnapshot, targetPath: string): string | null {
  return snapshot.files.find((artifact) => artifact.path === targetPath)?.content ?? null;
}

async function readLiveProvider(agent: AgentId): Promise<Record<string, unknown> | null> {
  const snapshot = await captureLiveSnapshot(agent);

  switch (agent) {
    case "claude": {
      const settingsPath = await getClaudeSettingsPath();
      const content = findSnapshotContent(snapshot, settingsPath);
      return content ? (JSON.parse(content) as Record<string, unknown>) : null;
    }
    case "codex": {
      const authPath = await getCodexAuthPath();
      const authContent = findSnapshotContent(snapshot, authPath);
      if (!authContent) {
        return null;
      }
      const configContent = findSnapshotContent(snapshot, await getCodexConfigPath()) ?? "";
      return {
        auth: JSON.parse(authContent) as Record<string, unknown>,
        config: configContent,
      };
    }
    case "gemini": {
      const envContent = findSnapshotContent(snapshot, await getGeminiEnvPath());
      const settingsContent =
        findSnapshotContent(snapshot, await getGeminiSettingsPath()) ?? "{}";

      if (envContent === null && settingsContent.trim() === "{}") {
        return null;
      }

      return {
        env: envContent ? parseEnvContent(envContent) : {},
        config: JSON.parse(settingsContent) as Record<string, unknown>,
      };
    }
  }
}

async function buildLiveArtifacts(
  agent: AgentId,
  provider: ProviderRecord,
): Promise<LiveArtifact[]> {
  switch (agent) {
    case "claude": {
      return [
        {
          path: await getClaudeSettingsPath(),
          content: `${JSON.stringify(provider.settingsConfig, null, 2)}\n`,
        },
      ];
    }
    case "codex": {
      const settings = ensureObject(provider.settingsConfig, "Codex settingsConfig");
      const auth = ensureObject(settings.auth, "Codex auth");
      const config = typeof settings.config === "string" ? settings.config : "";
      return [
        {
          path: await getCodexAuthPath(),
          content: `${JSON.stringify(auth, null, 2)}\n`,
        },
        {
          path: await getCodexConfigPath(),
          content: config,
        },
      ];
    }
    case "gemini": {
      const settings = ensureObject(provider.settingsConfig, "Gemini settingsConfig");
      const envMap = settings.env
        ? ensureStringRecord(settings.env, "Gemini env")
        : {};
      const geminiConfig = settings.config
        ? ensureObject(settings.config, "Gemini config")
        : {};
      return [
        {
          path: await getGeminiEnvPath(),
          content: stringifyEnvContent(envMap),
        },
        {
          path: await getGeminiSettingsPath(),
          content: `${JSON.stringify(geminiConfig, null, 2)}\n`,
        },
      ];
    }
  }
}

async function writeLivePrompt(agent: AgentId, prompt: PromptRecord): Promise<void> {
  await writeTextAtomic(await getPromptPath(agent), prompt.content);
}

async function clearLivePrompt(agent: AgentId): Promise<void> {
  await deleteFileIfExists(await getPromptPath(agent));
}

async function writeLiveProvider(
  agent: AgentId,
  provider: ProviderRecord,
): Promise<void> {
  const artifacts = await buildLiveArtifacts(agent, provider);
  for (const artifact of artifacts) {
    await writeTextAtomic(artifact.path, artifact.content ?? "");
  }
}

async function clearLiveFiles(agent: AgentId): Promise<void> {
  const filePaths = await resolveLiveFilePaths(agent);
  for (const filePath of filePaths) {
    await deleteFileIfExists(filePath);
  }
}

async function commitConfigAndMaybeLive(params: {
  agent: AgentId;
  config: SwitchConfigFile;
  liveProvider?: ProviderRecord;
  clearLive?: boolean;
  backup: BackupMetadata;
}): Promise<void> {
  const snapshot = params.liveProvider || params.clearLive
    ? await captureLiveSnapshot(params.agent)
    : null;

  if (snapshot) {
    await persistLiveBackup(snapshot, params.backup);
  }

  try {
    if (params.liveProvider) {
      await writeLiveProvider(params.agent, params.liveProvider);
    } else if (params.clearLive) {
      await clearLiveFiles(params.agent);
    }
    await saveConfigFile(params.config);
  } catch (error) {
    if (snapshot) {
      await restoreLiveSnapshot(snapshot);
    }
    throw error;
  }
}

async function commitConfigAndMaybePrompt(params: {
  agent: AgentId;
  config: SwitchConfigFile;
  livePrompt?: PromptRecord;
  clearLive?: boolean;
  backup: BackupMetadata;
}): Promise<void> {
  const snapshot =
    params.livePrompt || params.clearLive ? await capturePromptSnapshot(params.agent) : null;

  if (snapshot) {
    await persistLiveBackup(snapshot, params.backup);
  }

  try {
    if (params.livePrompt) {
      await writeLivePrompt(params.agent, params.livePrompt);
    } else if (params.clearLive) {
      await clearLivePrompt(params.agent);
    }
    await saveConfigFile(params.config);
  } catch (error) {
    if (snapshot) {
      await restoreLiveSnapshot(snapshot);
    }
    throw error;
  }
}

async function bootstrapProviders(
  config: SwitchConfigFile,
  agent: AgentId,
): Promise<boolean> {
  const manager = config[agent] ?? createEmptyAgentConfig();
  config[agent] = manager;

  if (Object.keys(manager.providers).length > 0) {
    return false;
  }

  const live = await readLiveProvider(agent);
  if (!live) {
    return false;
  }

  manager.providers.default = {
    id: "default",
    name: "default",
    category: DEFAULT_CATEGORY[agent],
    createdAt: Date.now(),
    sortIndex: 0,
    settingsConfig: live,
  };
  manager.current = "default";
  return true;
}

async function bootstrapPrompts(
  config: SwitchConfigFile,
  agent: AgentId,
): Promise<boolean> {
  const manager = config[agent] ?? createEmptyAgentConfig();
  config[agent] = manager;

  if (Object.keys(manager.prompts).length > 0) {
    return false;
  }

  const livePrompt = await readLivePrompt(agent);
  if (livePrompt === null) {
    return false;
  }

  manager.prompts.default = {
    id: "default",
    name: "default",
    content: livePrompt,
    createdAt: Date.now(),
    sortIndex: 0,
  };
  manager.currentPrompt = "default";
  return true;
}

async function bootstrapAgentState(
  config: SwitchConfigFile,
  agent: AgentId,
): Promise<boolean> {
  const [providersBootstrapped, promptsBootstrapped] = await Promise.all([
    bootstrapProviders(config, agent),
    bootstrapPrompts(config, agent),
  ]);

  return providersBootstrapped || promptsBootstrapped;
}

function serializeAgent(manager: AgentConfig, agent: AgentId): AgentPayload {
  return {
    agent,
    providers: sortProviders(manager.providers),
    currentProviderId: manager.current,
    prompts: sortPrompts(manager.prompts),
    currentPromptId: manager.currentPrompt,
  };
}

async function getAgentStateFromConfig(
  config: SwitchConfigFile,
  agent: AgentId,
): Promise<AgentPayload> {
  await bootstrapAgentState(config, agent);
  return serializeAgent(config[agent] ?? createEmptyAgentConfig(), agent);
}

export async function listAgent(agent: AgentId): Promise<AgentPayload> {
  const config = await readConfigFile();
  const existingManager = config[agent] ?? createEmptyAgentConfig();
  if (
    Object.keys(existingManager.providers).length > 0 &&
    Object.keys(existingManager.prompts).length > 0
  ) {
    return serializeAgent(existingManager, agent);
  }

  return withMutationLock(async () => {
    const lockedConfig = await readConfigFile();
    const bootstrapped = await bootstrapAgentState(lockedConfig, agent);
    const payload = serializeAgent(
      lockedConfig[agent] ?? createEmptyAgentConfig(),
      agent,
    );
    if (bootstrapped) {
      await saveConfigFile(lockedConfig);
    }
    return payload;
  });
}

export async function saveProvider(
  agent: AgentId,
  providerInput: ProviderRecord,
): Promise<AgentPayload> {
  return withMutationLock(async () => {
    const config = await readConfigFile();
    await bootstrapAgentState(config, agent);

    const manager = config[agent] ?? createEmptyAgentConfig();
    const isNew = !manager.providers[providerInput.id];
    const normalized = normalizeProvider(agent, providerInput);
    if (isNew && normalized.sortIndex === undefined) {
      normalized.sortIndex = sortProviders(manager.providers).length;
    }

    manager.providers[normalized.id] = normalized;
    config[agent] = manager;

    let liveProvider: ProviderRecord | undefined;
    if (!manager.current) {
      manager.current = normalized.id;
      liveProvider = normalized;
    } else if (manager.current === normalized.id) {
      liveProvider = normalized;
    }

    await commitConfigAndMaybeLive({
      agent,
      config,
      liveProvider,
      backup: {
        reason: liveProvider ? "save-current" : "save-library",
        toProviderId: normalized.id,
        providerName: normalized.name,
      },
    });

    return serializeAgent(manager, agent);
  });
}

export async function deleteProvider(
  agent: AgentId,
  providerId: string,
): Promise<AgentPayload> {
  return withMutationLock(async () => {
    const config = await readConfigFile();
    await bootstrapAgentState(config, agent);

    const manager = config[agent] ?? createEmptyAgentConfig();
    const existing = manager.providers[providerId];
    if (!existing) {
      throw new Error("Provider 不存在");
    }

    const wasCurrent = manager.current === providerId;
    delete manager.providers[providerId];

    let liveProvider: ProviderRecord | undefined;
    let clearLive = false;
    if (wasCurrent) {
      const nextProvider = sortProviders(manager.providers)[0];
      manager.current = nextProvider?.id ?? "";
      liveProvider = nextProvider;
      clearLive = !nextProvider;
    }

    await commitConfigAndMaybeLive({
      agent,
      config,
      liveProvider,
      clearLive,
      backup: {
        reason: wasCurrent ? "delete-current" : "delete-library",
        fromProviderId: providerId,
        toProviderId: liveProvider?.id,
        providerName: existing.name,
      },
    });

    return serializeAgent(manager, agent);
  });
}

export async function switchProvider(
  agent: AgentId,
  providerId: string,
): Promise<AgentPayload> {
  return withMutationLock(async () => {
    const config = await readConfigFile();
    await bootstrapAgentState(config, agent);

    const manager = config[agent] ?? createEmptyAgentConfig();
    const nextProvider = manager.providers[providerId];
    if (!nextProvider) {
      throw new Error("Provider 不存在");
    }

    const currentProviderId = manager.current;
    const previousLiveSnapshot =
      currentProviderId && currentProviderId !== providerId
        ? await readLiveProvider(agent)
        : null;

    if (previousLiveSnapshot && manager.providers[currentProviderId]) {
      manager.providers[currentProviderId] = {
        ...manager.providers[currentProviderId],
        settingsConfig: previousLiveSnapshot,
      };
    }

    manager.current = providerId;

    await commitConfigAndMaybeLive({
      agent,
      config,
      liveProvider: nextProvider,
      backup: {
        reason: "switch",
        fromProviderId: currentProviderId || undefined,
        toProviderId: providerId,
        providerName: nextProvider.name,
      },
    });

    return serializeAgent(manager, agent);
  });
}

export async function savePrompt(
  agent: AgentId,
  promptInput: PromptRecord,
): Promise<AgentPayload> {
  return withMutationLock(async () => {
    const config = await readConfigFile();
    await bootstrapAgentState(config, agent);

    const manager = config[agent] ?? createEmptyAgentConfig();
    const isNew = !manager.prompts[promptInput.id];
    const normalized = normalizePrompt(promptInput);
    if (isNew && normalized.sortIndex === undefined) {
      normalized.sortIndex = sortPrompts(manager.prompts).length;
    }

    manager.prompts[normalized.id] = normalized;
    config[agent] = manager;

    let livePrompt: PromptRecord | undefined;
    if (!manager.currentPrompt) {
      manager.currentPrompt = normalized.id;
      livePrompt = normalized;
    } else if (manager.currentPrompt === normalized.id) {
      livePrompt = normalized;
    }

    await commitConfigAndMaybePrompt({
      agent,
      config,
      livePrompt,
      backup: {
        reason: livePrompt ? "prompt-save-current" : "prompt-save-library",
        toPromptId: normalized.id,
        promptName: normalized.name,
      },
    });

    return serializeAgent(manager, agent);
  });
}

export async function deletePrompt(
  agent: AgentId,
  promptId: string,
): Promise<AgentPayload> {
  return withMutationLock(async () => {
    const config = await readConfigFile();
    await bootstrapAgentState(config, agent);

    const manager = config[agent] ?? createEmptyAgentConfig();
    const existing = manager.prompts[promptId];
    if (!existing) {
      throw new Error("提示词不存在");
    }

    const wasCurrent = manager.currentPrompt === promptId;
    delete manager.prompts[promptId];

    let livePrompt: PromptRecord | undefined;
    let clearLive = false;
    if (wasCurrent) {
      const nextPrompt = sortPrompts(manager.prompts)[0];
      manager.currentPrompt = nextPrompt?.id ?? "";
      livePrompt = nextPrompt;
      clearLive = !nextPrompt;
    }

    await commitConfigAndMaybePrompt({
      agent,
      config,
      livePrompt,
      clearLive,
      backup: {
        reason: wasCurrent ? "prompt-delete-current" : "prompt-delete-library",
        fromPromptId: promptId,
        toPromptId: livePrompt?.id,
        promptName: existing.name,
      },
    });

    return serializeAgent(manager, agent);
  });
}

export async function switchPrompt(
  agent: AgentId,
  promptId: string,
): Promise<AgentPayload> {
  return withMutationLock(async () => {
    const config = await readConfigFile();
    await bootstrapAgentState(config, agent);

    const manager = config[agent] ?? createEmptyAgentConfig();
    const nextPrompt = manager.prompts[promptId];
    if (!nextPrompt) {
      throw new Error("提示词不存在");
    }

    const currentPromptId = manager.currentPrompt;
    const previousLivePrompt =
      currentPromptId && currentPromptId !== promptId ? await readLivePrompt(agent) : null;

    if (previousLivePrompt !== null && manager.prompts[currentPromptId]) {
      manager.prompts[currentPromptId] = {
        ...manager.prompts[currentPromptId],
        content: previousLivePrompt,
      };
    }

    manager.currentPrompt = promptId;

    await commitConfigAndMaybePrompt({
      agent,
      config,
      livePrompt: nextPrompt,
      backup: {
        reason: "prompt-switch",
        fromPromptId: currentPromptId || undefined,
        toPromptId: promptId,
        promptName: nextPrompt.name,
      },
    });

    return serializeAgent(manager, agent);
  });
}
