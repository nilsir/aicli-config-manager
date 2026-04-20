import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("API endpoints", () => {
  let serverProc: any;
  const PORT = 3099;
  const base = `http://localhost:${PORT}`;

  beforeAll(async () => {
    serverProc = Bun.spawn(["bun", "run", "server/index.ts"], {
      env: { ...process.env, PORT: String(PORT) },
      stdout: "pipe",
      stderr: "pipe",
    });
    await new Promise((r) => setTimeout(r, 2000));
  });

  afterAll(() => {
    serverProc?.kill();
  });

  test("GET /api/health returns ok", async () => {
    const res = await fetch(`${base}/api/health`);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  test("GET /api/configs returns 5 CLI configs", async () => {
    const res = await fetch(`${base}/api/configs`);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(5);

    const ids = data.map((c: any) => c.id).sort();
    expect(ids).toEqual(["claude", "codex", "copilot", "gemini", "opencode"]);

    for (const cfg of data) {
      expect(cfg).toHaveProperty("id");
      expect(cfg).toHaveProperty("configPath");
      expect(cfg).toHaveProperty("exists");
      expect(["authenticated", "unauthenticated", "unknown"]).toContain(cfg.authStatus);
    }
  });

  test("configs with MCP servers have proper shape", async () => {
    const res = await fetch(`${base}/api/configs`);
    const data = await res.json();
    for (const cfg of data) {
      if (cfg.mcpServers) {
        for (const mcp of cfg.mcpServers) {
          expect(mcp).toHaveProperty("name");
          expect(mcp).toHaveProperty("type");
          expect(typeof mcp.disabled).toBe("boolean");
        }
      }
    }
  });

  test("POST /api/mcp/check — existing command", async () => {
    const res = await fetch(`${base}/api/mcp/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stdio", command: "bun" }),
    });
    const data = await res.json();
    expect(data.reachable).toBe(true);
  });

  test("POST /api/mcp/check — missing command", async () => {
    const res = await fetch(`${base}/api/mcp/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stdio", command: "nonexistent-xyz-cmd" }),
    });
    const data = await res.json();
    expect(data.reachable).toBe(false);
  });

  test("GET /api/configs/claude/backups returns array", async () => {
    const res = await fetch(`${base}/api/configs/claude/backups`);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("unsupported CLI returns error for backups", async () => {
    const res = await fetch(`${base}/api/configs/copilot/backups`);
    expect(res.status).toBe(400);
  });

  test("GET /api/unknown returns 404", async () => {
    const res = await fetch(`${base}/api/unknown`);
    expect(res.status).toBe(404);
  });

  test("OPTIONS returns 204 CORS", async () => {
    const res = await fetch(`${base}/api/configs`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  test("GET /api/export returns full snapshot", async () => {
    const res = await fetch(`${base}/api/export`);
    const data = await res.json();
    expect(data).toHaveProperty("version", 1);
    expect(data).toHaveProperty("snapshot");
    expect(Object.keys(data.snapshot)).toContain("claude");
    expect(data).toHaveProperty("exportedAt");
  });

  test("GET /api/export/claude returns single CLI export", async () => {
    const res = await fetch(`${base}/api/export/claude`);
    const data = await res.json();
    expect(data.cliId).toBe("claude");
    expect(data).toHaveProperty("files");
  });

  test("GET /api/mcp/templates returns template list", async () => {
    const res = await fetch(`${base}/api/mcp/templates`);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("id");
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("config");
  });

  test("POST /api/health-check returns issues array", async () => {
    const res = await fetch(`${base}/api/health-check`, { method: "POST" });
    const data = await res.json();
    expect(data).toHaveProperty("ok");
    expect(Array.isArray(data.issues)).toBe(true);
  });

  test("GET /api/diff returns diff between two CLIs", async () => {
    const res = await fetch(`${base}/api/diff?a=claude&b=gemini`);
    const data = await res.json();
    expect(data.a).toHaveProperty("id", "claude");
    expect(data.b).toHaveProperty("id", "gemini");
    expect(Array.isArray(data.mcpDiff)).toBe(true);
  });

  test("GET /api/diff without params returns 400", async () => {
    const res = await fetch(`${base}/api/diff`);
    expect(res.status).toBe(400);
  });

  test("POST /api/launch with unknown CLI returns 400", async () => {
    const res = await fetch(`${base}/api/launch/unknown`, { method: "POST" });
    expect(res.status).toBe(400);
  });

  test("POST /api/launch/claude returns ok", async () => {
    const res = await fetch(`${base}/api/launch/claude`, { method: "POST" });
    const data = await res.json();
    expect(data).toHaveProperty("ok", true);
    expect(data).toHaveProperty("command", "claude");
  });
});
