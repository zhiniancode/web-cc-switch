import type {
  AgentId,
  ClaudeApiFormat,
  ClaudeApiKeyField,
  ProviderCategory,
  ProviderMeta,
  ProviderRecord,
} from "@shared/types";

export interface ProviderEditorDraft {
  id: string;
  name: string;
  websiteUrl: string;
  category: ProviderCategory;
  notes: string;
  meta: ProviderMeta;
  claudeJson: string;
  claudeApiFormat: ClaudeApiFormat;
  claudeAuthField: ClaudeApiKeyField;
  claudeApiKey: string;
  claudeBaseUrl: string;
  claudeModel: string;
  claudeHideAttribution: boolean;
  claudeTeammates: boolean;
  claudeEnableToolSearch: boolean;
  claudeHighEffort: boolean;
  claudeDisableAutoUpgrade: boolean;
  claudeReasoningModel: string;
  claudeHaikuModel: string;
  claudeSonnetModel: string;
  claudeOpusModel: string;
  codexApiKey: string;
  codexBaseUrl: string;
  codexModel: string;
  codexAuthJson: string;
  codexToml: string;
  geminiApiKey: string;
  geminiBaseUrl: string;
  geminiModel: string;
  geminiEnv: string;
  geminiSettingsJson: string;
}

export const categoryOptions: Array<{
  value: ProviderCategory;
  label: string;
}> = [
  { value: "official", label: "Official" },
  { value: "cn_official", label: "CN Official" },
  { value: "aggregator", label: "Aggregator" },
  { value: "third_party", label: "Third Party" },
  { value: "custom", label: "Custom" },
];

export const agentMeta: Record<
  AgentId,
  {
    label: string;
    shortLabel: string;
    subtitle: string;
    accentClass: string;
  }
> = {
  claude: {
    label: "Claude Code",
    shortLabel: "Claude",
    subtitle: "Anthropic and compatible routers",
    accentClass: "agent-claude",
  },
  codex: {
    label: "Codex",
    shortLabel: "Codex",
    subtitle: "OpenAI and compatible gateways",
    accentClass: "agent-codex",
  },
  gemini: {
    label: "Gemini",
    shortLabel: "Gemini",
    subtitle: "Google Gemini CLI providers",
    accentClass: "agent-gemini",
  },
};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isClaudeApiFormat(value: unknown): value is ClaudeApiFormat {
  return (
    value === "anthropic" ||
    value === "openai_chat" ||
    value === "openai_responses" ||
    value === "gemini_native"
  );
}

function isClaudeApiKeyField(value: unknown): value is ClaudeApiKeyField {
  return value === "ANTHROPIC_AUTH_TOKEN" || value === "ANTHROPIC_API_KEY";
}

function cloneProviderMeta(meta: ProviderMeta | undefined): ProviderMeta {
  return meta ? { ...meta } : {};
}

function normalizeProviderMeta(meta: ProviderMeta): ProviderMeta | undefined {
  const normalized = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  ) as ProviderMeta;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function parseObjectJson(text: string, label: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} 不是合法 JSON`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 对象`);
  }

  return parsed as Record<string, unknown>;
}

