import * as https from "https";
import { Config, debugPrint } from "./config.js";
import { detectAvailableCommands } from "./commands.js";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export async function generateCompletion(
  config: Config,
  messages: Message[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: config.OPENROUTER_MODEL,
      messages,
      temperature: config.SHAI_TEMPERATURE,
    });

    debugPrint("Request payload:", data);

    const options = {
      hostname: "openrouter.ai",
      port: 443,
      path: "/api/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://github.com/shell-ai-ts",
        "X-Title": "Shell-AI TypeScript",
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          debugPrint("Response:", responseData);
          const response: OpenRouterResponse = JSON.parse(responseData);

          if (response.error) {
            reject(new Error(response.error.message));
            return;
          }

          if (response.choices && response.choices[0]?.message?.content) {
            resolve(response.choices[0].message.content);
          } else {
            reject(new Error("Invalid response format"));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

export async function generateSuggestions(
  config: Config,
  prompt: string,
  platformInfo: string,
  context?: string
): Promise<string[]> {
  const availableCommands = detectAvailableCommands();

  let systemMessage = `You are an expert at using shell commands. I need you to provide a response in the format \`{"command": "your_shell_command_here"}\`. ${platformInfo}

${availableCommands}

Pick the most appropriate command(s) from the list above or combine them with pipes and flags as needed. Only provide a single executable line of shell code as the value for the "command" key. Never output any text outside the JSON structure. The command will be directly executed in a shell. For example, if I ask to display the message abc, you should respond with \`\`\`json\n{"command": "echo abc"}\n\`\`\`. Make sure the output is valid JSON.`;

  if (context) {
    systemMessage += ` Between [], these are the last 1500 tokens from the previous command's output, you can use them as context: [${context}]`;
  }

  const messages: Message[] = [
    { role: "system", content: systemMessage },
    {
      role: "user",
      content: `Generate a shell command that satisfies this user request: ${prompt}`,
    },
  ];

  // Generate suggestions in parallel
  const promises: Promise<string | null>[] = [];
  for (let i = 0; i < config.SHAI_SUGGESTION_COUNT; i++) {
    promises.push(
      generateCompletion(config, messages)
        .then((response) => {
          const { parseCommand } = require("./codeParser.js");
          return parseCommand(response);
        })
        .catch((error) => {
          debugPrint("Error generating suggestion:", error);
          return null;
        })
    );
  }

  const results = await Promise.all(promises);

  // Filter out nulls and deduplicate
  const uniqueCommands = [...new Set(results.filter((cmd): cmd is string => cmd !== null))];

  return uniqueCommands;
}
