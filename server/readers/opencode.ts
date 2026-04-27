import { readFile } from "fs/promises";
import { Database } from "bun:sqlite";
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

  try {
    const db = new Database(paths.opencode.db, { readonly: true, create: false });
    const rows = db.query<{ data: string }, []>(
      `SELECT data FROM message 
       WHERE json_extract(data, '$.role') = 'assistant' 
       AND json_extract(data, '$.tokens.input') > 0`
    ).all();
    db.close();

    let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCost = 0;
    const byModel: Record<string, any> = {};

    for (const row of rows) {
      const msg = JSON.parse(row.data);
      const t = msg.tokens || {};
      const model = msg.modelID || "unknown";
      const inp = t.input || 0;
      const out = t.output || 0;
      const cr = t.cache?.read || 0;
      const cost = msg.cost || 0;

      totalInput += inp;
      totalOutput += out;
      totalCacheRead += cr;
      totalCost += cost;

      if (!byModel[model]) byModel[model] = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 };
      byModel[model].inputTokens += inp;
      byModel[model].outputTokens += out;
      byModel[model].cacheReadInputTokens += cr;
      byModel[model].costUSD += cost;
    }

    base.tokenUsage = {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCacheReadTokens: totalCacheRead,
      totalCacheCreationTokens: 0,
      totalCostUSD: totalCost,
      totalSessions: 0,
      totalMessages: rows.length,
      byModel,
    };
  } catch {
    // DB not available
  }

  return base;
}
