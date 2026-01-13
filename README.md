# Shell-AI (TypeScript)

A CLI utility that uses AI to suggest shell commands from natural language descriptions. TypeScript port using OpenRouter as the LLM provider.

Based on [shell-ai](https://github.com/ricklamers/shell-ai) by [Rick Lamers](https://github.com/ricklamers).

## Installation

```bash
# Run directly with npx (no install needed)
npx @petah/shell-ai list all files

# Or install globally
npm install -g @petah/shell-ai
```

### From Source

```bash
git clone https://github.com/petah/shell-ai.git
cd shell-ai
npm install
npm run build
npm link  # Makes 'shai' available globally
```

## Usage

```bash
# Basic usage
shai list all docker containers

# With context mode (keeps command outputs for better suggestions)
shai --ctx show me running processes
```

## Configuration

Shell-AI can be configured through environment variables or a config file.

### Config File

Create a config file at:
- **Linux/macOS**: `~/.config/shell-ai/config.json`
- **Windows**: `%APPDATA%\shell-ai\config.json`

```json
{
  "OPENROUTER_API_KEY": "your_openrouter_api_key",
  "OPENROUTER_MODEL": "anthropic/claude-3.5-sonnet",
  "SHAI_SUGGESTION_COUNT": 3,
  "SHAI_TEMPERATURE": 0.05,
  "CTX": false
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key (required) | - |
| `OPENROUTER_MODEL` | Model to use | `anthropic/claude-3.5-sonnet` |
| `SHAI_SUGGESTION_COUNT` | Number of suggestions | `3` |
| `SHAI_SKIP_CONFIRM` | Skip command confirmation | `false` |
| `SHAI_SKIP_HISTORY` | Skip writing to shell history | `false` |
| `SHAI_TEMPERATURE` | LLM temperature (0-1) | `0.05` |
| `CTX` | Enable context mode | `false` |
| `DEBUG` | Enable debug output | `false` |

## Available Models

OpenRouter supports many models. Some popular options:

- `anthropic/claude-3.5-sonnet` (default)
- `openai/gpt-4-turbo`
- `openai/gpt-3.5-turbo`
- `google/gemini-pro`
- `meta-llama/llama-3-70b-instruct`

See [OpenRouter Models](https://openrouter.ai/models) for the full list.

## Features

- Natural language to shell commands
- Dynamic command detection - automatically detects available commands on your system
- Interactive command selection
- Command confirmation before execution
- Shell history integration (zsh, bash, fish, etc.)
- Context mode for multi-step workflows
- Cross-platform support (Linux, macOS, Windows)

## License

MIT
