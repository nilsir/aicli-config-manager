#!/usr/bin/env bun
import { join } from "path";

const serverPath = join(import.meta.dir, "..", "server", "index.ts");

const proc = Bun.spawn(["bun", "run", serverPath], {
  stdio: ["inherit", "inherit", "inherit"],
  env: { ...process.env, PORT: process.env.PORT || "3030" },
});

process.on("SIGINT", () => { proc.kill(); process.exit(0); });
process.on("SIGTERM", () => { proc.kill(); process.exit(0); });

await proc.exited;
