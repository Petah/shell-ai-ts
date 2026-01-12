#!/usr/bin/env node

import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { execSync, spawnSync } from "child_process";
import { select, input } from "@inquirer/prompts";
import { loadConfig, debugPrint, Config } from "./config.js";
import { generateSuggestions } from "./openrouter.js";
import { contextManager } from "./codeParser.js";

const Colors = {
  WARNING: "\x1b[93m",
  END: "\x1b[0m",
};

const TEXT_EDITORS = ["vi", "vim", "emacs", "nano", "ed", "micro", "joe", "nvim"];

enum SystemOptions {
  GEN_SUGGESTIONS = "Generate new suggestions",
  DISMISS = "Dismiss",
  NEW_COMMAND = "Enter a new command",
}

function getPlatformInfo(): string {
  const platform = os.platform();
  const release = os.release();

  if (platform === "linux") {
    try {
      const osRelease = fs.readFileSync("/etc/os-release", "utf-8");
      const idMatch = osRelease.match(/^ID=(.*)$/m);
      const versionMatch = osRelease.match(/^VERSION_ID=(.*)$/m);
      const id = idMatch ? idMatch[1].replace(/"/g, "") : "unknown";
      const version = versionMatch ? versionMatch[1].replace(/"/g, "") : "unknown";
      return `The system the shell command will be executed on is ${platform} ${release}, running ${id} version ${version}.`;
    } catch {
      return `The system the shell command will be executed on is ${platform} ${release}.`;
    }
  }

  return `The system the shell command will be executed on is ${platform} ${release}.`;
}

function writeToHistory(command: string): void {
  const shell = process.env.SHELL || "";
  let historyFilePath: string | null = null;
  let historyFormat: ((timestamp: number, cmd: string) => string) | null = null;

  if (shell.includes("zsh")) {
    historyFilePath = path.join(os.homedir(), ".zsh_history");
    historyFormat = (ts, cmd) => `: ${ts}:0;${cmd}\n`;
  } else if (shell.includes("bash")) {
    historyFilePath = path.join(os.homedir(), ".bash_history");
    historyFormat = (ts, cmd) => `: ${ts}:0;${cmd}\n`;
  } else if (shell.includes("csh") || shell.includes("tcsh")) {
    historyFilePath = path.join(os.homedir(), ".history");
    historyFormat = (ts, cmd) => `${ts} ${cmd}\n`;
  } else if (shell.includes("ksh")) {
    historyFilePath = path.join(os.homedir(), ".sh_history");
    historyFormat = (ts, cmd) => `: ${ts}:0;${cmd}\n`;
  } else if (shell.includes("fish")) {
    historyFilePath = path.join(os.homedir(), ".local", "share", "fish", "fish_history");
    historyFormat = (ts, cmd) => `- cmd: ${cmd}\n  when: ${ts}\n`;
  }

  if (historyFilePath && historyFormat) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      fs.appendFileSync(historyFilePath, historyFormat(timestamp, command));
    } catch (error) {
      console.log(
        `${Colors.WARNING}Warning:${Colors.END} Could not write to shell history.`
      );
    }
  } else {
    console.log(
      `${Colors.WARNING}Warning:${Colors.END} Unsupported shell. History will not be saved. Set SHAI_SKIP_HISTORY=true to disable this warning.`
    );
  }
}

function executeCommand(command: string, ctxMode: boolean): string | null {
  if (TEXT_EDITORS.some((editor) => command.startsWith(editor))) {
    spawnSync(command, { shell: true, stdio: "inherit" });
    return null;
  }

  if (command.startsWith("cd ")) {
    const targetPath = command.slice(3).trim();
    const expandedPath = targetPath.replace(/^~/, os.homedir());
    try {
      process.chdir(expandedPath);
    } catch (error) {
      console.log(`${Colors.WARNING}Error:${Colors.END} Could not change directory.`);
    }
    return null;
  }

  if (ctxMode) {
    try {
      const result = execSync(command, { encoding: "utf-8" });
      if (result.length > 0) {
        console.log(`\n${result}`);
      }
      return result;
    } catch (error) {
      const err = error as { stderr?: string; message: string };
      console.log(`${Colors.WARNING}Error${Colors.END} executing command: ${err.message}`);
      return err.stderr || "";
    }
  } else {
    try {
      spawnSync(command, { shell: true, stdio: "inherit" });
    } catch (error) {
      const err = error as { message: string };
      console.log(`${Colors.WARNING}Error${Colors.END} executing command: ${err.message}`);
    }
    return null;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();

  debugPrint("Loaded configuration:", config);

  if (!config.OPENROUTER_API_KEY) {
    console.log(
      "Please set the OPENROUTER_API_KEY environment variable or add it to your config file."
    );
    console.log(
      "You can create a config file at ~/.config/shell-ai/config.json"
    );
    console.log("\nExample config:");
    console.log(
      JSON.stringify(
        {
          OPENROUTER_API_KEY: "your_api_key_here",
          OPENROUTER_MODEL: "anthropic/claude-3.5-sonnet",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  let ctxMode = config.CTX;
  let prompt = "";

  if (args.includes("--ctx")) {
    ctxMode = true;
    const ctxIndex = args.indexOf("--ctx");
    args.splice(ctxIndex, 1);
  }

  prompt = args.join(" ");

  if (!prompt) {
    console.log("Describe what you want to do as a single sentence. `shai <sentence>`");
    process.exit(0);
  }

  const platformInfo = getPlatformInfo();

  if (ctxMode) {
    console.log(
      `${Colors.WARNING}WARNING${Colors.END} Context mode: data will be sent to OpenRouter, be careful with sensitive data...\n`
    );
    console.log(`>>> ${process.cwd()}`);
  }

  while (true) {
    const context = ctxMode ? contextManager.getCtx() : undefined;
    const suggestions = await generateSuggestions(config, prompt, platformInfo, context);

    if (suggestions.length === 0) {
      console.log("No suggestions could be generated. Please try again with a different prompt.");
      process.exit(1);
    }

    const choices = [
      ...suggestions.map((cmd) => ({ name: cmd, value: cmd })),
      { name: SystemOptions.GEN_SUGGESTIONS, value: SystemOptions.GEN_SUGGESTIONS },
      { name: SystemOptions.NEW_COMMAND, value: SystemOptions.NEW_COMMAND },
      { name: SystemOptions.DISMISS, value: SystemOptions.DISMISS },
    ];

    try {
      const selection = await select({
        message: "Select a command:",
        choices,
      });

      if (selection === SystemOptions.DISMISS) {
        process.exit(0);
      }

      if (selection === SystemOptions.NEW_COMMAND) {
        prompt = await input({ message: "New command:" });
        continue;
      }

      if (selection === SystemOptions.GEN_SUGGESTIONS) {
        continue;
      }

      // A command was selected
      let userCommand = selection;

      if (!config.SHAI_SKIP_CONFIRM) {
        userCommand = await input({
          message: "Confirm:",
          default: selection,
        });
      }

      // Write to shell history
      if (!config.SHAI_SKIP_HISTORY) {
        writeToHistory(userCommand);
      }

      // Execute the command
      const result = executeCommand(userCommand, ctxMode);

      if (!ctxMode) {
        break;
      }

      // In context mode, store the output and continue
      if (result) {
        contextManager.addChunk(result);
      }

      prompt = await input({ message: `>>> ${process.cwd()}\nNew command:` });
    } catch (error) {
      // Handle Ctrl+C gracefully
      if ((error as { name?: string }).name === "ExitPromptError") {
        console.log("\nExiting...");
        process.exit(0);
      }
      throw error;
    }
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
