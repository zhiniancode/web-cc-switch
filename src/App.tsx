import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import type { AgentId, AgentPayload, ProviderRecord } from "@shared/types";
import { AgentRail } from "@/components/AgentRail";
import { LoginScreen } from "@/components/LoginScreen";
import { ProviderEditorModal } from "@/components/ProviderEditorModal";
import { ProviderGrid } from "@/components/ProviderGrid";
import {
  activateProvider,
  createProvider,
  fetchAgent,
  getSession,
  login,
  logout,
  removeProvider,
  updateProvider,
} from "@/lib/api";
import {
  agentMeta,
  createProviderDraft,
  draftToProvider,
  type ProviderEditorDraft,
} from "@/lib/provider-helpers";

type SessionState = "checking" | "guest" | "ready";

type EditorState =
  | {
      open: false;
      mode: "create" | "edit";
      draft: null;
    }
  | {
      open: true;
      mode: "create" | "edit";
      draft: ProviderEditorDraft;
    };

const EMPTY_AGENT_PAYLOAD: Record<AgentId, AgentPayload> = {
  claude: {
    agent: "claude",
    providers: [],
    currentProviderId: "",
  },
  codex: {
    agent: "codex",
    providers: [],
    currentProviderId: "",
  },
  gemini: {
    agent: "gemini",
    providers: [],
    currentProviderId: "",
  },
};

function LoadingScreen() {
  return (
    <main className="loading-shell">
      <div className="loading-card">
        <div className="surface-accent" />
        <RefreshCw size={20} className="spin" />
        <span>正在加载控制台...</span>
      </div>
    </main>
  );
}

function AppHeader({
  activeAgent,
  onLogout,
}: {
  activeAgent: AgentId;
  payload: AgentPayload;
  onLogout: () => Promise<void>;
}) {
  const meta = agentMeta[activeAgent];

  return (
    <header className={`app-header surface-card ${meta.accentClass}`}>
      <div className="surface-accent" />
      <div className="app-header-main">
        <div className="eyebrow app-header-eyebrow">
          <ShieldCheck size={15} />
          <span>config.everso.top</span>
        </div>
        <div className="app-header-copy">
          <div className="app-title-row">
            <h1>CC Switch Web</h1>
            <span className="header-agent-badge">{meta.shortLabel}</span>
          </div>
        </div>
      </div>

      <div className="app-header-side">
        <div className="app-header-actions">
          <button type="button" className="secondary-button" onClick={onLogout}>
            <LogOut size={16} />
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function AppShell(): ReactNode {
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [agents, setAgents] =
    useState<Record<AgentId, AgentPayload>>(EMPTY_AGENT_PAYLOAD);
  const [activeAgent, setActiveAgent] = useState<AgentId>("claude");
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editorState, setEditorState] = useState<EditorState>({
    open: false,
    mode: "create",
    draft: null,
  });

  const activePayload = useMemo(() => agents[activeAgent], [activeAgent, agents]);

  const loadAgents = async () => {
    setIsLoadingAgents(true);
    try {
      const [claude, codex, gemini] = await Promise.all([
        fetchAgent("claude"),
        fetchAgent("codex"),
        fetchAgent("gemini"),
      ]);

      setAgents({
        claude,
        codex,
        gemini,
      });
    } finally {
      setIsLoadingAgents(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const session = await getSession();
        if (!session.authenticated) {
          setSessionState("guest");
          return;
        }
        await loadAgents();
        setSessionState("ready");
      } catch (error) {
        console.error(error);
        setSessionState("guest");
      }
    };

    void bootstrap();
  }, []);

  const handleLogin = async (password: string) => {
    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      await login(password);
      await loadAgents();
      setSessionState("ready");
      toast.success("已进入控制台");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setLoginError(message);
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setSessionState("guest");
    setAgents(EMPTY_AGENT_PAYLOAD);
    toast.success("已退出登录");
  };

  const handleSwitchAgent = (agent: AgentId) => {
    startTransition(() => {
      setActiveAgent(agent);
    });
  };

  const openCreateModal = () => {
    setEditorState({
      open: true,
      mode: "create",
      draft: createProviderDraft(activeAgent),
    });
  };

  const openEditModal = (provider: ProviderRecord) => {
    setEditorState({
      open: true,
      mode: "edit",
      draft: createProviderDraft(activeAgent, provider),
    });
  };

  const closeEditor = () => {
    setEditorState({
      open: false,
      mode: "create",
      draft: null,
    });
  };

  const updateAgentPayload = (agent: AgentId, payload: AgentPayload) => {
    setAgents((current) => ({
      ...current,
      [agent]: payload,
    }));
  };

  const handleSaveProvider = async (draft: ProviderEditorDraft) => {
    setIsSaving(true);

    try {
      const provider = draftToProvider(activeAgent, draft);
      const payload =
        editorState.mode === "create"
          ? await createProvider(activeAgent, provider)
          : await updateProvider(activeAgent, provider);

      updateAgentPayload(activeAgent, payload);
      closeEditor();
      toast.success(editorState.mode === "create" ? "Provider 已创建" : "Provider 已更新");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchProvider = async (provider: ProviderRecord) => {
    const previous = activePayload;
    setSwitchingId(provider.id);
    updateAgentPayload(activeAgent, {
      ...activePayload,
      currentProviderId: provider.id,
    });

    try {
      const payload = await activateProvider(activeAgent, provider.id);
      updateAgentPayload(activeAgent, payload);
      toast.success(`已切换到 ${provider.name}`);
    } catch (error) {
      updateAgentPayload(activeAgent, previous);
      const message = error instanceof Error ? error.message : "切换失败";
      toast.error(message);
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDeleteProvider = async (provider: ProviderRecord) => {
    const confirmed = window.confirm(`确认删除 Provider "${provider.name}" 吗？`);
    if (!confirmed) {
      return;
    }

    setDeletingId(provider.id);
    try {
      const payload = await removeProvider(activeAgent, provider.id);
      updateAgentPayload(activeAgent, payload);
      toast.success("Provider 已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (sessionState === "checking") {
    return <LoadingScreen />;
  }

  if (sessionState === "guest") {
    return (
      <>
        <LoginScreen
          isSubmitting={isSubmittingLogin}
          errorMessage={loginError}
          onSubmit={handleLogin}
        />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <>
      <main className="app-shell">
        <div className="app-frame">
          <AppHeader
            activeAgent={activeAgent}
            payload={activePayload}
            onLogout={handleLogout}
          />

          <div className="app-layout">
            <AgentRail
              activeAgent={activeAgent}
              agents={agents}
              onSelect={handleSwitchAgent}
            />

            {isLoadingAgents ? (
              <LoadingScreen />
            ) : (
              <ProviderGrid
                agent={activeAgent}
                payload={activePayload}
                switchingId={switchingId}
                deletingId={deletingId}
                onAdd={openCreateModal}
                onEdit={openEditModal}
                onSwitch={handleSwitchProvider}
                onDelete={handleDeleteProvider}
              />
            )}
          </div>
        </div>
      </main>

      <ProviderEditorModal
        agent={activeAgent}
        open={editorState.open}
        mode={editorState.mode}
        initialDraft={editorState.draft}
        isSaving={isSaving}
        onClose={closeEditor}
        onSave={handleSaveProvider}
      />

      <Toaster richColors position="top-right" />
    </>
  );
}

export default function App() {
  return <>{AppShell()}</>;
}