export function parseEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      throw new Error(`Gemini .env 存在非法行: ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      throw new Error(`Gemini .env 存在空键名: ${line}`);
    }

    result[key] = value;
  }

  return result;
}

function stringifyEnvMap(envMap: Record<string, unknown>): string {
  return Object.entries(envMap)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseObjectJsonLoose(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTomlLines(text: string): string[] {
  const normalized = normalizeNewlines(text).trimEnd();
  return normalized ? normalized.split("\n") : [];
}

function finalizeToml(lines: string[]): string {
  return ensureTrailingNewline(lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd());
}

function readJsonStringValue(text: string, key: string): string | null {
  try {
    const parsed = parseObjectJson(text, "Codex auth.json");
    const value = parsed[key];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function readObjectStringValue(object: Record<string, unknown>, key: string): string | null {
  const value = object[key];
  return typeof value === "string" ? value : null;
}

function readObjectBooleanishValue(object: Record<string, unknown>, key: string): boolean {
  const value = object[key];
  return value === true || value === 1 || value === "1" || value === "true";
}

function readClaudeApiFormat(provider?: ProviderRecord): ClaudeApiFormat {
  const metaFormat = provider?.meta?.apiFormat;
  if (isClaudeApiFormat(metaFormat)) {
    return metaFormat;
  }

  const settingsFormat = provider?.settingsConfig?.api_format;
  if (isClaudeApiFormat(settingsFormat)) {
    return settingsFormat;
  }

  const legacyCompat = provider?.settingsConfig?.openrouter_compat_mode;
  if (
    legacyCompat === true ||
    legacyCompat === 1 ||
    legacyCompat === "1" ||
    legacyCompat === "true"
  ) {
    return "openai_chat";
  }

  return "anthropic";
}

function readClaudeDraftFields(
  claudeJson: string,
  meta?: ProviderMeta,
): Pick<
  ProviderEditorDraft,
  | "claudeAuthField"
  | "claudeApiKey"
  | "claudeBaseUrl"
  | "claudeModel"
  | "claudeHideAttribution"
  | "claudeTeammates"
  | "claudeEnableToolSearch"
  | "claudeHighEffort"
  | "claudeDisableAutoUpgrade"
  | "claudeReasoningModel"
  | "claudeHaikuModel"
  | "claudeSonnetModel"
  | "claudeOpusModel"
> {
  const parsed = parseObjectJsonLoose(claudeJson);
  const env = parsed && isRecord(parsed.env) ? parsed.env : {};
  const attribution = parsed && isRecord(parsed.attribution) ? parsed.attribution : {};
  const smallFastModel = readObjectStringValue(env, "ANTHROPIC_SMALL_FAST_MODEL") || "";
  const hasApiKeyField = Object.prototype.hasOwnProperty.call(env, "ANTHROPIC_API_KEY");
  const hasAuthTokenField = Object.prototype.hasOwnProperty.call(env, "ANTHROPIC_AUTH_TOKEN");
  const selectedAuthField = hasApiKeyField
    ? "ANTHROPIC_API_KEY"
    : hasAuthTokenField
      ? "ANTHROPIC_AUTH_TOKEN"
      : isClaudeApiKeyField(meta?.apiKeyField)
        ? meta.apiKeyField
        : "ANTHROPIC_AUTH_TOKEN";

  return {
    claudeAuthField: selectedAuthField,
    claudeApiKey:
      readObjectStringValue(env, "ANTHROPIC_AUTH_TOKEN") ||
      readObjectStringValue(env, "ANTHROPIC_API_KEY") ||
      "",
    claudeBaseUrl: readObjectStringValue(env, "ANTHROPIC_BASE_URL") || "",
    claudeModel: readObjectStringValue(env, "ANTHROPIC_MODEL") || "",
    claudeHideAttribution:
      readObjectStringValue(attribution, "commit") === "" &&
      readObjectStringValue(attribution, "pr") === "",
    claudeTeammates: readObjectBooleanishValue(env, "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"),
    claudeEnableToolSearch: readObjectBooleanishValue(env, "ENABLE_TOOL_SEARCH"),
    claudeHighEffort:
      parsed !== null &&
      readObjectStringValue(parsed, "effortLevel") === "high",
    claudeDisableAutoUpgrade: readObjectBooleanishValue(env, "DISABLE_AUTOUPDATER"),
    claudeReasoningModel: readObjectStringValue(env, "ANTHROPIC_REASONING_MODEL") || "",
    claudeHaikuModel:
      readObjectStringValue(env, "ANTHROPIC_DEFAULT_HAIKU_MODEL") || smallFastModel,
    claudeSonnetModel: readObjectStringValue(env, "ANTHROPIC_DEFAULT_SONNET_MODEL") || "",
    claudeOpusModel: readObjectStringValue(env, "ANTHROPIC_DEFAULT_OPUS_MODEL") || "",
  };
}

function buildClaudeJson(
  claudeJson: string,
  params: {
    authField: ClaudeApiKeyField;
    apiKey: string;
    baseUrl: string;
    model: string;
    hideAttribution: boolean;
    teammates: boolean;
    enableToolSearch: boolean;
    highEffort: boolean;
    disableAutoUpgrade: boolean;
    reasoningModel: string;
    haikuModel: string;
    sonnetModel: string;
    opusModel: string;
  },
): string {
  const parsed = parseObjectJsonLoose(claudeJson) ?? {};
  const next = { ...parsed };
  const env = isRecord(next.env) ? { ...next.env } : {};

  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_API_KEY;
  if (params.apiKey.trim()) {
    env[params.authField] = params.apiKey;
  }

  if (params.baseUrl.trim()) {
    env.ANTHROPIC_BASE_URL = params.baseUrl;
  } else {
    delete env.ANTHROPIC_BASE_URL;
  }

  if (params.model.trim()) {
    env.ANTHROPIC_MODEL = params.model;
  } else {
    delete env.ANTHROPIC_MODEL;
  }
  delete env.ANTHROPIC_SMALL_FAST_MODEL;

  if (params.teammates) {
    env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";
  } else {
    delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  }

  if (params.enableToolSearch) {
    env.ENABLE_TOOL_SEARCH = "true";
  } else {
    delete env.ENABLE_TOOL_SEARCH;
  }

  if (params.disableAutoUpgrade) {
    env.DISABLE_AUTOUPDATER = "1";
  } else {
    delete env.DISABLE_AUTOUPDATER;
  }

  if (params.reasoningModel.trim()) {
    env.ANTHROPIC_REASONING_MODEL = params.reasoningModel;
  } else {
    delete env.ANTHROPIC_REASONING_MODEL;
  }

  if (params.haikuModel.trim()) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = params.haikuModel;
  } else {
    delete env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
  }

  if (params.sonnetModel.trim()) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = params.sonnetModel;
  } else {
    delete env.ANTHROPIC_DEFAULT_SONNET_MODEL;
  }

  if (params.opusModel.trim()) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = params.opusModel;
  } else {
    delete env.ANTHROPIC_DEFAULT_OPUS_MODEL;
  }

  if (params.hideAttribution) {
    next.attribution = {
      commit: "",
      pr: "",
    };
  } else {
    delete next.attribution;
  }

  if (params.highEffort) {
    next.effortLevel = "high";
  } else {
    delete next.effortLevel;
  }

  if (Object.keys(env).length > 0) {
    next.env = env;
  } else {
    delete next.env;
  }

  return `${JSON.stringify(next, null, 2)}\n`;
}

function parseEnvTextLoose(text: string): Record<string, string> | null {
  try {
    return parseEnvText(text);
  } catch {
    return null;
  }
}

function readGeminiPrimaryFields(
  geminiEnv: string,
): Pick<ProviderEditorDraft, "geminiApiKey" | "geminiBaseUrl" | "geminiModel"> {
  const env = parseEnvTextLoose(geminiEnv) ?? {};

  return {
    geminiApiKey: env.GEMINI_API_KEY || "",
    geminiBaseUrl: env.GOOGLE_GEMINI_BASE_URL || "",
    geminiModel: env.GEMINI_MODEL || "",
  };
}

function buildGeminiEnv(
  geminiEnv: string,
  params: {
    apiKey: string;
    baseUrl: string;
    model: string;
  },
): string {
  const env = parseEnvTextLoose(geminiEnv) ?? {};
  const next = { ...env };

  if (params.apiKey.trim()) {
    next.GEMINI_API_KEY = params.apiKey;
  } else {
    delete next.GEMINI_API_KEY;
  }

  if (params.baseUrl.trim()) {
    next.GOOGLE_GEMINI_BASE_URL = params.baseUrl;
  } else {
    delete next.GOOGLE_GEMINI_BASE_URL;
  }

  if (params.model.trim()) {
    next.GEMINI_MODEL = params.model;
  } else {
    delete next.GEMINI_MODEL;
  }

  const result = stringifyEnvMap(next);
  return result ? `${result}\n` : "";
}

function buildCodexAuthJson(apiKey: string, authJson: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseObjectJson(authJson, "Codex auth.json");
  } catch {
    parsed = {};
  }

  return `${JSON.stringify(
    {
      ...parsed,
      OPENAI_API_KEY: apiKey,
    },
    null,
    2,
  )}\n`;
}

function getCodexProviderSectionName(configText: string): string {
  const explicit = findTomlValue(configText, "model_provider");
  if (explicit) {
    return explicit;
  }

  const match = normalizeNewlines(configText).match(/^\s*\[model_providers\.([^\]]+)\]\s*$/m);
  return match?.[1] ?? "default";
}

function resolveCodexProviderKey(
  category: ProviderCategory,
  configText: string,
): string {
  if (category === "custom") {
    return "custom";
  }

  const currentKey = getCodexProviderSectionName(configText);
  if (currentKey === "custom") {
    return "default";
  }

  return currentKey || "default";
}

function readTomlSectionStringValue(
  configText: string,
  sectionName: string,
  key: string,
): string | null {
  const lines = getTomlLines(configText);
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*"([^"]*)"`);
  let currentSection: string | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1] ?? null;
      continue;
    }

    if (currentSection !== sectionName) {
      continue;
    }

    const valueMatch = line.match(keyPattern);
    if (valueMatch) {
      return valueMatch[1] ?? "";
    }
  }

  return null;
}

