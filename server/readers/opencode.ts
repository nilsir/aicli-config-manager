import { readFile } from "fs/promises";
import type { CLIConfig } from "../types";
import { paths } from "../paths";

const CONFIG_PATH = paths.opencode.config;

export async function readOpenCodeConfig(): Promise<CLIConfig> {
  const base: CLIConfig = {
    id: "opencode",
    name: "OpenCode",
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

    // Model
    if (data.model) {
      base.models = [{ id: data.model, name: data.model }];
    }
    if (data.small_model) {
      base.models = base.models || [];
      base.models.push({ id: data.small_model, name: `Small: ${data.small_model}` });
    }

    // Auth - if model is set with a provider, consider authenticated
    if (data.model && data.provider) {
      base.authStatus = "authenticated";
      const providers = Object.keys(data.provider).join(", ");
      base.authDetail = `Providers: ${providers}`;
    } else if (data.model) {
      base.authStatus = "authenticated";
      base.authDetail = `Model: ${data.model}`;
    }

    // Plugins
    if (data.plugin) {
      base.plugins = data.plugin;
    }

    // Agents
    const agents = data.agent ? Object.keys(data.agent) : [];

    base.rawStats = {
      agents,
      providerCount: data.provider ? Object.keys(data.provider).length : 0,
      customModels: data.provider
        ? Object.values(data.provider).reduce(
            (acc: number, p: any) =>
              acc + (p.models ? Object.keys(p.models).length : 0),
            0
          )
        : 0,
    };
  } catch {
    // file doesn't exist
  }

  return base;
}
