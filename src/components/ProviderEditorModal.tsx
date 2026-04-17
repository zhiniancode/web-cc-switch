import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { AgentId } from "@shared/types";
import {
  categoryOptions,
  type ProviderEditorDraft,
  agentMeta,
  syncClaudeDraftFromJson,
  syncClaudeDraftFromPrimaryFields,
  syncCodexDraftFromAuthJson,
  syncCodexDraftFromPrimaryFields,
  syncCodexDraftFromToml,
  syncGeminiDraftFromEnv,
  syncGeminiDraftFromPrimaryFields,
} from "@/lib/provider-helpers";

function shouldOpenClaudeAdvanced(draft: ProviderEditorDraft | null): boolean {
  if (!draft) {
    return false;
  }

  return (
    draft.claudeApiFormat !== "anthropic" ||
    draft.claudeAuthField !== "ANTHROPIC_AUTH_TOKEN" ||
    !!draft.claudeReasoningModel.trim() ||
    !!draft.claudeHaikuModel.trim() ||
    !!draft.claudeSonnetModel.trim() ||
    !!draft.claudeOpusModel.trim()
  );
}

interface ProviderEditorModalProps {
  agent: AgentId;
  open: boolean;
  mode: "create" | "edit";
  initialDraft: ProviderEditorDraft | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: ProviderEditorDraft) => Promise<void>;
}