function upsertTopLevelTomlStringValue(
  configText: string,
  key: string,
  value: string,
): string {
  const lines = getTomlLines(configText);
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const firstSectionIndex = lines.findIndex((line) => /^\s*\[/.test(line));
  const searchEnd = firstSectionIndex === -1 ? lines.length : firstSectionIndex;

  for (let index = 0; index < searchEnd; index += 1) {
    if (keyPattern.test(lines[index] ?? "")) {
      lines[index] = `${key} = ${JSON.stringify(value)}`;
      return finalizeToml(lines);
    }
  }

  lines.splice(searchEnd, 0, `${key} = ${JSON.stringify(value)}`);
  return finalizeToml(lines);
}

function upsertSectionTomlStringValue(
  configText: string,
  sectionName: string,
  key: string,
  value: string,
  fallbackLines: string[] = [],
): string {
  const lines = getTomlLines(configText);
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  let currentSection: string | null = null;
  let sectionStart = -1;
  let sectionEnd = lines.length;
  let keyIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);

    if (sectionMatch) {
      if (currentSection === sectionName && sectionEnd === lines.length) {
        sectionEnd = index;
        break;
      }

      currentSection = sectionMatch[1] ?? null;
      if (currentSection === sectionName) {
        sectionStart = index;
      }
      continue;
    }

    if (currentSection === sectionName && keyPattern.test(line)) {
      keyIndex = index;
    }
  }

  if (sectionStart === -1) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(`[${sectionName}]`, `${key} = ${JSON.stringify(value)}`, ...fallbackLines);
    return finalizeToml(lines);
  }

  if (keyIndex !== -1) {
    lines[keyIndex] = `${key} = ${JSON.stringify(value)}`;
    return finalizeToml(lines);
  }

  lines.splice(sectionEnd, 0, `${key} = ${JSON.stringify(value)}`);
  return finalizeToml(lines);
}

