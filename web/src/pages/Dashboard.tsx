import { useState, useEffect, useCallback, createContext, useContext } from "react";

const API_BASE = window.location.port === "5173" || window.location.port === "3030" ? "" : "http://localhost:3030";

type Lang = "en" | "zh";
const I18nContext = createContext<{ t: (key: string) => string; lang: Lang; setLang: (l: Lang) => void }>({
  t: (k) => k, lang: "en", setLang: () => {},
});

const translations: Record<Lang, Record<string, string>> = {
  en: {
    title: "AI CLI Config Manager",
    subtitle: "Manage your AI tools in one place",
    refresh: "Refresh",
    clis_detected: "CLIs Detected",
    mcp_servers: "MCP Servers",
    authenticated: "Authenticated",
    mcp_overlap: "MCP Server Overlap",
    configured_in: "is configured in",
    config_not_found: "Config file not found",
    model: "Model",
    models: "Models",
    plugins: "Plugins",
    details: "Details",
    backups: "Backups",
    no_backups: "No backups yet",
    restore: "Restore",
    restore_confirm: "Restore this backup? Current config will be backed up first.",
    delete_confirm: "Delete MCP server",
    export: "Export",
    import: "Import",
    templates: "MCP Templates",
    health: "Health Check",
    export_all: "Export All Configs",
    export_single: "Export Single CLI",
    download: "Download",
    import_snapshot: "Import Snapshot",
    import_select_file: "Select a snapshot JSON file",
    import_success: "Import completed",
    install: "Install",
    install_to: "Install to",
    no_issues: "All checks passed",
    running_check: "Running health check...",
    switching: "Switching...",
    open_vscode: "Open in VSCode",
    launch: "Launch in Terminal",
    launch_success: "Launched",
    launch_error: "Failed to launch",
  },
  zh: {
    title: "AI CLI 配置管理器",
    subtitle: "一站式管理你的 AI 工具",
    refresh: "刷新",
    clis_detected: "已检测 CLI",
    mcp_servers: "MCP 服务器",
    authenticated: "已认证",
    mcp_overlap: "MCP 服务器重叠",
    configured_in: "同时配置在",
    config_not_found: "配置文件未找到",
    model: "模型",
    models: "模型",
    plugins: "插件",
    details: "详细信息",
    backups: "备份",
    no_backups: "暂无备份",
    restore: "还原",
    restore_confirm: "确定还原此备份？当前配置将先被备份。",
    delete_confirm: "删除 MCP 服务器",
    export: "导出",
    import: "导入",
    templates: "MCP 模板",
    health: "健康检查",
    export_all: "导出全部配置",
    export_single: "导出单个 CLI",
    download: "下载",
    import_snapshot: "导入快照",
    import_select_file: "选择快照 JSON 文件",
    import_success: "导入完成",
    install: "安装",
    install_to: "安装到",
    no_issues: "所有检查通过",
    running_check: "正在检查...",
    switching: "切换中...",
    open_vscode: "在 VSCode 中打开",
    launch: "在终端中启动",
    launch_success: "已启动",
    launch_error: "启动失败",
  },
};

