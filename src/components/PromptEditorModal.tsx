import { useEffect, useState, type FormEvent } from "react";
import type { AgentId } from "@shared/types";
import {
  promptFileNames,
  type PromptEditorDraft,
} from "@/lib/prompt-helpers";
import { agentMeta } from "@/lib/provider-helpers";

interface PromptEditorModalProps {
  agent: AgentId;
  open: boolean;
  mode: "create" | "edit";
  initialDraft: PromptEditorDraft | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: PromptEditorDraft) => Promise<void>;
}

export function PromptEditorModal({
  agent,
  open,
  mode,
  initialDraft,
  isSaving,
  onClose,
  onSave,
}: PromptEditorModalProps) {
  const [draft, setDraft] = useState<PromptEditorDraft | null>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  if (!open || !draft) {
    return null;
  }

  const meta = agentMeta[agent];

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(draft);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal-panel modal-panel-narrow ${meta.accentClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="surface-accent" />
        <div className="modal-head">
          <div>
            <div className="eyebrow">{mode === "create" ? "Create" : "Edit"}</div>
            <h2>{mode === "create" ? "新建提示词" : "编辑提示词"}</h2>
            <p>激活后会同步写入 `{promptFileNames[agent]}`。</p>
          </div>

          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSave}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">提示词名称</span>
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
                placeholder="例如 default / review / architect"
                autoFocus
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Markdown 内容</span>
            <textarea
              className="code-input prompt-code-input"
              rows={22}
              value={draft.content}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        content: event.target.value,
                      }
                    : current,
                )
              }
              placeholder="输入提示词内容"
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? "保存中..." : mode === "create" ? "创建提示词" : "保存修改"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
