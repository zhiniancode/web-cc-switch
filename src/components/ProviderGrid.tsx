import { useState } from "react";
import type { AgentId, AgentPayload, ProviderRecord } from "@shared/types";
import {
  Edit3,
  Eye,
  EyeOff,
  Globe,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  agentMeta,
  getProviderApiKey,
  getProviderBaseUrl,
  getProviderModel,
  maskSecret,
} from "@/lib/provider-helpers";

interface ProviderGridProps {
  agent: AgentId;
  payload: AgentPayload;
  switchingId: string | null;
  deletingId: string | null;
  onAdd: () => void;
  onEdit: (provider: ProviderRecord) => void;
  onSwitch: (provider: ProviderRecord) => void;
  onDelete: (provider: ProviderRecord) => void;
}

export function ProviderGrid({
  agent,
  payload,
  switchingId,
  deletingId,
  onAdd,
  onEdit,
  onSwitch,
  onDelete,
}: ProviderGridProps) {
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});
  const meta = agentMeta[agent];
  const currentProvider = payload.providers.find(
    (provider) => provider.id === payload.currentProviderId,
  );

  return (
    <section className={`provider-workspace surface-card section-card ${meta.accentClass}`}>
      <div className="surface-accent" />
      <div className="provider-toolbar">
        <div className="provider-toolbar-main">
          <h2>{meta.label}</h2>
        </div>

        <div className="provider-toolbar-side">
          <div className="provider-toolbar-status">
            <div className="toolbar-chip">
              <span>Current</span>
              <strong>{currentProvider?.name || "未设置"}</strong>
            </div>
            <div className="toolbar-chip">
              <span>Providers</span>
              <strong>{payload.providers.length}</strong>
            </div>
          </div>

          <button type="button" className="primary-button provider-toolbar-button" onClick={onAdd}>
            <Plus size={18} />
            <span>新建 Provider</span>
          </button>
        </div>
      </div>

      {payload.providers.length === 0 ? (
        <div className="empty-state">
          <h3>还没有 Provider</h3>
          <button type="button" className="primary-button" onClick={onAdd}>
            <Plus size={18} />
            <span>创建第一个 Provider</span>
          </button>
        </div>
      ) : (
        <div className="provider-grid">
          {payload.providers.map((provider) => {
            const baseUrl = getProviderBaseUrl(agent, provider);
            const apiKey = getProviderApiKey(agent, provider);
            const model = getProviderModel(agent, provider);
            const apiKeyVisible = visibleApiKeys[provider.id] ?? false;
            const isCurrent = payload.currentProviderId === provider.id;
            const isSwitching = switchingId === provider.id;
            const isDeleting = deletingId === provider.id;

            return (
              <article
                key={provider.id}
                className={`provider-card ${meta.accentClass} ${isCurrent ? "is-current" : ""}`}
              >
                <span className="provider-card-accent" />

                <div className="provider-card-head">
                  <div className="provider-card-copy">
                    <div className="provider-title-row">
                      <h3>{provider.name}</h3>
                      {isCurrent ? <span className="current-pill">Current</span> : null}
                    </div>

                    {provider.notes ? (
                      <p className="provider-notes">{provider.notes}</p>
                    ) : null}
                  </div>

                  <div className="provider-meta">
                    <span className="provider-meta-pill">
                      {provider.category || "custom"}
                    </span>
                    {provider.websiteUrl ? (
                      <a href={provider.websiteUrl} target="_blank" rel="noreferrer">
                        <Globe size={14} />
                        <span>官网</span>
                      </a>
                    ) : null}
                  </div>
                </div>

                <dl className="provider-summary">
                  <div className="provider-summary-card provider-summary-card-block">
                    <dt>Base URL</dt>
                    <dd title={baseUrl}>{baseUrl}</dd>
                  </div>
                  <div key="api-key" className="provider-secret-shell">
                    <div className="provider-summary-card provider-summary-card-secret">
                      <dt>API Key</dt>
                      <dd
                        className={`provider-secret-value ${apiKey ? "" : "is-empty"} ${apiKeyVisible ? "is-revealed" : ""}`}
                        title={apiKeyVisible && apiKey ? apiKey : undefined}
                      >
                        {apiKey
                          ? apiKeyVisible
                            ? apiKey
                            : maskSecret(apiKey)
                          : "未设置"}
                      </dd>
                    </div>
                    {apiKey ? (
                      <button
                        type="button"
                        className="provider-secret-toggle"
                        onClick={() =>
                          setVisibleApiKeys((current) => ({
                            ...current,
                            [provider.id]: !apiKeyVisible,
                          }))
                        }
                        aria-label={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                      >
                        {apiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        <span>{apiKeyVisible ? "隐藏" : "显示"}</span>
                      </button>
                    ) : null}
                  </div>
                  {model ? (
                    <div className="provider-summary-card provider-summary-card-block">
                      <dt>Model</dt>
                      <dd title={model}>{model}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="provider-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onEdit(provider)}
                  >
                    <Edit3 size={16} />
                    <span>编辑</span>
                  </button>

                  <button
                    type="button"
                    className="secondary-button danger"
                    onClick={() => onDelete(provider)}
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                    <span>{isDeleting ? "删除中..." : "删除"}</span>
                  </button>

                  <button
                    type="button"
                    className={`primary-button compact ${isCurrent ? "is-muted" : ""}`}
                    disabled={isCurrent || isSwitching}
                    onClick={() => onSwitch(provider)}
                  >
                    <RefreshCw size={16} className={isSwitching ? "spin" : ""} />
                    <span>{isCurrent ? "正在使用" : isSwitching ? "切换中..." : "切换"}</span>
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
