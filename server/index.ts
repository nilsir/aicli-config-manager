import { readClaudeConfig } from "./readers/claude";
import { readOpenCodeConfig } from "./readers/opencode";
import { readGeminiConfig } from "./readers/gemini";
import { readCodexConfig } from "./readers/codex";
import { readCopilotConfig } from "./readers/copilot";
import { paths } from "./paths";
import type { BackupInfo } from "./types";
import { join, dirname } from "path";
import { readFile, writeFile, readdir, stat, copyFile } from "fs/promises";

const PORT = Number(process.env.PORT) || 3030;
const WEB_DIST = join(import.meta.dir, "..", "web", "dist");

async function getAllConfigs() {
  return Promise.all([
    readClaudeConfig(),
    readOpenCodeConfig(),
    readGeminiConfig(),
    readCodexConfig(),
    readCopilotConfig(),
  ]);
}

function configPathById(cliId: string): string | null {
  const map: Record<string, string> = {
    claude: paths.claude.settings,
    gemini: paths.gemini.settings,
  };
  return map[cliId] || null;
}

function allConfigFiles(): Record<string, string[]> {
  return {
    claude: [paths.claude.settings],
    opencode: [paths.opencode.config],
    gemini: [paths.gemini.settings, paths.gemini.oauth],
    codex: [paths.codex.config, paths.codex.auth],
    copilot: [paths.copilot.apps],
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

async function createBackup(filePath: string): Promise<string> {
  const ts = Date.now();
  const backupPath = `${filePath}.${ts}.bak`;
  await copyFile(filePath, backupPath);
  return backupPath;
}

async function listBackups(filePath: string): Promise<BackupInfo[]> {
  const dir = dirname(filePath);
  const base = filePath.split("/").pop() || "";
  const files = await readdir(dir).catch(() => [] as string[]);
  const backups: BackupInfo[] = [];

  for (const f of files) {
    const match = f.match(new RegExp(`^${escapeRegex(base)}\\.(\\d+)\\.bak$`));
    if (match) {
      const fullPath = join(dir, f);
      const s = await stat(fullPath).catch(() => null);
      if (s) {
        backups.push({ path: fullPath, timestamp: Number(match[1]), size: s.size });
      }
    }
  }

  return backups.sort((a, b) => b.timestamp - a.timestamp);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MCP_TEMPLATES = [
  {
    id: "context7",
    name: "context7",
    description: "Library documentation lookup via Context7",
    config: { command: "npx", args: ["-y", "@upstash/context7-mcp@latest"] },
  },
  {
    id: "filesystem",
    name: "filesystem",
    description: "Local filesystem access (read/write/search)",
    config: { command: "npx", args: ["-y", "@anthropic/mcp-filesystem"] },
  },
  {
    id: "github",
    name: "github",
    description: "GitHub API (repos, issues, PRs)",
    config: { command: "npx", args: ["-y", "@anthropic/mcp-github"], env: { GITHUB_TOKEN: "" } },
  },
  {
    id: "postgres",
    name: "postgres",
    description: "PostgreSQL database access",
    config: { command: "npx", args: ["-y", "@anthropic/mcp-postgres"], env: { DATABASE_URL: "" } },
  },
  {
    id: "sqlite",
    name: "sqlite",
    description: "SQLite database access",
    config: { command: "npx", args: ["-y", "@anthropic/mcp-sqlite"] },
  },
  {
    id: "brave-search",
    name: "brave-search",
    description: "Web search via Brave Search API",
    config: { command: "npx", args: ["-y", "@anthropic/mcp-brave-search"], env: { BRAVE_API_KEY: "" } },
  },
  {
    id: "fetch",
    name: "fetch",
    description: "HTTP fetch / web scraping",
    config: { command: "npx", args: ["-y", "@anthropic/mcp-fetch"] },
  },
  {
    id: "deepwiki",
    name: "deepwiki",
    description: "DeepWiki — AI-powered repo documentation",
    config: { command: "npx", args: ["-y", "@anthropic/mcp-deepwiki"] },
  },
];

async function handleApi(req: Request, url: URL): Promise<Response> {
  const method = req.method;
  const path = url.pathname;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // GET /api/health
  if (path === "/api/health" && method === "GET") {
    return json({ ok: true });
  }

  // GET /api/configs
  if (path === "/api/configs" && method === "GET") {
    return json(await getAllConfigs());
  }

  // POST /api/configs/:cliId/mcp/:mcpName/toggle
  const toggleMatch = path.match(/^\/api\/configs\/(\w+)\/mcp\/([^/]+)\/toggle$/);
  if (toggleMatch && method === "POST") {
    const [, cliId, mcpName] = toggleMatch;
    const configPath = configPathById(cliId);
    if (!configPath) return err(`CLI '${cliId}' does not support MCP editing`);

    try {
      const raw = await readFile(configPath, "utf-8");
      const data = JSON.parse(raw);
      if (!data.mcpServers?.[mcpName]) return err(`MCP server '${mcpName}' not found`);

      await createBackup(configPath);

      const current = data.mcpServers[mcpName].disabled || false;
      data.mcpServers[mcpName].disabled = !current;
      await writeFile(configPath, JSON.stringify(data, null, 2) + "\n");

      return json({ ok: true, disabled: !current });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // POST /api/configs/:cliId/mcp/:mcpName/delete
  const deleteMatch = path.match(/^\/api\/configs\/(\w+)\/mcp\/([^/]+)\/delete$/);
  if (deleteMatch && method === "POST") {
    const [, cliId, mcpName] = deleteMatch;
    const configPath = configPathById(cliId);
    if (!configPath) return err(`CLI '${cliId}' does not support MCP editing`);

    try {
      const raw = await readFile(configPath, "utf-8");
      const data = JSON.parse(raw);
      if (!data.mcpServers?.[mcpName]) return err(`MCP server '${mcpName}' not found`);

      await createBackup(configPath);
      delete data.mcpServers[mcpName];
      await writeFile(configPath, JSON.stringify(data, null, 2) + "\n");

      return json({ ok: true });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // POST /api/configs/:cliId/mcp  — add/copy MCP server
  const addMcpMatch = path.match(/^\/api\/configs\/(\w+)\/mcp$/);
  if (addMcpMatch && method === "POST") {
    const [, cliId] = addMcpMatch;
    const configPath = configPathById(cliId);
    if (!configPath) return err(`CLI '${cliId}' does not support MCP editing`);

    try {
      const body = await req.json();
      const { name, config: mcpConfig } = body;
      if (!name || !mcpConfig) return err("Missing 'name' and 'config' in body");

      const raw = await readFile(configPath, "utf-8");
      const data = JSON.parse(raw);
      data.mcpServers = data.mcpServers || {};

      await createBackup(configPath);
      data.mcpServers[name] = mcpConfig;
      await writeFile(configPath, JSON.stringify(data, null, 2) + "\n");

      return json({ ok: true });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // POST /api/configs/:cliId/model — set model
  const modelMatch = path.match(/^\/api\/configs\/(\w+)\/model$/);
  if (modelMatch && method === "POST") {
    const [, cliId] = modelMatch;
    if (cliId !== "claude") return err(`CLI '${cliId}' does not support model switching`);
    const configPath = configPathById(cliId);
    if (!configPath) return err("Config path not found");

    try {
      const { model } = await req.json();
      if (!model) return err("Missing 'model' in body");

      const raw = await readFile(configPath, "utf-8");
      const data = JSON.parse(raw);

      await createBackup(configPath);
      data.model = model;
      await writeFile(configPath, JSON.stringify(data, null, 2) + "\n");

      return json({ ok: true, model });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // GET /api/configs/:cliId/backups
  const backupsMatch = path.match(/^\/api\/configs\/(\w+)\/backups$/);
  if (backupsMatch && method === "GET") {
    const [, cliId] = backupsMatch;
    const configPath = configPathById(cliId);
    if (!configPath) return err(`CLI '${cliId}' does not support backups`);

    return json(await listBackups(configPath));
  }

  // POST /api/configs/:cliId/restore
  const restoreMatch = path.match(/^\/api\/configs\/(\w+)\/restore$/);
  if (restoreMatch && method === "POST") {
    const [, cliId] = restoreMatch;
    const configPath = configPathById(cliId);
    if (!configPath) return err(`CLI '${cliId}' does not support restore`);

    try {
      const { timestamp } = await req.json();
      if (!timestamp) return err("Missing 'timestamp' in body");

      const backupPath = `${configPath}.${timestamp}.bak`;
      const backupData = await readFile(backupPath, "utf-8");

      await createBackup(configPath);
      await writeFile(configPath, backupData);

      return json({ ok: true });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // POST /api/mcp/check — connectivity check
  if (path === "/api/mcp/check" && method === "POST") {
    const { type, command, url: mcpUrl } = await req.json();

    if (type === "stdio" && command) {
      try {
        const which = Bun.spawnSync(["which", command]);
        const found = which.exitCode === 0;
        return json({ reachable: found, detail: found ? "Command found in PATH" : "Command not found" });
      } catch {
        return json({ reachable: false, detail: "Check failed" });
      }
    }

    if ((type === "http" || type === "sse") && mcpUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(mcpUrl, { signal: controller.signal, method: "HEAD" }).catch(() => null);
        clearTimeout(timeout);
        return json({
          reachable: resp !== null && resp.status < 500,
          detail: resp ? `HTTP ${resp.status}` : "Connection failed",
        });
      } catch {
        return json({ reachable: false, detail: "Timeout or unreachable" });
      }
    }

    return json({ reachable: false, detail: "Unknown type" });
  }

  // GET /api/export/:cliId — export single CLI config files
  const exportOneMatch = path.match(/^\/api\/export\/(\w+)$/);
  if (exportOneMatch && method === "GET") {
    const [, cliId] = exportOneMatch;
    const fileMap = allConfigFiles();
    const filePaths = fileMap[cliId];
    if (!filePaths) return err(`Unknown CLI '${cliId}'`);

    const result: Record<string, string | null> = {};
    for (const fp of filePaths) {
      const content = await readFile(fp, "utf-8").catch(() => null);
      result[fp] = content;
    }
    return json({ cliId, files: result, exportedAt: Date.now() });
  }

  // GET /api/export — export all CLI configs as snapshot
  if (path === "/api/export" && method === "GET") {
    const fileMap = allConfigFiles();
    const snapshot: Record<string, Record<string, string | null>> = {};
    for (const [cliId, filePaths] of Object.entries(fileMap)) {
      snapshot[cliId] = {};
      for (const fp of filePaths) {
        const content = await readFile(fp, "utf-8").catch(() => null);
        snapshot[cliId][fp] = content;
      }
    }
    return json({ version: 1, snapshot, exportedAt: Date.now() });
  }

  // POST /api/import — import snapshot (selective by CLI)
  if (path === "/api/import" && method === "POST") {
    try {
      const body = await req.json();
      const { snapshot, cliIds } = body;
      if (!snapshot) return err("Missing 'snapshot' in body");

      const targetIds = cliIds || Object.keys(snapshot);
      const results: Record<string, string> = {};

      for (const cliId of targetIds) {
        const files = snapshot[cliId];
        if (!files) { results[cliId] = "skipped (not in snapshot)"; continue; }

        for (const [filePath, content] of Object.entries(files)) {
          if (content === null) continue;
          try {
            await createBackup(filePath).catch(() => {});
            await writeFile(filePath, content as string);
            results[cliId] = "restored";
          } catch (e: any) {
            results[cliId] = `error: ${e.message}`;
          }
        }
      }
      return json({ ok: true, results });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // GET /api/mcp/templates — built-in MCP templates
  if (path === "/api/mcp/templates" && method === "GET") {
    return json(MCP_TEMPLATES);
  }

  // POST /api/mcp/templates/install — install a template to a CLI
  if (path === "/api/mcp/templates/install" && method === "POST") {
    try {
      const { templateId, cliId } = await req.json();
      const template = MCP_TEMPLATES.find((t: any) => t.id === templateId);
      if (!template) return err(`Template '${templateId}' not found`);
      const configPath = configPathById(cliId);
      if (!configPath) return err(`CLI '${cliId}' does not support MCP editing`);

      const raw = await readFile(configPath, "utf-8");
      const data = JSON.parse(raw);
      data.mcpServers = data.mcpServers || {};

      await createBackup(configPath);
      data.mcpServers[template.name] = { ...template.config };
      await writeFile(configPath, JSON.stringify(data, null, 2) + "\n");

      return json({ ok: true, installed: template.name });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // POST /api/health-check — deep config health check
  if (path === "/api/health-check" && method === "POST") {
    const configs = await getAllConfigs();
    const issues: { cliId: string; level: string; message: string }[] = [];

    for (const cfg of configs) {
      if (!cfg.exists) continue;

      if (cfg.authStatus === "unauthenticated") {
        issues.push({ cliId: cfg.id, level: "warning", message: `Authentication: ${cfg.authDetail}` });
      }

      if (cfg.mcpServers) {
        for (const mcp of cfg.mcpServers) {
          if (mcp.type === "stdio" && mcp.command) {
            const which = Bun.spawnSync(["which", mcp.command]);
            if (which.exitCode !== 0) {
              issues.push({ cliId: cfg.id, level: "error", message: `MCP "${mcp.name}": command "${mcp.command}" not found in PATH` });
            }
          }
          if (mcp.env) {
            for (const [key, val] of Object.entries(mcp.env)) {
              if (val.startsWith("${") || val === "") {
                issues.push({ cliId: cfg.id, level: "warning", message: `MCP "${mcp.name}": env var ${key} may be unset` });
              }
            }
          }
        }
      }
    }

    // Codex token expiry
    try {
      const authRaw = await readFile(paths.codex.auth, "utf-8");
      const auth = JSON.parse(authRaw);
      if (auth.tokens?.access_token) {
        const payload = JSON.parse(Buffer.from(auth.tokens.access_token.split(".")[1], "base64").toString());
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          issues.push({ cliId: "codex", level: "error", message: "OAuth token expired" });
        }
      }
    } catch {}

    return json({ ok: issues.filter((i) => i.level === "error").length === 0, issues });
  }

  // GET /api/diff?a=claude&b=gemini — compare MCP servers between two CLIs
  if (path === "/api/diff" && method === "GET") {
    const a = url.searchParams.get("a");
    const b = url.searchParams.get("b");
    if (!a || !b) return err("Missing query params 'a' and 'b'");

    const configs = await getAllConfigs();
    const cfgA = configs.find((c) => c.id === a);
    const cfgB = configs.find((c) => c.id === b);
    if (!cfgA || !cfgB) return err("CLI not found");

    const mcpA = new Map((cfgA.mcpServers || []).map((s) => [s.name, s]));
    const mcpB = new Map((cfgB.mcpServers || []).map((s) => [s.name, s]));
    const allNames = new Set([...mcpA.keys(), ...mcpB.keys()]);

    const diff: { name: string; inA: boolean; inB: boolean; same: boolean }[] = [];
    for (const name of allNames) {
      const inA = mcpA.has(name);
      const inB = mcpB.has(name);
      const same = inA && inB && JSON.stringify(mcpA.get(name)) === JSON.stringify(mcpB.get(name));
      diff.push({ name, inA, inB, same });
    }

    return json({
      a: { id: cfgA.id, name: cfgA.name, mcpCount: cfgA.mcpServers?.length || 0, model: cfgA.models?.[0]?.id, authStatus: cfgA.authStatus },
      b: { id: cfgB.id, name: cfgB.name, mcpCount: cfgB.mcpServers?.length || 0, model: cfgB.models?.[0]?.id, authStatus: cfgB.authStatus },
      mcpDiff: diff,
    });
  }

  if (path === "/api/open-in-editor" && method === "POST") {
    const body = await req.json().catch(() => null);
    const filePath = body?.path;
    if (!filePath || typeof filePath !== "string") return err("Missing 'path'");
    try {
      Bun.spawn(["code", filePath], { stdout: "ignore", stderr: "ignore" });
      return json({ ok: true });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  // POST /api/launch/:cliId — open terminal with CLI command
  const launchMatch = path.match(/^\/api\/launch\/(\w+)$/);
  if (launchMatch && method === "POST") {
    const [, cliId] = launchMatch;
    const commands: Record<string, string[]> = {
      claude: ["claude"],
      opencode: ["opencode"],
      gemini: ["gemini"],
      codex: ["codex"],
      copilot: ["gh", "copilot"],
    };
    const cmd = commands[cliId];
    if (!cmd) return err(`Unknown CLI '${cliId}'`);

    try {
      const isMac = process.platform === "darwin";
      if (isMac) {
        Bun.spawn(["open", "-a", "Terminal", "--args", ...cmd], { stdout: "ignore", stderr: "ignore" });
      } else {
        Bun.spawn(["sh", "-c", `${cmd.join(" ")} &`], { stdout: "ignore", stderr: "ignore" });
      }
      return json({ ok: true, command: cmd.join(" ") });
    } catch (e: any) {
      return err(e.message, 500);
    }
  }

  return json({ error: "Not found" }, 404);
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      return handleApi(req, url);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(WEB_DIST, filePath));

    if (await file.exists()) {
      return new Response(file);
    }

    const indexFile = Bun.file(join(WEB_DIST, "index.html"));
    if (await indexFile.exists()) {
      return new Response(indexFile);
    }

    return new Response("Not found - run 'bun run build' first", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
