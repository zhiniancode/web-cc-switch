import type { AgentId, AgentPayload, PromptRecord } from "@shared/types";
import { Edit3, FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  getPromptPreview,
  promptFileNames,
} from "@/lib/prompt-helpers";
import { agentMeta } from "@/lib/provider-helpers";

interface PromptPanelProps {
  agent: AgentId;
  payload: AgentPayload;
  switchingId: string | null;
  deletingId: string | null;
  onAdd: () => void;
  onEdit: (prompt: PromptRecord) => void;
  onSwitch: (prompt: PromptRecord) => void;
  onDelete: (prompt: PromptRecord) => void;
}

function getPromptStats(content: string): string {
  const lineCount = content.split(/\r?\n/).length;
  const charCount = content.length;
  return `${lineCount} 行 · ${charCount} 字符`;
}

export function PromptPanel({
  agent,
  payload,
  switchingId,
  deletingId,
  onAdd,
  onEdit,
  onSwitch,
  onDelete,
}: PromptPanelProps) {
  const meta = agentMeta[agent];
  const currentPrompt = payload.prompts.find(
    (prompt) => prompt.id === payload.currentPromptId,
  );

  return (
    <section className={`prompt-workspace surface-card section-card ${meta.accentClass}`}>
      <div className="surface-accent" />
      <div className="provider-toolbar">
        <div className="provider-toolbar-main">
          <h2>提示词</h2>
        </div>

        <div className="provider-toolbar-side">
          <div className="provider-toolbar-status">
            <div className="toolbar-chip">
              <span>Current</span>
              <strong>{currentPrompt?.name || "未设置"}</strong>
            </div>
            <div className="toolbar-chip">
              <span>Live File</span>
              <strong>{promptFileNames[agent]}</strong>
            </div>
            <div className="toolbar-chip">
              <span>Prompts</span>
              <strong>{payload.prompts.length}</strong>
            </div>
          </div>

          <button type="button" className="primary-button provider-toolbar-button" onClick={onAdd}>
            <Plus size={18} />
            <span>新建提示词</span>
          </button>
        </div>
      </div>

      {payload.prompts.length === 0 ? (
        <div className="empty-state">
          <h3>还没有提示词</h3>
          <p>创建后可以在不同 prompt 之间切换，并同步写入当前 agent 的 live Markdown。</p>
          <button type="button" className="primary-button" onClick={onAdd}>
            <Plus size={18} />
            <span>创建第一个提示词</span>
          </button>
        </div>
      ) : (
        <div className="prompt-grid">
          {payload.prompts.map((prompt) => {
            const isCurrent = payload.currentPromptId === prompt.id;
            const isSwitching = switchingId === prompt.id;
            const isDeleting = deletingId === prompt.id;

            return (
              <article
                key={prompt.id}
                className={`provider-card prompt-card ${meta.accentClass} ${isCurrent ? "is-current" : ""}`}
              >
                <span className="provider-card-accent" />

                <div className="provider-card-head">
                  <div className="provider-card-copy">
                    <div className="provider-title-row">
                      <h3>{prompt.name}</h3>
                      {isCurrent ? <span className="current-pill">Current</span> : null}
                    </div>
                  </div>

                  <div className="provider-meta">
                    <span className="provider-meta-pill">
                      <FileText size={14} />
                      <span>{promptFileNames[agent]}</span>
                    </span>
                  </div>
                </div>

                <div className="prompt-preview-shell">
                  <p className="prompt-preview">{getPromptPreview(prompt.content)}</p>
                  <span className="prompt-preview-meta">{getPromptStats(prompt.content)}</span>
                </div>

                <div className="provider-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onEdit(prompt)}
                  >
                    <Edit3 size={16} />
                    <span>编辑</span>
                  </button>

                  <button
                    type="button"
                    className="secondary-button danger"
                    onClick={() => onDelete(prompt)}
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                    <span>{isDeleting ? "删除中..." : "删除"}</span>
                  </button>

                  <button
                    type="button"
                    className={`primary-button compact ${isCurrent ? "is-muted" : ""}`}
                    disabled={isCurrent || isSwitching}
                    onClick={() => onSwitch(prompt)}
                  >
                    <RefreshCw size={16} className={isSwitching ? "spin" : ""} />
                    <span>{isCurrent ? "正在使用" : isSwitching ? "切换中..." : "激活"}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
