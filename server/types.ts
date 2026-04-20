export interface MCPServer {
  name: string;
  type: string;
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface CLIConfig {
  id: string;
  name: string;
  version?: string;
  configPath: string;
  exists: boolean;
  authStatus: "authenticated" | "unauthenticated" | "unknown";
  authDetail: string;
  mcpServers?: MCPServer[];
  models?: ModelInfo[];
  plugins?: string[];
  rawStats: Record<string, unknown>;
  rawConfig?: Record<string, unknown>;
}

export interface BackupInfo {
  path: string;
  timestamp: number;
  size: number;
}