function readCodexTomlModel(configText: string): string | null {
  return findTomlValue(configText, "model");
}

function readCodexTomlBaseUrl(configText: string): string | null {
  const sectionName = getCodexProviderSectionName(configText);
  return readTomlSectionStringValue(
    configText,
    `model_providers.${sectionName}`,
    "base_url",
  );
}

function buildCodexToml(
  configText: string,
  params: {
    category: ProviderCategory;
    baseUrl: string;
    model: string;
  },
): string {
  const sectionKey = resolveCodexProviderKey(params.category, configText);
  const sectionName = `model_providers.${sectionKey}`;
  let next = upsertTopLevelTomlStringValue(configText, "model_provider", sectionKey);
  next = upsertTopLevelTomlStringValue(next, "model", params.model);
  next = upsertSectionTomlStringValue(
    next,
    sectionName,
    "name",
    sectionKey,
    [
      `base_url = ${JSON.stringify(params.baseUrl)}`,
      'wire_api = "responses"',
      "requires_openai_auth = true",
    ],
  );
  next = upsertSectionTomlStringValue(next, sectionName, "base_url", params.baseUrl);
  return next;
}

function readCodexPrimaryFields(
  authJson: string,
  configText: string,
): Pick<ProviderEditorDraft, "codexApiKey" | "codexBaseUrl" | "codexModel"> {
  return {
    codexApiKey: readJsonStringValue(authJson, "OPENAI_API_KEY") ?? "",
    codexBaseUrl: readCodexTomlBaseUrl(configText) ?? "",
    codexModel: readCodexTomlModel(configText) ?? "",
  };
}

function defaultCodexToml(): string {
  return `model_provider = "custom"
model = "gpt-5.4"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.custom]
name = "custom"
base_url = "https://api.openai.com/v1"
wire_api = "responses"
requires_openai_auth = true`;
}

