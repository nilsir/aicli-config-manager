import { readFile } from "fs/promises";
import type { CLIConfig, MCPServer } from "../types";
import { paths } from "../paths";

const CONFIG_PATH = paths.claude.settings;

export async function readClaudeConfig(): Promise<CLIConfig> {
  const base: CLIConfig = {
    id: "claude",
    name: "Claude Code",
    configPath: CONFIG_PATH,
    exists: false,
    authStatus: "unknown",
    authDetail: "Not configured",
    rawStats: {},
  };

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);
    base.exists = true;

    // MCP Servers
    if (data.mcpServers) {
      base.mcpServers = Object.entries(data.mcpServers).map(
        ([name, cfg]: [string, any]) => ({
          name,
          type: cfg.type || (cfg.url ? "http" : "stdio"),
          command: cfg.command,
          url: cfg.url,
          args: cfg.args,
          env: cfg.env,
          disabled: cfg.disabled || false,
        })
      );
    }

    // Auth
    const env = data.env || {};
    if (env.ANTHROPIC_BASE_URL || env.ANTHROPIC_AUTH_TOKEN) {
      base.authStatus = "authenticated";
      base.authDetail = env.ANTHROPIC_BASE_URL
        ? `API via proxy (${env.ANTHROPIC_BASE_URL})`
        : "API Key";
    } else {
      base.authStatus = "unauthenticated";
      base.authDetail = "No API key or proxy configured";
    }

    // Model
    if (data.model) {
      base.models = [{ id: data.model, name: data.model }];
    }
    if (env.ANTHROPIC_DEFAULT_SONNET_MODEL) {
      base.models = base.models || [];
      if (!base.models.find((m) => m.id === env.ANTHROPIC_DEFAULT_SONNET_MODEL)) {
        base.models.push({
          id: env.ANTHROPIC_DEFAULT_SONNET_MODEL,
          name: `Sonnet: ${env.ANTHROPIC_DEFAULT_SONNET_MODEL}`,
        });
      }
    }

    // Plugins
    if (data.enabledPlugins) {
      base.plugins = Object.entries(data.enabledPlugins)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
    }

    base.rawStats = {
      permissions: data.permissions,
      alwaysThinking: data.alwaysThinkingEnabled,
      allowedTools: data.allowedTools?.length || 0,
    };

    base.rawConfig = data;
  } catch {
    // file doesn't exist
  }

  return base;
}
