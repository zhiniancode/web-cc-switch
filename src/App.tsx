import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import type {
  AgentId,
  AgentPayload,
  PromptRecord,
  ProviderRecord,
} from "@shared/types";
import { AgentRail } from "@/components/AgentRail";
import { LoginScreen } from "@/components/LoginScreen";
import { PromptEditorModal } from "@/components/PromptEditorModal";
import { PromptPanel } from "@/components/PromptPanel";
import { ProviderEditorModal } from "@/components/ProviderEditorModal";
import { ProviderGrid } from "@/components/ProviderGrid";
import {
  activatePrompt,
  activateProvider,
  createPrompt,
  createProvider,
  fetchAgent,
  getSession,
  login,
  logout,
  removePrompt,
  removeProvider,
  updatePrompt,
  updateProvider,
} from "@/lib/api";
import {
  agentMeta,
  createProviderDraft,
  draftToProvider,
  type ProviderEditorDraft,
} from "@/lib/provider-helpers";
import {
  createPromptDraft,
  draftToPrompt,
  type PromptEditorDraft,
} from "@/lib/prompt-helpers";

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

type PromptModalState =
  | {
      open: false;
      mode: "create" | "edit";
      draft: null;
    }
  | {
      open: true;
      mode: "create" | "edit";
      draft: PromptEditorDraft;
    };

const EMPTY_AGENT_PAYLOAD: Record<AgentId, AgentPayload> = {
  claude: {
    agent: "claude",
    providers: [],
    currentProviderId: "",
    prompts: [],
    currentPromptId: "",
  },
  codex: {
    agent: "codex",
    providers: [],
    currentProviderId: "",
    prompts: [],
    currentPromptId: "",
  },
  gemini: {
    agent: "gemini",
    providers: [],
    currentProviderId: "",
    prompts: [],
    currentPromptId: "",
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
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [promptSwitchingId, setPromptSwitchingId] = useState<string | null>(null);
  const [promptDeletingId, setPromptDeletingId] = useState<string | null>(null);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [editorState, setEditorState] = useState<EditorState>({
    open: false,
    mode: "create",
    draft: null,
  });
  const [promptEditorState, setPromptEditorState] = useState<PromptModalState>({
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

  const openCreatePromptModal = () => {
    setPromptEditorState({
      open: true,
      mode: "create",
      draft: createPromptDraft(),
    });
  };

  const openEditPromptModal = (prompt: PromptRecord) => {
    setPromptEditorState({
      open: true,
      mode: "edit",
      draft: createPromptDraft(prompt),
    });
  };

  const closePromptEditor = () => {
    setPromptEditorState({
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
    setIsSavingProvider(true);

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
      setIsSavingProvider(false);
    }
  };

  const handleSavePrompt = async (draft: PromptEditorDraft) => {
    setIsSavingPrompt(true);

    try {
      const prompt = draftToPrompt(draft);
      const payload =
        promptEditorState.mode === "create"
          ? await createPrompt(activeAgent, prompt)
          : await updatePrompt(activeAgent, prompt);

      updateAgentPayload(activeAgent, payload);
      closePromptEditor();
      toast.success(promptEditorState.mode === "create" ? "提示词已创建" : "提示词已更新");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      toast.error(message);
    } finally {
      setIsSavingPrompt(false);
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

  const handleSwitchPrompt = async (prompt: PromptRecord) => {
    const previous = activePayload;
    setPromptSwitchingId(prompt.id);
    updateAgentPayload(activeAgent, {
      ...activePayload,
      currentPromptId: prompt.id,
    });

    try {
      const payload = await activatePrompt(activeAgent, prompt.id);
      updateAgentPayload(activeAgent, payload);
      toast.success(`已激活 ${prompt.name}`);
    } catch (error) {
      updateAgentPayload(activeAgent, previous);
      const message = error instanceof Error ? error.message : "切换失败";
      toast.error(message);
    } finally {
      setPromptSwitchingId(null);
    }
  };

  const handleDeletePrompt = async (prompt: PromptRecord) => {
    const confirmed = window.confirm(`确认删除提示词 "${prompt.name}" 吗？`);
    if (!confirmed) {
      return;
    }

    setPromptDeletingId(prompt.id);
    try {
      const payload = await removePrompt(activeAgent, prompt.id);
      updateAgentPayload(activeAgent, payload);
      toast.success("提示词已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      toast.error(message);
    } finally {
      setPromptDeletingId(null);
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
              <div className="workspace-stack">
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

                <PromptPanel
                  agent={activeAgent}
                  payload={activePayload}
                  switchingId={promptSwitchingId}
                  deletingId={promptDeletingId}
                  onAdd={openCreatePromptModal}
                  onEdit={openEditPromptModal}
                  onSwitch={handleSwitchPrompt}
                  onDelete={handleDeletePrompt}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <ProviderEditorModal
        agent={activeAgent}
        open={editorState.open}
        mode={editorState.mode}
        initialDraft={editorState.draft}
        isSaving={isSavingProvider}
        onClose={closeEditor}
        onSave={handleSaveProvider}
      />

      <PromptEditorModal
        agent={activeAgent}
        open={promptEditorState.open}
        mode={promptEditorState.mode}
        initialDraft={promptEditorState.draft}
        isSaving={isSavingPrompt}
        onClose={closePromptEditor}
        onSave={handleSavePrompt}
      />

      <Toaster richColors position="top-right" />
    </>
  );
}

export default function App() {
  return <>{AppShell()}</>;
}