export function createProviderDraft(
  agent: AgentId,
  provider?: ProviderRecord,
): ProviderEditorDraft {
  if (!provider) {
    const meta = cloneProviderMeta(undefined);
    const claudeJson = formatJson({
      env: {
        ANTHROPIC_BASE_URL: "",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "",
      },
    });
    const codexAuthJson = formatJson({
      OPENAI_API_KEY: "",
    });
    const codexToml = defaultCodexToml();
    const geminiEnv = [
      "GEMINI_API_KEY=",
      "GOOGLE_GEMINI_BASE_URL=https://generativelanguage.googleapis.com",
      "GEMINI_MODEL=gemini-2.5-pro",
    ].join("\n");
    const claudeFields = readClaudeDraftFields(claudeJson, meta);
    const codexPrimaryFields = readCodexPrimaryFields(codexAuthJson, codexToml);
    const geminiPrimaryFields = readGeminiPrimaryFields(geminiEnv);

    return {
      id: crypto.randomUUID(),
      name: "",
      websiteUrl: "",
      category: "custom",
      notes: "",
      meta,
      claudeJson,
      claudeApiFormat: "anthropic",
      claudeAuthField: claudeFields.claudeAuthField,
      claudeApiKey: claudeFields.claudeApiKey,
      claudeBaseUrl: claudeFields.claudeBaseUrl,
      claudeModel: claudeFields.claudeModel,
      claudeHideAttribution: claudeFields.claudeHideAttribution,
      claudeTeammates: claudeFields.claudeTeammates,
      claudeEnableToolSearch: claudeFields.claudeEnableToolSearch,
      claudeHighEffort: claudeFields.claudeHighEffort,
      claudeDisableAutoUpgrade: claudeFields.claudeDisableAutoUpgrade,
      claudeReasoningModel: claudeFields.claudeReasoningModel,
      claudeHaikuModel: claudeFields.claudeHaikuModel,
      claudeSonnetModel: claudeFields.claudeSonnetModel,
      claudeOpusModel: claudeFields.claudeOpusModel,
      codexApiKey: codexPrimaryFields.codexApiKey,
      codexBaseUrl: codexPrimaryFields.codexBaseUrl,
      codexModel: codexPrimaryFields.codexModel,
      codexAuthJson,
      codexToml,
      geminiApiKey: geminiPrimaryFields.geminiApiKey,
      geminiBaseUrl: geminiPrimaryFields.geminiBaseUrl,
      geminiModel: geminiPrimaryFields.geminiModel,
      geminiEnv,
      geminiSettingsJson: formatJson({}),
    };
  }

  const settings = provider.settingsConfig ?? {};
  const meta = cloneProviderMeta(provider.meta);
  const claudeJson =
    agent === "claude"
      ? formatJson(settings)
      : formatJson({
          env: {
            ANTHROPIC_BASE_URL: "",
            ANTHROPIC_AUTH_TOKEN: "",
            ANTHROPIC_MODEL: "",
          },
        });
  const codexAuthJson =
    agent === "codex"
      ? formatJson((settings as Record<string, unknown>).auth ?? {})
      : formatJson({ OPENAI_API_KEY: "" });
  const codexToml =
    agent === "codex" && typeof (settings as Record<string, unknown>).config === "string"
      ? ((settings as Record<string, unknown>).config as string)
      : defaultCodexToml();
  const codexPrimaryFields = readCodexPrimaryFields(codexAuthJson, codexToml);
  const geminiEnv =
    agent === "gemini"
      ? stringifyEnvMap(
          ((settings as Record<string, unknown>).env as Record<string, unknown>) ?? {},
        )
      : "";
  const claudeFields = readClaudeDraftFields(claudeJson, meta);
  const geminiPrimaryFields = readGeminiPrimaryFields(geminiEnv);

  return {
    id: provider.id,
    name: provider.name,
    websiteUrl: provider.websiteUrl ?? "",
    category: provider.category ?? "custom",
    notes: provider.notes ?? "",
    meta,
    claudeJson,
    claudeApiFormat: agent === "claude" ? readClaudeApiFormat(provider) : "anthropic",
    claudeAuthField: claudeFields.claudeAuthField,
    claudeApiKey: claudeFields.claudeApiKey,
    claudeBaseUrl: claudeFields.claudeBaseUrl,
    claudeModel: claudeFields.claudeModel,
    claudeHideAttribution: claudeFields.claudeHideAttribution,
    claudeTeammates: claudeFields.claudeTeammates,
    claudeEnableToolSearch: claudeFields.claudeEnableToolSearch,
    claudeHighEffort: claudeFields.claudeHighEffort,
    claudeDisableAutoUpgrade: claudeFields.claudeDisableAutoUpgrade,
    claudeReasoningModel: claudeFields.claudeReasoningModel,
    claudeHaikuModel: claudeFields.claudeHaikuModel,
    claudeSonnetModel: claudeFields.claudeSonnetModel,
    claudeOpusModel: claudeFields.claudeOpusModel,
    codexApiKey: codexPrimaryFields.codexApiKey,
    codexBaseUrl: codexPrimaryFields.codexBaseUrl,
    codexModel: codexPrimaryFields.codexModel,
    codexAuthJson,
    codexToml,
    geminiApiKey: geminiPrimaryFields.geminiApiKey,
    geminiBaseUrl: geminiPrimaryFields.geminiBaseUrl,
    geminiModel: geminiPrimaryFields.geminiModel,
    geminiEnv,
    geminiSettingsJson:
      agent === "gemini"
        ? formatJson((settings as Record<string, unknown>).config ?? {})
        : formatJson({}),
  };
}

