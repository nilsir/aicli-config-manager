import { readFile } from "fs/promises";
import { parse as parseToml } from "smol-toml";
import type { CLIConfig } from "../types";
import { paths } from "../paths";

const CONFIG_PATH = paths.codex.config;
const AUTH_PATH = paths.codex.auth;

export async function readCodexConfig(): Promise<CLIConfig> {
  const base: CLIConfig = {
    id: "codex",
    name: "OpenAI Codex CLI",
    configPath: CONFIG_PATH,
    exists: false,
    authStatus: "unknown",
    authDetail: "Not configured",
    rawStats: {},
  };

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const data = parseToml(raw);
    base.exists = true;

    // Count trusted projects
    const projects = data.projects as Record<string, any> | undefined;
    const trustedCount = projects ? Object.keys(projects).length : 0;

    base.rawStats = { trustedProjects: trustedCount };
  } catch {
    // file doesn't exist
  }

  // Auth
  try {
    const authRaw = await readFile(AUTH_PATH, "utf-8");
    const auth = JSON.parse(authRaw);

    if (auth.auth_mode === "chatgpt" && auth.tokens?.access_token) {
      // Check expiry from JWT
      let expired = false;
      try {
        const payload = JSON.parse(
          Buffer.from(auth.tokens.access_token.split(".")[1], "base64").toString()
        );
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          expired = true;
        }
      } catch {}

      base.authStatus = expired ? "unauthenticated" : "authenticated";
      base.authDetail = `ChatGPT OAuth${expired ? " (expired)" : ""}`;
    } else if (auth.OPENAI_API_KEY) {
      base.authStatus = "authenticated";
      base.authDetail = "API Key";
    } else {
      base.authStatus = "unauthenticated";
      base.authDetail = `Mode: ${auth.auth_mode || "unknown"}`;
    }

    base.rawStats = {
      ...base.rawStats,
      authMode: auth.auth_mode,
      lastRefresh: auth.last_refresh,
    };
  } catch {
    // no auth file
  }

  return base;
}
