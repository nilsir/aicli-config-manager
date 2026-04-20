import { readFile, access } from "fs/promises";
import type { CLIConfig } from "../types";
import { paths } from "../paths";

const CONFIG_PATH = paths.gemini.settings;
const OAUTH_PATH = paths.gemini.oauth;

export async function readGeminiConfig(): Promise<CLIConfig> {
  const base: CLIConfig = {
    id: "gemini",
    name: "Gemini CLI",
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
          type: cfg.url || cfg.httpUrl ? "http" : "stdio",
          command: cfg.command,
          url: cfg.url || cfg.httpUrl,
          args: cfg.args,
          env: cfg.env,
          disabled: cfg.disabled || false,
        })
      );
    }

    // Auth
    const authType = data.security?.auth?.selectedType;
    let hasOauth = false;
    try {
      await access(OAUTH_PATH);
      hasOauth = true;
    } catch {}

    if (hasOauth) {
      base.authStatus = "authenticated";
      base.authDetail = `OAuth (${authType || "personal"})`;
    } else if (authType) {
      base.authStatus = "unauthenticated";
      base.authDetail = `Auth type: ${authType}, no credentials`;
    }

    base.rawStats = {
      theme: data.ui?.theme,
      sessionRetention: data.general?.sessionRetention?.enabled,
    };

    base.rawConfig = data;
  } catch {
    // file doesn't exist
  }

  return base;
}