export function draftToProvider(
  agent: AgentId,
  draft: ProviderEditorDraft,
): ProviderRecord {
  const nextMeta = cloneProviderMeta(draft.meta);
  const baseProvider: ProviderRecord = {
    id: draft.id,
    name: draft.name.trim(),
    websiteUrl: draft.websiteUrl.trim() || undefined,
    category: draft.category,
    notes: draft.notes.trim() || undefined,
    meta: normalizeProviderMeta(nextMeta),
    settingsConfig: {},
  };

  if (!baseProvider.name) {
    throw new Error("Provider 名称不能为空");
  }

  switch (agent) {
    case "claude": {
      if (draft.claudeApiFormat === "anthropic") {
        delete nextMeta.apiFormat;
      } else {
        nextMeta.apiFormat = draft.claudeApiFormat;
      }

      if (draft.claudeAuthField === "ANTHROPIC_AUTH_TOKEN") {
        delete nextMeta.apiKeyField;
      } else {
        nextMeta.apiKeyField = draft.claudeAuthField;
      }

      baseProvider.meta = normalizeProviderMeta(nextMeta);
      const claudeJson = buildClaudeJson(draft.claudeJson, {
        authField: draft.claudeAuthField,
        apiKey: draft.claudeApiKey,
        baseUrl: draft.claudeBaseUrl,
        model: draft.claudeModel,
        hideAttribution: draft.claudeHideAttribution,
        teammates: draft.claudeTeammates,
        enableToolSearch: draft.claudeEnableToolSearch,
        highEffort: draft.claudeHighEffort,
        disableAutoUpgrade: draft.claudeDisableAutoUpgrade,
        reasoningModel: draft.claudeReasoningModel,
        haikuModel: draft.claudeHaikuModel,
        sonnetModel: draft.claudeSonnetModel,
        opusModel: draft.claudeOpusModel,
      });
      baseProvider.settingsConfig = parseObjectJson(
        claudeJson,
        "Claude settings.json",
      );
      break;
    }
    case "codex": {
      const codexAuthJson = buildCodexAuthJson(draft.codexApiKey, draft.codexAuthJson);
      const codexToml = buildCodexToml(draft.codexToml, {
        category: draft.category,
        baseUrl: draft.codexBaseUrl,
        model: draft.codexModel,
      });
      baseProvider.settingsConfig = {
        auth: parseObjectJson(codexAuthJson, "Codex auth.json"),
        config: codexToml,
      };
      break;
    }
    case "gemini":
      {
        const geminiEnv = buildGeminiEnv(draft.geminiEnv, {
          apiKey: draft.geminiApiKey,
          baseUrl: draft.geminiBaseUrl,
          model: draft.geminiModel,
        });
        baseProvider.settingsConfig = {
          env: parseEnvText(geminiEnv),
          config: parseObjectJson(draft.geminiSettingsJson, "Gemini settings.json"),
        };
        break;
      }
  }

  return baseProvider;
}