interface MCPServer {
  name: string;
  type: string;
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

interface CLIConfig {
  id: string;
  name: string;
  version?: string;
  configPath: string;
  exists: boolean;
  authStatus: "authenticated" | "unauthenticated" | "unknown";
  authDetail: string;
  mcpServers?: MCPServer[];
  models?: { id: string; name: string }[];
  plugins?: string[];
  rawStats: Record<string, unknown>;
  rawConfig?: Record<string, unknown>;
}

interface BackupInfo {
  path: string;
  timestamp: number;
  size: number;
}

const CLI_ICONS: Record<string, string> = {
  claude: "🟣",
  opencode: "⚡",
  gemini: "💎",
  codex: "🤖",
  copilot: "🐙",
};

const EDITABLE_CLIS = new Set(["claude", "gemini"]);

function AuthBadge({ status }: { status: CLIConfig["authStatus"] }) {
  const colors = {
    authenticated: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    unauthenticated: "bg-red-500/20 text-red-400 border-red-500/30",
    unknown: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  const dots = {
    authenticated: "bg-emerald-400",
    unauthenticated: "bg-red-400",
    unknown: "bg-gray-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {status}
    </span>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-gray-600"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${type === "success" ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"}`}>
      {message}
    </div>
  );
}

function MCPRow({
  server,
  cliId,
  allConfigs,
  onRefresh,
  showToast,
}: {
  server: MCPServer;
  cliId: string;
  allConfigs: CLIConfig[];
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [checking, setChecking] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const canEdit = EDITABLE_CLIS.has(cliId);
  const isDisabled = server.disabled || false;

  async function handleToggle() {
    const res = await fetch(`${API_BASE}/api/configs/${cliId}/mcp/${encodeURIComponent(server.name)}/toggle`, { method: "POST" });
    if (res.ok) {
      showToast(`${server.name} ${isDisabled ? "enabled" : "disabled"}`, "success");
      onRefresh();
    } else {
      showToast("Toggle failed", "error");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete MCP server "${server.name}"?`)) return;
    const res = await fetch(`${API_BASE}/api/configs/${cliId}/mcp/${encodeURIComponent(server.name)}/delete`, { method: "POST" });
    if (res.ok) {
      showToast(`${server.name} deleted`, "success");
      onRefresh();
    } else {
      showToast("Delete failed", "error");
    }
  }

  async function handleCheck() {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/mcp/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: server.type, command: server.command, url: server.url }),
      });
      const data = await res.json();
      setReachable(data.reachable);
    } catch {
      setReachable(false);
    }
    setChecking(false);
  }

  async function handleCopy(targetCliId: string) {
    setCopyOpen(false);
    const mcpConfig: Record<string, unknown> = {};
    if (server.command) mcpConfig.command = server.command;
    if (server.args) mcpConfig.args = server.args;
    if (server.env) mcpConfig.env = server.env;
    if (server.url) mcpConfig.url = server.url;
    if (server.type === "http" || server.type === "sse") mcpConfig.type = server.type;

    const res = await fetch(`${API_BASE}/api/configs/${targetCliId}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: server.name, config: mcpConfig }),
    });
    if (res.ok) {
      showToast(`Copied "${server.name}" to ${targetCliId}`, "success");
      onRefresh();
    } else {
      showToast("Copy failed", "error");
    }
  }

  const copyTargets = allConfigs.filter((c) => EDITABLE_CLIS.has(c.id) && c.id !== cliId && c.exists);

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-800/50 ${isDisabled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${server.type === "http" || server.type === "sse" ? "bg-blue-500/20 text-blue-400" : "bg-gray-700 text-gray-400"}`}>
          {server.type}
        </span>
        <span className="text-sm text-gray-200 truncate">{server.name}</span>
        {server.command && <span className="text-xs text-gray-500 font-mono truncate hidden sm:inline">{server.command}</span>}

        {reachable !== null && (
          <span className={`w-2 h-2 rounded-full ${reachable ? "bg-emerald-400" : "bg-red-400"}`} />
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={handleCheck} disabled={checking} className="text-xs text-gray-500 hover:text-violet-400 px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors" title="Check connectivity">
          {checking ? "..." : "ping"}
        </button>

        {canEdit && (
          <>
            <Toggle enabled={!isDisabled} onToggle={handleToggle} />
            <button onClick={handleDelete} className="text-xs text-gray-500 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors" title="Delete">
              ✕
            </button>
          </>
        )}

        {copyTargets.length > 0 && (
          <div className="relative">
            <button onClick={() => setCopyOpen(!copyOpen)} className="text-xs text-gray-500 hover:text-violet-400 px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors" title="Copy to...">
              copy
            </button>
            {copyOpen && (
              <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                {copyTargets.map((t) => (
                  <button key={t.id} onClick={() => handleCopy(t.id)} className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white">
                    {CLI_ICONS[t.id]} {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BackupsSection({ cliId, showToast, onRefresh }: { cliId: string; showToast: (msg: string, type: "success" | "error") => void; onRefresh: () => void }) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadBackups() {
    const res = await fetch(`${API_BASE}/api/configs/${cliId}/backups`);
    if (res.ok) setBackups(await res.json());
    setLoaded(true);
  }

  useEffect(() => { loadBackups(); }, [cliId]);

  async function handleRestore(timestamp: number) {
    if (!confirm("Restore this backup? Current config will be backed up first.")) return;
    const res = await fetch(`${API_BASE}/api/configs/${cliId}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestamp }),
    });
    if (res.ok) {
      showToast("Restored successfully", "success");
      onRefresh();
      loadBackups();
    } else {
      showToast("Restore failed", "error");
    }
  }

  if (!loaded) return null;
  if (backups.length === 0) return <p className="text-xs text-gray-600 italic">No backups yet</p>;

  return (
    <div className="space-y-1.5">
      {backups.slice(0, 5).map((b) => (
        <div key={b.timestamp} className="flex items-center justify-between px-3 py-1.5 rounded bg-gray-800/50 text-xs">
          <span className="text-gray-400">{new Date(b.timestamp).toLocaleString()}</span>
          <span className="text-gray-500">{(b.size / 1024).toFixed(1)} KB</span>
          <button onClick={() => handleRestore(b.timestamp)} className="text-violet-400 hover:text-violet-300">
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}

const CLAUDE_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "claude-haiku-3.5-20241022",
  "claude-sonnet-3.5-20241022",
];

function ModelSection({ cliId, models, showToast, onRefresh }: {
  cliId: string;
  models: { id: string; name: string }[];
  showToast: (msg: string, type: "success" | "error") => void;
  onRefresh: () => void;
}) {
  const [switching, setSwitching] = useState(false);
  const canSwitch = cliId === "claude";
  const currentModel = models[0]?.id;

  async function handleSwitch(model: string) {
    if (model === currentModel) return;
    setSwitching(true);
    const res = await fetch(`${API_BASE}/api/configs/${cliId}/model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (res.ok) {
      showToast(`Model switched to ${model}`, "success");
      onRefresh();
    } else {
      showToast("Model switch failed", "error");
    }
    setSwitching(false);
  }

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-2">Models</h4>
      {canSwitch ? (
        <div className="flex items-center gap-3">
          <select
            value={currentModel || ""}
            onChange={(e) => handleSwitch(e.target.value)}
            disabled={switching}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:border-violet-500 focus:outline-none"
          >
            {CLAUDE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            {currentModel && !CLAUDE_MODELS.includes(currentModel) && (
              <option value={currentModel}>{currentModel}</option>
            )}
          </select>
          {switching && <span className="text-xs text-gray-500 animate-pulse">Switching...</span>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {models.map((m) => (
            <span key={m.id} className="text-xs bg-violet-500/15 text-violet-300 px-2 py-1 rounded font-mono">{m.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function CLICard({ config, allConfigs, onRefresh, showToast }: { config: CLIConfig; allConfigs: CLIConfig[]; onRefresh: () => void; showToast: (msg: string, type: "success" | "error") => void }) {
  const [expanded, setExpanded] = useState(false);
  const [launching, setLaunching] = useState(false);
  const { t } = useContext(I18nContext);
  const mcpCount = config.mcpServers?.length || 0;
  const pluginCount = config.plugins?.length || 0;
  const primaryModel = config.models?.[0];
  const canEdit = EDITABLE_CLIS.has(config.id);

  return (
    <div className={`bg-gray-900 border rounded-xl transition-colors ${expanded ? "border-violet-500/60 col-span-1 md:col-span-2 lg:col-span-3" : "border-gray-800 hover:border-violet-500/40"}`}>
      <div className="p-6 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{CLI_ICONS[config.id] || "📦"}</span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">{config.name}</h3>
              <a
                href={API_BASE ? undefined : `vscode://file${config.configPath}`}
                className="text-xs text-gray-500 hover:text-violet-400 font-mono truncate block transition-colors cursor-pointer"
                title="Open in VSCode"
                onClick={(e) => {
                  e.stopPropagation();
                  if (API_BASE) {
                    e.preventDefault();
                    fetch(`${API_BASE}/api/open-in-editor`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path: config.configPath }),
                    });
                  }
                }}
              >
                {config.configPath}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AuthBadge status={config.authStatus} />
            <span className={`text-gray-500 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
          </div>
        </div>

        {!config.exists ? (
          <p className="text-gray-600 text-sm italic">Config file not found</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">{config.authDetail}</p>
            {primaryModel && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Model:</span>
                <span className="text-xs bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded font-mono">{primaryModel.name}</span>
              </div>
            )}
            <div className="flex gap-4 pt-2 border-t border-gray-800">
              {mcpCount > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-violet-400">{mcpCount}</div>
                  <div className="text-xs text-gray-500">MCP Servers</div>
                </div>
              )}
              {pluginCount > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-violet-400">{pluginCount}</div>
                  <div className="text-xs text-gray-500">Plugins</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {expanded && config.exists && (
        <div className="border-t border-gray-800 p-6 space-y-6">
          {config.mcpServers && config.mcpServers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">MCP Servers</h4>
              <div className="space-y-2">
                {config.mcpServers.map((s) => (
                  <MCPRow key={s.name} server={s} cliId={config.id} allConfigs={allConfigs} onRefresh={onRefresh} showToast={showToast} />
                ))}
              </div>
            </div>
          )}

          {config.models && config.models.length > 0 && (
            <ModelSection cliId={config.id} models={config.models} showToast={showToast} onRefresh={onRefresh} />
          )}

          {config.plugins && config.plugins.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Plugins</h4>
              <div className="flex flex-wrap gap-2">
                {config.plugins.map((p) => (
                  <span key={p} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">{p}</span>
                ))}
              </div>
            </div>
          )}

          {Object.keys(config.rawStats).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Details</h4>
              <pre className="text-xs text-gray-500 bg-gray-800/50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(config.rawStats, null, 2)}</pre>
            </div>
          )}

          {canEdit && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Backups</h4>
              <BackupsSection cliId={config.id} showToast={showToast} onRefresh={onRefresh} />
            </div>
          )}

          <div>
            <button
              disabled={launching}
              onClick={async () => {
                setLaunching(true);
                try {
                  const res = await fetch(`${API_BASE}/api/launch/${config.id}`, { method: "POST" });
                  if (res.ok) showToast(`${t("launch_success")}: ${config.name}`, "success");
                  else showToast(t("launch_error"), "error");
                } catch { showToast(t("launch_error"), "error"); }
                setLaunching(false);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              🚀 {launching ? "..." : t("launch")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function findMcpOverlaps(configs: CLIConfig[]) {
  const mcpMap = new Map<string, string[]>();
  for (const cfg of configs) {
    for (const s of cfg.mcpServers || []) {
      const existing = mcpMap.get(s.name) || [];
      existing.push(cfg.name);
      mcpMap.set(s.name, existing);
    }
  }
  return Array.from(mcpMap.entries())
    .filter(([, clis]) => clis.length > 1)
    .map(([name, clis]) => ({ name, clis }));
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ExportImportPanel({ configs, showToast, onRefresh }: { configs: CLIConfig[]; showToast: (msg: string, type: "success" | "error") => void; onRefresh: () => void }) {
  const { t } = useContext(I18nContext);

  async function handleExportAll() {
    const res = await fetch(`${API_BASE}/api/export`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aicli-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Snapshot exported", "success");
  }

  async function handleExportOne(cliId: string) {
    const res = await fetch(`${API_BASE}/api/export/${cliId}`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aicli-${cliId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${cliId} config exported`, "success");
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const snapshot = data.snapshot || (data.cliId ? { [data.cliId]: data.files } : null);
        if (!snapshot) { showToast("Invalid snapshot format", "error"); return; }
        const res = await fetch(`${API_BASE}/api/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot }),
        });
        if (res.ok) {
          showToast(t("import_success"), "success");
          onRefresh();
        } else {
          showToast("Import failed", "error");
        }
      } catch {
        showToast("Invalid JSON file", "error");
      }
    };
    input.click();
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">{t("export_all")}</h4>
        <button onClick={handleExportAll} className="w-full px-3 py-2 text-sm bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30 transition-colors">
          {t("download")} snapshot.json
        </button>
      </div>
      <div>
        <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">{t("export_single")}</h4>
        <div className="grid grid-cols-2 gap-2">
          {configs.filter((c) => c.exists).map((c) => (
            <button key={c.id} onClick={() => handleExportOne(c.id)} className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
              {CLI_ICONS[c.id]} {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-800 pt-4">
        <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">{t("import_snapshot")}</h4>
        <button onClick={handleImport} className="w-full px-3 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
          {t("import_select_file")}
        </button>
      </div>
    </div>
  );
}

interface MCPTemplate {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
}

function TemplatesPanel({ showToast, onRefresh }: { showToast: (msg: string, type: "success" | "error") => void; onRefresh: () => void }) {
  const { t } = useContext(I18nContext);
  const [templates, setTemplates] = useState<MCPTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/mcp/templates`).then((r) => r.json()).then(setTemplates).finally(() => setLoaded(true));
  }, []);

  async function handleInstall(templateId: string, cliId: string) {
    const res = await fetch(`${API_BASE}/api/mcp/templates/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, cliId }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Installed "${data.installed}" to ${cliId}`, "success");
      onRefresh();
    } else {
      showToast("Install failed", "error");
    }
  }

  if (!loaded) return <p className="text-xs text-gray-500 animate-pulse">Loading...</p>;

  return (
    <div className="space-y-3">
      {templates.map((tpl) => (
        <div key={tpl.id} className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-200">{tpl.name}</span>
              <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {(["claude", "gemini"] as const).map((cli) => (
                <button
                  key={cli}
                  onClick={() => handleInstall(tpl.id, cli)}
                  className="text-[10px] px-2 py-1 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
                  title={`${t("install_to")} ${cli}`}
                >
                  {CLI_ICONS[cli]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface HealthIssue {
  cliId: string;
  level: string;
  message: string;
}

function HealthPanel() {
  const { t } = useContext(I18nContext);
  const [issues, setIssues] = useState<HealthIssue[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);

  async function runCheck() {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/health-check`, { method: "POST" });
      const data = await res.json();
      setIssues(data.issues);
      setOk(data.ok);
    } catch {
      setOk(false);
      setIssues([{ cliId: "system", level: "error", message: "Health check failed" }]);
    }
    setRunning(false);
  }

  useEffect(() => { runCheck(); }, []);

  return (
    <div className="space-y-3">
      {running && <p className="text-xs text-gray-500 animate-pulse">{t("running_check")}</p>}
      {ok !== null && !running && (
        <>
          {ok && issues.length === 0 ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-400">
              {t("no_issues")}
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-xs ${
                    issue.level === "error"
                      ? "bg-red-500/10 border border-red-500/30 text-red-400"
                      : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  }`}
                >
                  <span className="font-mono font-medium">{issue.cliId}</span>
                  <span className="text-gray-500 mx-1.5">—</span>
                  {issue.message}
                </div>
              ))}
            </div>
          )}
          <button onClick={runCheck} className="text-xs text-violet-400 hover:text-violet-300">
            {t("refresh")}
          </button>
        </>
      )}
    </div>
  );
}

interface DiffItem { name: string; inA: boolean; inB: boolean; same: boolean }
interface DiffResult {
  a: { id: string; name: string; mcpCount: number; model?: string; authStatus: string };
  b: { id: string; name: string; mcpCount: number; model?: string; authStatus: string };
  mcpDiff: DiffItem[];
}

function DiffPanel({ configs }: { configs: CLIConfig[] }) {
  const { t } = useContext(I18nContext);
  const cliList = configs.filter((c) => c.exists);
  const [a, setA] = useState(cliList[0]?.id || "");
  const [b, setB] = useState(cliList[1]?.id || "");
  const [result, setResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runDiff() {
    if (!a || !b || a === b) return;
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/diff?a=${a}&b=${b}`);
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  useEffect(() => { if (a && b && a !== b) runDiff(); }, [a, b]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={a} onChange={(e) => setA(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 flex-1">
          {cliList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-gray-500 text-xs">vs</span>
        <select value={b} onChange={(e) => setB(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 flex-1">
          {cliList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading && <p className="text-xs text-gray-500 animate-pulse">Loading...</p>}

      {result && !loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[result.a, result.b].map((side) => (
              <div key={side.id} className="bg-gray-800/50 rounded-lg p-3">
                <div className="font-medium text-gray-200">{CLI_ICONS[side.id]} {side.name}</div>
                <div className="text-gray-500 mt-1">MCP: {side.mcpCount} | {t("model")}: {side.model || "—"} | {side.authStatus}</div>
              </div>
            ))}
          </div>

          <h4 className="text-xs font-medium text-gray-400 uppercase">{t("mcp_servers")} Diff</h4>
          <div className="space-y-1.5">
            {result.mcpDiff.length === 0 && <p className="text-xs text-gray-600 italic">No MCP servers to compare</p>}
            {result.mcpDiff.map((d) => (
              <div key={d.name} className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${
                d.same ? "bg-gray-800/30 text-gray-500" : d.inA && d.inB ? "bg-amber-500/10 text-amber-300" : "bg-violet-500/10 text-violet-300"
              }`}>
                <span className="font-mono">{d.name}</span>
                <span>
                  {d.same ? "identical" : d.inA && d.inB ? "different config" : d.inA ? `only in ${result.a.name}` : `only in ${result.b.name}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [configs, setConfigs] = useState<CLIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modal, setModal] = useState<"export" | "templates" | "health" | "diff" | null>(null);
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith("zh") ? "zh" : "en"));

  const t = useCallback((key: string) => translations[lang][key] || key, [lang]);

  const fetchConfigs = useCallback(async (retries = 0) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/configs`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setConfigs(await r.json());
      setError(null);
    } catch (e: any) {
      if (API_BASE && retries < 10) {
        await new Promise((r) => setTimeout(r, 800));
        setLoading(false);
        return fetchConfigs(retries + 1);
      }
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const detected = configs.filter((c) => c.exists).length;
  const totalMcp = configs.reduce((a, c) => a + (c.mcpServers?.length || 0), 0);
  const authed = configs.filter((c) => c.authStatus === "authenticated").length;
  const overlaps = findMcpOverlaps(configs);

  if (error && configs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
          <div className="text-red-400 text-lg font-semibold mb-2">Connection Error</div>
          <p className="text-gray-400 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-2">Make sure the server is running on port 3030</p>
        </div>
      </div>
    );
  }

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-6xl mx-auto">
      <header className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{t("title")}</h1>
            <p className="text-gray-500 mt-1">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === "en" ? "zh" : "en")} className="px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white text-xs transition-colors">
              {lang === "en" ? "中文" : "EN"}
            </button>
            <button
              onClick={() => fetchConfigs()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-violet-500/50 transition-colors text-sm"
            >
              <span className={loading ? "animate-spin" : ""}>↻</span>
              {t("refresh")}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal("export")} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-violet-500/50 transition-colors">
            {t("export")} / {t("import")}
          </button>
          <button onClick={() => setModal("templates")} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-violet-500/50 transition-colors">
            {t("templates")}
          </button>
          <button onClick={() => setModal("health")} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-violet-500/50 transition-colors">
            {t("health")}
          </button>
          <button onClick={() => setModal("diff")} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-violet-500/50 transition-colors">
            Diff
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: t("clis_detected"), value: detected, color: "text-violet-400" },
          { label: t("mcp_servers"), value: totalMcp, color: "text-blue-400" },
          { label: t("authenticated"), value: authed, color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {overlaps.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400">⚠</span>
            <span className="text-amber-300 font-medium text-sm">{t("mcp_overlap")}</span>
          </div>
          <div className="space-y-1">
            {overlaps.map((o) => (
              <p key={o.name} className="text-xs text-gray-400">
                <span className="text-amber-300 font-mono">{o.name}</span>
                {" is configured in "}
                {o.clis.join(" and ")}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((config) => (
          <CLICard key={config.id} config={config} allConfigs={configs} onRefresh={fetchConfigs} showToast={showToast} />
        ))}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <Modal open={modal === "export"} onClose={() => setModal(null)} title={`${t("export")} / ${t("import")}`}>
        <ExportImportPanel configs={configs} showToast={showToast} onRefresh={fetchConfigs} />
      </Modal>
      <Modal open={modal === "templates"} onClose={() => setModal(null)} title={t("templates")}>
        <TemplatesPanel showToast={showToast} onRefresh={fetchConfigs} />
      </Modal>
      <Modal open={modal === "health"} onClose={() => setModal(null)} title={t("health")}>
        <HealthPanel />
      </Modal>
      <Modal open={modal === "diff"} onClose={() => setModal(null)} title="Config Diff">
        <DiffPanel configs={configs} />
      </Modal>
    </div>
    </I18nContext.Provider>
  );
}
