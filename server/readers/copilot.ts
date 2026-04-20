import { readFile } from "fs/promises";
import type { CLIConfig } from "../types";
import { paths } from "../paths";

const CONFIG_PATH = paths.copilot.apps;

function maskToken(token: string): string {
  if (!token || token.length < 12) return "***";
  return token.slice(0, 8) + "..." + token.slice(-4);
}

export async function readCopilotConfig(): Promise<CLIConfig> {
  const base: CLIConfig = {
    id: "copilot",
    name: "GitHub Copilot",
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

    const accounts = Object.entries(data).map(([host, info]: [string, any]) => ({
      host: host.split(":")[0],
      user: info.user,
      appId: info.githubAppId,
    }));

    if (accounts.length > 0) {
      base.authStatus = "authenticated";
      base.authDetail = `${accounts.length} account(s): ${accounts.map((a) => a.user).join(", ")}`;
    } else {
      base.authStatus = "unauthenticated";
      base.authDetail = "No accounts";
    }

    base.rawStats = {
      accounts: accounts.map((a) => ({ user: a.user, host: a.host })),
    };
  } catch {
    // file doesn't exist
  }

  return base;
}
