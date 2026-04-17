import type { AgentId, AgentPayload } from "@shared/types";
import { agentMeta } from "@/lib/provider-helpers";

interface AgentRailProps {
  activeAgent: AgentId;
  agents: Record<AgentId, AgentPayload>;
  onSelect: (agent: AgentId) => void;
}

export function AgentRail({ activeAgent, agents, onSelect }: AgentRailProps) {
  return (
    <nav className="agent-switcher surface-card" aria-label="Agent switcher">
      <div className="agent-switcher-track">
        {(Object.keys(agentMeta) as AgentId[]).map((agent) => {
          const meta = agentMeta[agent];
          const payload = agents[agent];
          const isActive = agent === activeAgent;

          return (
            <button
              key={agent}
              type="button"
              className={`agent-switcher-item ${meta.accentClass} ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(agent)}
              aria-pressed={isActive}
              title={`${meta.label} · ${payload.providers.length}`}
            >
              <span className="agent-switcher-name">{meta.shortLabel}</span>
              <span className="agent-switcher-count">{payload.providers.length}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
