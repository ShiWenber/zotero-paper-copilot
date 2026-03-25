# Zotero Paper Copilot

[English](README.md) | [简体中文](doc/README-zhCN.md)

[![Zotero Version](https://img.shields.io/badge/Zotero-7+-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/ShiWenber/zotero-paper-copilot?style=flat-square)](https://github.com/ShiWenber/zotero-paper-copilot/releases)
[![GitHub Stars](https://img.shields.io/github/stars/ShiWenber/zotero-paper-copilot?style=flat-square)](https://github.com/ShiWenber/zotero-paper-copilot/stargazers)

> 🤖 AI Assistant for Research Papers - Supercharge your literature review workflow with AI-powered features

Paper Copilot is a Zotero 7+ plugin that brings powerful AI capabilities to your PDF reading experience. Built with a modern **Agent Runtime** architecture, it supports tool calling, streaming responses, and extensible actions.

![Paper Copilot Demo](doc/images/demo.png)

## ✨ Features

### 🏗️ Agent Runtime Architecture

The plugin is built on a modular Agent Runtime system:

```
┌─────────────────────────────────────────────────────────────┐
│                     Sidebar UI                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SidebarAgentIntegrator                        │
│         (Connects UI to Agent Runtime)                     │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Agent Runtime  │  │   LLM Manager   │  │  Tool Registry  │
│                 │  │                 │  │                 │
│ • Message Loop  │  │ • OpenAI       │  │ • Read Tools    │
│ • Tool Calls    │  │ • Claude       │  │ • Write Tools   │
│ • Streaming    │  │ • Gemini       │  │ • Custom Tools  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ ZoteroGateway    │    │ PdfService                  │  │
│  │ • Item Access   │    │ • PDF Text Extraction       │  │
│  │ • Metadata      │    │ • Annotations              │  │
│  │ • Collections   │    │ • Page Navigation          │  │
│  └──────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 🤖 Agent Capabilities

- **Multi-Model Support**: OpenAI, Claude, Gemini with unified interface
- **Streaming Responses**: Real-time AI answers as they're generated
- **Tool Calling**: Agent can use tools to interact with Zotero
- **Action System**: Automated tasks like audit, auto-tag, metadata sync

### 📚 Available Tools

#### Read Tools
| Tool | Description |
|------|-------------|
| `get_item` | Get metadata for a specific Zotero item |
| `get_selected_items` | Get currently selected items |
| `get_pdf_text` | Extract text from PDF (full or page range) |
| `search_items` | Search Zotero library |

#### Write Tools
| Tool | Description |
|------|-------------|
| `add_note` | Add a note to an item |
| `update_tags` | Add/remove tags from items |
| `create_highlight` | Create PDF highlight annotation |
| `sync_notes` | Sync chat as note to Zotero item |

### ⚡ Actions

| Action | Description |
|--------|-------------|
| `audit_items` | Check metadata completeness |
| `auto_tag_items` | LLM-powered auto-tagging |
| `sync_metadata` | Sync from DOI/arXiv/ISBN |

## 🚀 Installation

### Requirements

- **Zotero 7+** (or newer beta)
- **Node.js 18+** (for development)

### Install from Release (Recommended)

1. Download the latest `.xpi` file from [Releases](https://github.com/ShiWenber/zotero-paper-copilot/releases)
2. In Zotero: Go to `Tools` → `Add-ons`
3. Click the gear icon → `Install Add-on From File`
4. Select the downloaded `.xpi` file
5. Restart Zotero

### Development Installation

```bash
# Clone the repository
git clone https://github.com/ShiWenber/zotero-paper-copilot.git
cd zotero-paper-copilot

# Install dependencies
npm install

# Start development (auto-reload enabled)
npm start

# Build for production
npm run build

# Run tests
npm run test
```

## ⚙️ Configuration

### API Key Configuration

1. **OpenAI API** (Default)
   - Get your API key from [OpenAI Platform](https://platform.openai.com)
   - Enter in Preferences → API Settings → OpenAI API Key

2. **Claude API** (Alternative)
   - Get your API key from [Anthropic Console](https://console.anthropic.com)
   - Configure in Preferences → API Settings → Claude

3. **Gemini API** (Alternative)
   - Get your API key from [Google AI Studio](https://aistudio.google.com)
   - Configure in Preferences → API Settings → Gemini

### Preferences Reference

| Setting | Description | Default |
|---------|-------------|---------|
| `API Provider` | LLM service to use | OpenAI |
| `API Key` | Your API key | - |
| `Model` | LLM model to use | gpt-4o-mini |
| `Temperature` | Response creativity | 0.7 |
| `Max Tokens` | Response length limit | 2048 |
| `Sidebar Width` | Panel width in pixels | 400 |

## 📖 Usage

### Opening the Sidebar

- **Method 1**: Click `Tools` → `Toggle Paper Copilot` in the menu
- **Method 2**: Select text in a PDF and the sidebar will open

### Interacting with AI

1. **Select text** in any PDF
2. Click **Ask AI** to get explanations
3. Click **Summarize** for paper summary
4. Click **Translate** for translation

### Using Actions

Actions are automated tasks. Try:

```
"@AI Audit my selected items"
"@AI Auto-tag this paper"
"@AI Sync metadata from DOI"
```

## 📂 Project Structure

```
src/
├── agent/           # Agent Runtime core
│   ├── Agent.ts    # Main agent class
│   ├── types.ts    # Type definitions
│   └── Tool.ts     # Tool utilities
├── services/       # Service layer
│   ├── ZoteroGateway.ts
│   └── PdfService.ts
├── tools/          # Tool registry
│   ├── read/       # Read tools
│   └── write/       # Write tools
├── llm/            # LLM adapters
│   └── adapters/    # OpenAI, Claude, Gemini
├── actions/        # Action system
│   ├── audit/
│   ├── autoTag/
│   └── syncMetadata/
└── integration/    # UI integration
    └── SidebarAgentIntegrator.ts
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage
```

Test files are located in `test/` with the same structure as `src/`.

## ❓ FAQ

### Q: Does this work with Zotero 6?

A: No, Paper Copilot requires Zotero 7 or newer due to API compatibility.

### Q: Which LLM providers are supported?

A: OpenAI (GPT-4, GPT-4o), Anthropic (Claude), and Google (Gemini).

### Q: How do I add custom tools?

A: Create a new tool class extending `BaseTool` and register it in `ToolLoader.ts`.

### Q: Is my data secure?

A: Yes. API calls are made directly from your machine. No data is stored on external servers.

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting PRs.

### Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/zotero-paper-copilot.git

# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
npm start
npm run test

# Commit and push
git commit -m "feat: your feature"
git push origin feature/your-feature
```

## 📄 License

This project is licensed under the **AGPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) - Plugin scaffolding
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) - UI utilities
- [llm-for-zotero](https://github.com/yilewang/llm-for-zotero) - Reference architecture for Agent Runtime design
- [Zotero Community](https://forums.zotero.org) - Support and feedback

## 📬 Contact

- **GitHub Issues**: [Report bugs or request features](https://github.com/ShiWenber/zotero-paper-copilot/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/ShiWenber/zotero-paper-copilot/discussions)

---

<div align="center">

Made with ❤️ for researchers everywhere

</div>
