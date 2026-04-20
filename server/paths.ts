import { homedir, platform } from "os";
import { join } from "path";

const HOME = homedir();
const IS_WIN = platform() === "win32";

/**
 * XDG config dir: ~/.config on Unix, %APPDATA% on Windows
 */
function xdgConfig(): string {
  if (IS_WIN) {
    return process.env.APPDATA || join(HOME, "AppData", "Roaming");
  }
  return process.env.XDG_CONFIG_HOME || join(HOME, ".config");
}

/**
 * XDG data dir: ~/.local/share on Unix, %LOCALAPPDATA% on Windows
 */
function xdgData(): string {
  if (IS_WIN) {
    return process.env.LOCALAPPDATA || join(HOME, "AppData", "Local");
  }
  return process.env.XDG_DATA_HOME || join(HOME, ".local", "share");
}

export const paths = {
  claude: {
    settings: join(HOME, ".claude", "settings.json"),
  },
  opencode: {
    config: join(xdgConfig(), "opencode", "opencode.json"),
  },
  gemini: {
    settings: join(HOME, ".gemini", "settings.json"),
    oauth: join(HOME, ".gemini", "oauth_creds.json"),
  },
  codex: {
    config: join(HOME, ".codex", "config.toml"),
    auth: join(HOME, ".codex", "auth.json"),
  },
  copilot: {
    apps: join(xdgConfig(), "github-copilot", "apps.json"),
  },
};
