import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { debugPrint } from "./config.js";

let cachedCommands: string | null = null;

function getCommandsFromCompgen(): string[] {
  try {
    // Use bash's compgen to list all available commands
    const result = execSync("bash -c 'compgen -c'", {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getCommandsFromPath(): string[] {
  const commands = new Set<string>();
  const pathDirs = (process.env.PATH || "").split(path.delimiter);

  for (const dir of pathDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        try {
          const fullPath = path.join(dir, file);
          const stats = fs.statSync(fullPath);
          // Check if executable
          if (stats.isFile() && (stats.mode & fs.constants.X_OK)) {
            commands.add(file);
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  return Array.from(commands);
}

function getShellBuiltins(): string[] {
  // Common shell builtins that won't appear in PATH
  return [
    "cd", "pwd", "echo", "printf", "export", "unset", "set", "source",
    "alias", "unalias", "bg", "fg", "jobs", "kill", "wait", "exec",
    "eval", "exit", "return", "break", "continue", "shift", "test",
    "true", "false", "read", "readonly", "local", "declare", "typeset",
    "trap", "umask", "ulimit", "times", "history", "fc", "pushd", "popd",
    "dirs", "shopt", "enable", "help", "logout", "mapfile", "readarray"
  ];
}

export function detectAvailableCommands(): string {
  if (cachedCommands !== null) {
    return cachedCommands;
  }

  debugPrint("Detecting available commands...");
  const startTime = Date.now();

  let commands: string[] = [];

  // Try compgen first (fastest and most complete on bash)
  commands = getCommandsFromCompgen();

  // Fall back to PATH scanning if compgen failed
  if (commands.length === 0) {
    debugPrint("compgen failed, scanning PATH...");
    commands = getCommandsFromPath();
  }

  // Add shell builtins
  const builtins = getShellBuiltins();
  const allCommands = new Set([...commands, ...builtins]);

  // Filter out internal/hidden commands and sort
  const filtered = Array.from(allCommands)
    .filter(cmd => {
      // Skip empty, hidden, or internal commands
      if (!cmd || cmd.startsWith("_") || cmd.startsWith(".")) return false;
      // Skip very short commands that are likely not useful
      if (cmd.length < 2) return false;
      return true;
    })
    .sort();

  debugPrint(`Found ${filtered.length} commands in ${Date.now() - startTime}ms`);

  cachedCommands = `Available commands on this system (${filtered.length} total):\n${filtered.join(", ")}`;

  return cachedCommands;
}
