export type AgentId = "claude" | "codex" | "gemini";

export type ProviderCategory =
  | "official"
  | "cn_official"
  | "aggregator"
  | "third_party"
  | "custom";

export type ClaudeApiFormat =
  | "anthropic"
  | "openai_chat"
  | "openai_responses"
  | "gemini_native";

export type ClaudeApiKeyField = "ANTHROPIC_AUTH_TOKEN" | "ANTHROPIC_API_KEY";

export interface ProviderMeta {
  isPartner?: boolean;
  partnerPromotionKey?: string;
  apiFormat?: ClaudeApiFormat;
  apiKeyField?: ClaudeApiKeyField;
}

export interface ProviderRecord {
  id: string;
  name: string;
  settingsConfig: Record<string, unknown>;
  websiteUrl?: string;
  category?: ProviderCategory;
  createdAt?: number;
  sortIndex?: number;
  notes?: string;
  meta?: ProviderMeta;
}

export interface PromptRecord {
  id: string;
  name: string;
  content: string;
  createdAt?: number;
  sortIndex?: number;
}

export interface AgentConfig {
  providers: Record<string, ProviderRecord>;
  current: string;
  prompts: Record<string, PromptRecord>;
  currentPrompt: string;
}

export interface SwitchConfigFile {
  claude?: AgentConfig;
  codex?: AgentConfig;
  gemini?: AgentConfig;
}

export interface AgentPayload {
  agent: AgentId;
  providers: ProviderRecord[];
  currentProviderId: string;
  prompts: PromptRecord[];
  currentPromptId: string;
}

export interface LoginPayload {
  authenticated: boolean;
}

export interface SaveProviderPayload {
  provider: ProviderRecord;
}

export interface DeleteProviderPayload {
  id: string;
}

export interface SwitchProviderPayload {
  id: string;
}

export interface SavePromptPayload {
  prompt: PromptRecord;
}

export interface DeletePromptPayload {
  id: string;
}

export interface SwitchPromptPayload {
  id: string;
}