export function ProviderEditorModal({
  agent,
  open,
  mode,
  initialDraft,
  isSaving,
  onClose,
  onSave,
}: ProviderEditorModalProps) {
  const [draft, setDraft] = useState<ProviderEditorDraft | null>(initialDraft);
  const [claudeAdvancedOpen, setClaudeAdvancedOpen] = useState(
    shouldOpenClaudeAdvanced(initialDraft),
  );

  useEffect(() => {
    setDraft(initialDraft);
    setClaudeAdvancedOpen(shouldOpenClaudeAdvanced(initialDraft));
  }, [initialDraft]);

  if (!open || !draft) {
    return null;
  }

  const meta = agentMeta[agent];
  const isClaude = agent === "claude";
  const isCodex = agent === "codex";
  const isGemini = agent === "gemini";

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(draft);
  };

  const handleFormatClaudeJson = () => {
    try {
      const formatted = `${JSON.stringify(JSON.parse(draft.claudeJson), null, 2)}\n`;
      setDraft((current) =>
        current ? syncClaudeDraftFromJson(current, formatted) : current,
      );
      toast.success("settings.json 已格式化");
    } catch {
      toast.error("settings.json 不是合法 JSON");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal-panel ${meta.accentClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="surface-accent" />
        <div className="modal-head">
          <div>
            <div className="eyebrow">{mode === "create" ? "Create" : "Edit"}</div>
            <h2>{mode === "create" ? "新建 Provider" : "编辑 Provider"}</h2>
          </div>

          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSave}>
          {isCodex || isClaude || isGemini ? (
            <>
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">供应商名称</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        if (isCodex) {
                          return syncCodexDraftFromPrimaryFields(current, {
                            name: event.target.value,
                          });
                        }

                        if (isClaude) {
                          return syncClaudeDraftFromPrimaryFields(current, {
                            name: event.target.value,
                          });
                        }

                        return syncGeminiDraftFromPrimaryFields(current, {
                          name: event.target.value,
                        });
                      })
                    }
                    placeholder={
                      isCodex
                        ? "例如 OpenAI / OpenRouter / New API"
                        : isClaude
                          ? "例如 Anthropic / OpenRouter / Vertex AI"
                          : "例如 Google AI Studio / Vertex AI / OpenRouter"
                    }
                  />
                </label>

                <label className="field">
                  <span className="field-label">配置类型</span>
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        if (isCodex) {
                          return syncCodexDraftFromPrimaryFields(current, {
                            category: event.target.value as ProviderEditorDraft["category"],
                          });
                        }

                        if (isClaude) {
                          return syncClaudeDraftFromPrimaryFields(current, {
                            category: event.target.value as ProviderEditorDraft["category"],
                          });
                        }

                        return syncGeminiDraftFromPrimaryFields(current, {
                          category: event.target.value as ProviderEditorDraft["category"],
                        });
                      })
                    }
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">API Key</span>
                  <input
                    value={
                      isCodex
                        ? draft.codexApiKey
                        : isClaude
                          ? draft.claudeApiKey
                          : draft.geminiApiKey
                    }
                    onChange={(event) =>
                      setDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        if (isCodex) {
                          return syncCodexDraftFromPrimaryFields(current, {
                            codexApiKey: event.target.value,
                          });
                        }

                        if (isClaude) {
                          return syncClaudeDraftFromPrimaryFields(current, {
                            claudeApiKey: event.target.value,
                          });
                        }

                        return syncGeminiDraftFromPrimaryFields(current, {
                          geminiApiKey: event.target.value,
                        });
                      })
                    }
                    placeholder={isCodex ? "sk-..." : isClaude ? "sk-ant-..." : "AIza..."}
                  />
                </label>

                <label className="field">
                  <span className="field-label">API 请求地址</span>
                  <input
                    value={
                      isCodex
                        ? draft.codexBaseUrl
                        : isClaude
                          ? draft.claudeBaseUrl
                          : draft.geminiBaseUrl
                    }
                    onChange={(event) =>
                      setDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        if (isCodex) {
                          return syncCodexDraftFromPrimaryFields(current, {
                            codexBaseUrl: event.target.value,
                          });
                        }

                        if (isClaude) {
                          return syncClaudeDraftFromPrimaryFields(current, {
                            claudeBaseUrl: event.target.value,
                          });
                        }

                        return syncGeminiDraftFromPrimaryFields(current, {
                          geminiBaseUrl: event.target.value,
                        });
                      })
                    }
                    placeholder={
                      isCodex
                        ? "https://api.openai.com/v1"
                        : isClaude
                          ? "https://api.anthropic.com"
                          : "https://generativelanguage.googleapis.com"
                    }
                  />
                </label>

                <label className="field">
                  <span className="field-label">{isClaude ? "主模型" : "模型名称"}</span>
                  <input
                    value={
                      isCodex
                        ? draft.codexModel
                        : isClaude
                          ? draft.claudeModel
                          : draft.geminiModel
                    }
                    onChange={(event) =>
                      setDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        if (isCodex) {
                          return syncCodexDraftFromPrimaryFields(current, {
                            codexModel: event.target.value,
                          });
                        }

                        if (isClaude) {
                          return syncClaudeDraftFromPrimaryFields(current, {
                            claudeModel: event.target.value,
                          });
                        }

                        return syncGeminiDraftFromPrimaryFields(current, {
                          geminiModel: event.target.value,
                        });
                      })
                    }
                    placeholder={
                      isCodex
                        ? "gpt-5.4"
                        : isClaude
                          ? "claude-sonnet-4-0"
                          : "gemini-2.5-pro"
                    }
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="form-grid">
              <label className="field">
                <span className="field-label">名称</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            name: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="例如 OpenAI Official / My Router"
                />
              </label>

              <label className="field">
                <span className="field-label">官网</span>
                <input
                  value={draft.websiteUrl}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            websiteUrl: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="https://..."
                />
              </label>

              <label className="field">
                <span className="field-label">分类</span>
                <select
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            category: event.target.value as ProviderEditorDraft["category"],
                          }
                        : current,
                    )
                  }
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field-span-2">
                <span className="field-label">备注</span>
                <textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            notes: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="可选备注"
                />
              </label>
            </div>
          )}

          {agent === "claude" ? (
            <section className="advanced-section">
              <button
                type="button"
                className="advanced-toggle"
                onClick={() => setClaudeAdvancedOpen((current) => !current)}
              >
                <span>高级选项</span>
                <span>{claudeAdvancedOpen ? "收起" : "展开"}</span>
              </button>

              {claudeAdvancedOpen ? (
                <div className="advanced-panel">
                  <div className="form-grid">
                    <label className="field">
                      <span className="field-label">API 格式</span>
                      <select
                        value={draft.claudeApiFormat}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? syncClaudeDraftFromPrimaryFields(current, {
                                  claudeApiFormat: event.target
                                    .value as ProviderEditorDraft["claudeApiFormat"],
                                })
                              : current,
                          )
                        }
                      >
                        <option value="anthropic">Anthropic Messages</option>
                        <option value="openai_chat">OpenAI Chat Completions</option>
                        <option value="openai_responses">OpenAI Responses API</option>
                        <option value="gemini_native">Gemini Native</option>
                      </select>
                    </label>

                    <label className="field">
                      <span className="field-label">认证字段</span>
                      <select
                        value={draft.claudeAuthField}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? syncClaudeDraftFromPrimaryFields(current, {
                                  claudeAuthField: event.target
                                    .value as ProviderEditorDraft["claudeAuthField"],
                                })
                              : current,
                          )
                        }
                      >
                        <option value="ANTHROPIC_AUTH_TOKEN">ANTHROPIC_AUTH_TOKEN</option>
                        <option value="ANTHROPIC_API_KEY">ANTHROPIC_API_KEY</option>
                      </select>
                    </label>

                    <div className="field field-span-2 field-heading">
                      <span className="field-label">模型映射</span>
                      <span className="field-hint">
                        按需覆盖推理模型和 Haiku / Sonnet / Opus 映射
                      </span>
                    </div>

                    <label className="field">
                      <span className="field-label">推理模型</span>
                      <input
                        value={draft.claudeReasoningModel}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? syncClaudeDraftFromPrimaryFields(current, {
                                  claudeReasoningModel: event.target.value,
                                })
                              : current,
                          )
                        }
                        placeholder="例如 claude-sonnet-4.5-thinking"
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Haiku</span>
                      <input
                        value={draft.claudeHaikuModel}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? syncClaudeDraftFromPrimaryFields(current, {
                                  claudeHaikuModel: event.target.value,
                                })
                              : current,
                          )
                        }
                        placeholder="例如 claude-haiku-4.1"
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Sonnet</span>
                      <input
                        value={draft.claudeSonnetModel}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? syncClaudeDraftFromPrimaryFields(current, {
                                  claudeSonnetModel: event.target.value,
                                })
                              : current,
                          )
                        }
                        placeholder="例如 claude-sonnet-4.5"
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Opus</span>
                      <input
                        value={draft.claudeOpusModel}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? syncClaudeDraftFromPrimaryFields(current, {
                                  claudeOpusModel: event.target.value,
                                })
                              : current,
                          )
                        }
                        placeholder="例如 claude-opus-4"
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {agent === "claude" ? (
            <section className="quick-toggle-section">
              <div className="quick-toggle-grid">
                <label className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={draft.claudeHideAttribution}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? syncClaudeDraftFromPrimaryFields(current, {
                              claudeHideAttribution: event.target.checked,
                            })
                          : current,
                      )
                    }
                  />
                  <span>隐藏 AI 署名</span>
                </label>

                <label className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={draft.claudeTeammates}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? syncClaudeDraftFromPrimaryFields(current, {
                              claudeTeammates: event.target.checked,
                            })
                          : current,
                      )
                    }
                  />
                  <span>Teammates 模式</span>
                </label>

                <label className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={draft.claudeEnableToolSearch}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? syncClaudeDraftFromPrimaryFields(current, {
                              claudeEnableToolSearch: event.target.checked,
                            })
                          : current,
                      )
                    }
                  />
                  <span>启用 Tool Search</span>
                </label>

                <label className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={draft.claudeHighEffort}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? syncClaudeDraftFromPrimaryFields(current, {
                              claudeHighEffort: event.target.checked,
                            })
                          : current,
                      )
                    }
                  />
                  <span>高强度思考</span>
                </label>

                <label className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={draft.claudeDisableAutoUpgrade}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? syncClaudeDraftFromPrimaryFields(current, {
                              claudeDisableAutoUpgrade: event.target.checked,
                            })
                          : current,
                      )
                    }
                  />
                  <span>禁用自动升级</span>
                </label>
              </div>
            </section>
          ) : null}

          {agent === "claude" ? (
            <label className="field">
              <div className="editor-label-row">
                <span className="field-label">settings.json</span>
                <button
                  type="button"
                  className="editor-action"
                  onClick={handleFormatClaudeJson}
                >
                  格式化
                </button>
              </div>
              <textarea
                className="code-input"
                rows={18}
                value={draft.claudeJson}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? syncClaudeDraftFromJson(current, event.target.value)
                      : current,
                  )
                }
              />
            </label>
          ) : null}

          {agent === "codex" ? (
            <div className="form-grid split-editors">
              <label className="field">
                <span className="field-label">auth.json (JSON)</span>
                <textarea
                  className="code-input"
                  rows={16}
                  value={draft.codexAuthJson}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? syncCodexDraftFromAuthJson(current, event.target.value)
                        : current,
                    )
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">config.toml (TOML)</span>
                <textarea
                  className="code-input"
                  rows={16}
                  value={draft.codexToml}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? syncCodexDraftFromToml(current, event.target.value)
                        : current,
                    )
                  }
                />
              </label>
            </div>
          ) : null}

          {agent === "gemini" ? (
            <div className="form-grid split-editors">
              <label className="field">
                <span className="field-label">.env</span>
                <textarea
                  className="code-input"
                  rows={16}
                  value={draft.geminiEnv}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? syncGeminiDraftFromEnv(current, event.target.value)
                        : current,
                    )
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">settings.json</span>
                <textarea
                  className="code-input"
                  rows={16}
                  value={draft.geminiSettingsJson}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            geminiSettingsJson: event.target.value,
                          }
                        : current,
                    )
                  }
                />
              </label>
            </div>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? "保存中..." : mode === "create" ? "创建 Provider" : "保存修改"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
