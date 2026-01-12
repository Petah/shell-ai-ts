import { marked, Token, Tokens } from "marked";

const MAX_CONTEXT_TOKENS = 1500;

class ContextManager {
  private static instance: ContextManager;
  private tokenBuffer: string[] = [];
  private maxTokens = MAX_CONTEXT_TOKENS;

  private constructor() {}

  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  addChunk(chunk: string): void {
    this.flush();
    const chars = chunk.slice(-this.maxTokens).split("");
    this.tokenBuffer = chars;
  }

  flush(): void {
    this.tokenBuffer = [];
  }

  getCtx(): string {
    return this.tokenBuffer.join("");
  }
}

export const contextManager = ContextManager.getInstance();

export function extractCodeBlocks(markdown: string): string[] {
  const codeBlocks: string[] = [];
  const codeSpans: string[] = [];

  const tokens = marked.lexer(markdown);

  function walkTokens(tokens: Token[]): void {
    for (const token of tokens) {
      if (token.type === "code") {
        const codeToken = token as Tokens.Code;
        codeBlocks.push(codeToken.text);
      } else if (token.type === "codespan") {
        const codespanToken = token as Tokens.Codespan;
        codeSpans.push(codespanToken.text);
      }
      // Walk nested tokens if they exist
      if ("tokens" in token && Array.isArray(token.tokens)) {
        walkTokens(token.tokens);
      }
    }
  }

  walkTokens(tokens);

  if (codeBlocks.length > 0) {
    return codeBlocks;
  }
  if (codeSpans.length > 0) {
    return codeSpans;
  }
  return [markdown];
}

export function parseCommand(markdown: string): string | null {
  const blocks = extractCodeBlocks(markdown);
  const content = blocks.join("");

  // Try to parse as JSON first
  try {
    const jsonContent = content.trim();
    const parsed = JSON.parse(jsonContent);
    if (parsed.command) {
      return parsed.command;
    }
  } catch {
    // Not valid JSON, continue
  }

  // If the content looks like a shell command, return it directly
  const trimmed = content.trim();
  if (trimmed && !trimmed.includes("\n")) {
    return trimmed;
  }

  return null;
}