function readNestedString(
  provider: ProviderRecord,
  section: string,
  key: string,
): string | null {
  const settings = provider.settingsConfig as Record<string, unknown>;
  const target = settings[section];
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return null;
  }

  const value = (target as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function findTomlValue(configText: string, key: string): string | null {
  const match = configText.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`));
  return match?.[1] ?? null;
}

export function syncCodexDraftFromPrimaryFields(
  draft: ProviderEditorDraft,
  updates: Partial<
    Pick<
      ProviderEditorDraft,
      "name" | "category" | "codexApiKey" | "codexBaseUrl" | "codexModel"
    >
  >,
): ProviderEditorDraft {
  const next = {
    ...draft,
    ...updates,
  };

  return {
    ...next,
    codexAuthJson: buildCodexAuthJson(next.codexApiKey, draft.codexAuthJson),
    codexToml: buildCodexToml(draft.codexToml, {
      category: next.category,
      baseUrl: next.codexBaseUrl,
      model: next.codexModel,
    }),
  };
}

export function syncCodexDraftFromAuthJson(
  draft: ProviderEditorDraft,
  authJson: string,
): ProviderEditorDraft {
  const apiKey = readJsonStringValue(authJson, "OPENAI_API_KEY");
  return {
    ...draft,
    codexAuthJson: authJson,
    codexApiKey: apiKey ?? draft.codexApiKey,
  };
}

export function syncCodexDraftFromToml(
  draft: ProviderEditorDraft,
  configText: string,
): ProviderEditorDraft {
  const baseUrl = readCodexTomlBaseUrl(configText);
  const model = readCodexTomlModel(configText);
  const providerKey = getCodexProviderSectionName(configText);
  return {
    ...draft,
    codexToml: configText,
    codexBaseUrl: baseUrl ?? draft.codexBaseUrl,
    codexModel: model ?? draft.codexModel,
    category: providerKey === "custom" ? "custom" : draft.category,
  };
}

export function syncClaudeDraftFromPrimaryFields(
  draft: ProviderEditorDraft,
  updates: Partial<
    Pick<
      ProviderEditorDraft,
      | "name"
      | "category"
      | "claudeApiFormat"
      | "claudeAuthField"
      | "claudeApiKey"
      | "claudeBaseUrl"
      | "claudeModel"
      | "claudeHideAttribution"
      | "claudeTeammates"
      | "claudeEnableToolSearch"
      | "claudeHighEffort"
      | "claudeDisableAutoUpgrade"
      | "claudeReasoningModel"
      | "claudeHaikuModel"
      | "claudeSonnetModel"
      | "claudeOpusModel"
    >
  >,
): ProviderEditorDraft {
  const next: ProviderEditorDraft = {
    ...draft,
    ...updates,
  };
  const nextMeta = cloneProviderMeta(next.meta);

  if (updates.claudeApiFormat !== undefined) {
    if (next.claudeApiFormat === "anthropic") {
      delete nextMeta.apiFormat;
    } else {
      nextMeta.apiFormat = next.claudeApiFormat;
    }
  }

  if (updates.claudeAuthField !== undefined) {
    if (next.claudeAuthField === "ANTHROPIC_AUTH_TOKEN") {
      delete nextMeta.apiKeyField;
    } else {
      nextMeta.apiKeyField = next.claudeAuthField;
    }
  }

  next.meta = normalizeProviderMeta(nextMeta) ?? {};

  if (
    updates.claudeApiFormat === undefined &&
    updates.claudeAuthField === undefined &&
    updates.claudeApiKey === undefined &&
    updates.claudeBaseUrl === undefined &&
    updates.claudeModel === undefined &&
    updates.claudeHideAttribution === undefined &&
    updates.claudeTeammates === undefined &&
    updates.claudeEnableToolSearch === undefined &&
    updates.claudeHighEffort === undefined &&
    updates.claudeDisableAutoUpgrade === undefined &&
    updates.claudeReasoningModel === undefined &&
    updates.claudeHaikuModel === undefined &&
    updates.claudeSonnetModel === undefined &&
    updates.claudeOpusModel === undefined
  ) {
    return next;
  }

  return {
    ...next,
    claudeJson: buildClaudeJson(draft.claudeJson, {
      authField: next.claudeAuthField,
      apiKey: next.claudeApiKey,
      baseUrl: next.claudeBaseUrl,
      model: next.claudeModel,
      hideAttribution: next.claudeHideAttribution,
      teammates: next.claudeTeammates,
      enableToolSearch: next.claudeEnableToolSearch,
      highEffort: next.claudeHighEffort,
      disableAutoUpgrade: next.claudeDisableAutoUpgrade,
      reasoningModel: next.claudeReasoningModel,
      haikuModel: next.claudeHaikuModel,
      sonnetModel: next.claudeSonnetModel,
      opusModel: next.claudeOpusModel,
    }),
  };
}

export function syncClaudeDraftFromJson(
  draft: ProviderEditorDraft,
  claudeJson: string,
): ProviderEditorDraft {
  const parsed = parseObjectJsonLoose(claudeJson);
  if (parsed === null) {
    return {
      ...draft,
      claudeJson,
    };
  }

  const primaryFields = readClaudeDraftFields(claudeJson, draft.meta);
  return {
    ...draft,
    claudeJson,
    claudeAuthField: primaryFields.claudeAuthField,
    claudeApiKey: primaryFields.claudeApiKey,
    claudeBaseUrl: primaryFields.claudeBaseUrl,
    claudeModel: primaryFields.claudeModel,
    claudeHideAttribution: primaryFields.claudeHideAttribution,
    claudeTeammates: primaryFields.claudeTeammates,
    claudeEnableToolSearch: primaryFields.claudeEnableToolSearch,
    claudeHighEffort: primaryFields.claudeHighEffort,
    claudeDisableAutoUpgrade: primaryFields.claudeDisableAutoUpgrade,
    claudeReasoningModel: primaryFields.claudeReasoningModel,
    claudeHaikuModel: primaryFields.claudeHaikuModel,
    claudeSonnetModel: primaryFields.claudeSonnetModel,
    claudeOpusModel: primaryFields.claudeOpusModel,
  };
}

export function syncGeminiDraftFromPrimaryFields(
  draft: ProviderEditorDraft,
  updates: Partial<
    Pick<
      ProviderEditorDraft,
      "name" | "category" | "geminiApiKey" | "geminiBaseUrl" | "geminiModel"
    >
  >,
): ProviderEditorDraft {
  const next = {
    ...draft,
    ...updates,
  };

  if (
    updates.geminiApiKey === undefined &&
    updates.geminiBaseUrl === undefined &&
    updates.geminiModel === undefined
  ) {
    return next;
  }

  return {
    ...next,
    geminiEnv: buildGeminiEnv(draft.geminiEnv, {
      apiKey: next.geminiApiKey,
      baseUrl: next.geminiBaseUrl,
      model: next.geminiModel,
    }),
  };
}

export function syncGeminiDraftFromEnv(
  draft: ProviderEditorDraft,
  geminiEnv: string,
): ProviderEditorDraft {
  const parsed = parseEnvTextLoose(geminiEnv);
  if (parsed === null) {
    return {
      ...draft,
      geminiEnv,
    };
  }

  const primaryFields = readGeminiPrimaryFields(geminiEnv);
  return {
    ...draft,
    geminiEnv,
    geminiApiKey: primaryFields.geminiApiKey,
    geminiBaseUrl: primaryFields.geminiBaseUrl,
    geminiModel: primaryFields.geminiModel,
  };
}

export function getProviderSummary(
  agent: AgentId,
  provider: ProviderRecord,
): Array<{ label: string; value: string }> {
  const summary = [{ label: "Base URL", value: getProviderBaseUrl(agent, provider) }];
  const model = getProviderModel(agent, provider);
  if (model) {
    summary.push({ label: "Model", value: model });
  }
  return summary;
}

export function getProviderBaseUrl(
  agent: AgentId,
  provider: ProviderRecord,
): string {
  switch (agent) {
    case "claude":
      return readNestedString(provider, "env", "ANTHROPIC_BASE_URL") || "Official";
    case "codex": {
      const config =
        ((provider.settingsConfig as Record<string, unknown>).config as string) || "";
      return readCodexTomlBaseUrl(config) || "Official";
    }
    case "gemini":
      return readNestedString(provider, "env", "GOOGLE_GEMINI_BASE_URL") || "Official";
  }
}

export function getProviderModel(
  agent: AgentId,
  provider: ProviderRecord,
): string | null {
  switch (agent) {
    case "claude":
      return readNestedString(provider, "env", "ANTHROPIC_MODEL");
    case "codex": {
      const config =
        ((provider.settingsConfig as Record<string, unknown>).config as string) || "";
      return readCodexTomlModel(config) || null;
    }
    case "gemini":
      return readNestedString(provider, "env", "GEMINI_MODEL");
  }
}

export function getProviderApiKey(
  agent: AgentId,
  provider: ProviderRecord,
): string | null {
  switch (agent) {
    case "claude":
      return (
        readNestedString(provider, "env", "ANTHROPIC_AUTH_TOKEN") ||
        readNestedString(provider, "env", "ANTHROPIC_API_KEY")
      );
    case "codex": {
      const settings = provider.settingsConfig as Record<string, unknown>;
      const auth = settings.auth;
      if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
        return null;
      }
      const apiKey = (auth as Record<string, unknown>).OPENAI_API_KEY;
      return typeof apiKey === "string" && apiKey.trim() ? apiKey : null;
    }
    case "gemini":
      return readNestedString(provider, "env", "GEMINI_API_KEY");
  }
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "•".repeat(Math.max(secret.length, 6));
  }

  return `${secret.slice(0, 4)}${"•".repeat(Math.max(secret.length - 8, 6))}${secret.slice(-4)}`;
}
