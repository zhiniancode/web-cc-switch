import type { AgentId, PromptRecord } from "@shared/types";

export interface PromptEditorDraft {
  id: string;
  name: string;
  content: string;
}

export const promptFileNames: Record<AgentId, string> = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  gemini: "GEMINI.md",
};

export function createPromptDraft(prompt?: PromptRecord): PromptEditorDraft {
  if (!prompt) {
    return {
      id: crypto.randomUUID(),
      name: "",
      content: "",
    };
  }

  return {
    id: prompt.id,
    name: prompt.name,
    content: prompt.content,
  };
}

export function draftToPrompt(draft: PromptEditorDraft): PromptRecord {
  return {
    id: draft.id,
    name: draft.name.trim(),
    content: draft.content,
  };
}

export function getPromptPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized || "空提示词";
}
