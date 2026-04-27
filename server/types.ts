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

export interface ModelTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

export interface TokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUSD: number;
  totalSessions: number;
  totalMessages: number;
  byModel: Record<string, ModelTokenUsage>;
  lastComputedDate?: string;
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
  tokenUsage?: TokenUsage;
}

export interface BackupInfo {
  path: string;
  timestamp: number;
  size: number;
}
