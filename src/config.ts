import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface Config {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
  SHAI_SUGGESTION_COUNT: number;
  SHAI_SKIP_CONFIRM: boolean;
  SHAI_SKIP_HISTORY: boolean;
  SHAI_TEMPERATURE: number;
  CTX: boolean;
  DEBUG: boolean;
}

const DEFAULT_CONFIG: Config = {
  OPENROUTER_API_KEY: "",
  OPENROUTER_MODEL: "anthropic/claude-3.5-sonnet",
  SHAI_SUGGESTION_COUNT: 3,
  SHAI_SKIP_CONFIRM: false,
  SHAI_SKIP_HISTORY: false,
  SHAI_TEMPERATURE: 0.05,
  CTX: false,
  DEBUG: false,
};

function getConfigPath(): string {
  const platform = os.platform();
  const configAppName = "shell-ai";

  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, configAppName, "config.json");
  } else {
    return path.join(os.homedir(), ".config", configAppName, "config.json");
  }
}

export function debugPrint(...args: unknown[]): void {
  if (process.env.DEBUG?.toLowerCase() === "true") {
    console.log(...args);
  }
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  debugPrint(`Looking for config file at: ${configPath}`);

  let fileConfig: Partial<Config> = {};

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      fileConfig = JSON.parse(content);
      debugPrint("Found and loaded config file successfully");
    } else {
      debugPrint("No config file found, using default configuration");
    }
  } catch (error) {
    debugPrint(`Error loading config: ${error}`);
  }

  // Merge file config with environment variables (env vars take precedence)
  const config: Config = {
    OPENROUTER_API_KEY:
      process.env.OPENROUTER_API_KEY ||
      fileConfig.OPENROUTER_API_KEY ||
      DEFAULT_CONFIG.OPENROUTER_API_KEY,
    OPENROUTER_MODEL:
      process.env.OPENROUTER_MODEL ||
      fileConfig.OPENROUTER_MODEL ||
      DEFAULT_CONFIG.OPENROUTER_MODEL,
    SHAI_SUGGESTION_COUNT:
      parseInt(process.env.SHAI_SUGGESTION_COUNT || "") ||
      fileConfig.SHAI_SUGGESTION_COUNT ||
      DEFAULT_CONFIG.SHAI_SUGGESTION_COUNT,
    SHAI_SKIP_CONFIRM:
      process.env.SHAI_SKIP_CONFIRM === "true" ||
      fileConfig.SHAI_SKIP_CONFIRM ||
      DEFAULT_CONFIG.SHAI_SKIP_CONFIRM,
    SHAI_SKIP_HISTORY:
      process.env.SHAI_SKIP_HISTORY === "true" ||
      fileConfig.SHAI_SKIP_HISTORY ||
      DEFAULT_CONFIG.SHAI_SKIP_HISTORY,
    SHAI_TEMPERATURE:
      parseFloat(process.env.SHAI_TEMPERATURE || "") ||
      fileConfig.SHAI_TEMPERATURE ||
      DEFAULT_CONFIG.SHAI_TEMPERATURE,
    CTX:
      process.env.CTX === "true" ||
      fileConfig.CTX ||
      DEFAULT_CONFIG.CTX,
    DEBUG:
      process.env.DEBUG?.toLowerCase() === "true" ||
      fileConfig.DEBUG ||
      DEFAULT_CONFIG.DEBUG,
  };

  return config;
}
