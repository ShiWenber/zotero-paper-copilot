# Zotero Paper Copilot

[English](README.md) | [简体中文](doc/README-zhCN.md)

[![Zotero Version](https://img.shields.io/badge/Zotero-7+-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/ShiWenber/zotero-paper-copilot?style=flat-square)](https://github.com/ShiWenber/zotero-paper-copilot/releases)
[![GitHub Stars](https://img.shields.io/github/stars/ShiWenber/zotero-paper-copilot?style=flat-square)](https://github.com/ShiWenber/zotero-paper-copilot/stargazers)

> 🤖 AI Assistant for Research Papers - Supercharge your literature review workflow with AI-powered features

Paper Copilot is a Zotero 7+ plugin that brings powerful AI capabilities to your PDF reading experience. Ask questions about papers, get instant translations, generate summaries, and more - all without leaving Zotero.

![Paper Copilot Demo](doc/images/demo.png)

## ✨ Features

### 📚 Phase 1: Core Foundation

- **Sidebar UI** - Elegant side panel for AI interactions
- **PDF Text Extraction** - Select and extract text from any PDF
- **Quick Actions** - One-click access to AI features

### 📄 Phase 2: PDF Analysis

- **Page Structure Parsing** - Understand PDF layout and structure
- **Figure Detection** - Identify charts, graphs, and images
- **Table of Contents Extraction** - Auto-detect paper sections
- **Metadata Storage** - Save and index paper information

### 💬 Phase 3: AI Conversation

- **LLM API Integration** - Connect to OpenAI, Claude, Ollama, and more
- **Chat Interface** - Natural conversation about papers
- **Streaming Responses** - Real-time AI answers
- **Context Awareness** - Understand paper content and structure

### 📝 Phase 4: Research Features

- **Paper Summary** - Generate concise paper abstracts
- **Translation** - Instant translation (DeepL, Google, LLM fallback)
- **Knowledge Base Q&A** - Query your library collection
- **Literature Recommendations** - Get related paper suggestions

### ⚡ Phase 5: Polish & Performance

- **Performance Optimization** - Fast and responsive UI
- **Theme Support** - Light/dark mode compatibility
- **Onboarding** - Guided setup experience
- **Testing** - Reliable and stable functionality

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
```

## ⚙️ Configuration

### Access Settings

After installation, access settings via:

- **Zotero Menu** → `Edit` → `Preferences` → `Paper Copilot`
- Or click the plugin icon in the toolbar

### API Key Configuration

1. **OpenAI API** (Default)
   - Get your API key from [OpenAI Platform](https://platform.openapi.com)
   - Enter in Preferences → API Settings → OpenAI API Key

2. **Claude API** (Alternative)
   - Get your API key from [Anthropic Console](https://console.anthropic.com)
   - Configure in Preferences → API Settings → Claude

3. **Ollama** (Local, Free)
   - Install [Ollama](https://ollama.com)
   - Run locally and configure endpoint in preferences

### Preferences Reference

| Setting             | Description             | Default     |
| ------------------- | ----------------------- | ----------- |
| `API Provider`      | LLM service to use      | OpenAI      |
| `API Key`           | Your API key            | -           |
| `Model`             | LLM model to use        | gpt-4o-mini |
| `Temperature`       | Response creativity     | 0.7         |
| `Max Tokens`        | Response length limit   | 2048        |
| `Sidebar Width`     | Panel width in pixels   | 400         |
| `Auto-open Sidebar` | Open when text selected | false       |

## 📖 Usage Tutorials

### Opening the Sidebar

- **Method 1**: Click `Tools` → `Toggle Paper Copilot` in the menu
- **Method 2**: Use keyboard shortcut (if configured)
- **Method 3**: Click the plugin button in toolbar

### Selecting Text in PDF

1. Open any PDF in Zotero's reader
2. Select text with your mouse
3. The selected text appears in the sidebar
4. Use action buttons for AI responses

### Asking Questions

```
User: What is the main contribution of this paper?
Paper Copilot: Based on the paper's abstract and structure...
```

### Generating Summary

Click the **Summarize** button to get:

- Paper overview
- Key findings
- Methodology summary
- Conclusions

### Translating Content

1. Select text in any language
2. Click **Translate** button
3. Choose target language
4. View translation in sidebar

### Knowledge Base Q&A

Ask questions about your entire library:

```
User: What papers discuss transformer architectures?
Paper Copilot: Found 5 papers in your library...
```

## 🖼️ Screenshots

### Main Interface

![Sidebar Interface](doc/images/sidebar.png)

### Preferences Panel

![Preferences](doc/images/preferences.png)

### PDF Interaction

![PDF Selection](doc/images/pdf-selection.png)

## ❓ FAQ

### Q: Does this work with Zotero 6?

A: No, Paper Copilot requires Zotero 7 or newer due to API compatibility.

### Q: Which LLM providers are supported?

A: OpenAI (GPT-4, GPT-4o), Anthropic (Claude), Ollama (local), and compatible APIs.

### Q: Is my data secure?

A: Yes. API calls are made directly from your machine. No data is stored on external servers beyond the LLM provider.

### Q: Why isn't the sidebar showing?

A: Try restarting Zotero. If issues persist, check the debug output (Help → Debug Output Logging).

### Q: How do I change the sidebar language?

A: Language settings are in Preferences → General → Language.

### Q: Can I use my own LLM endpoint?

A: Yes, configure custom endpoints in Preferences → Advanced → Custom API Endpoint.

### Q: The plugin doesn't load after installation

A: Check that you have Zotero 7+. Try reinstalling or check the error in Help → Debug Output Logging.

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

# Commit and push
git commit -m "feat: your feature"
git push origin feature/your-feature
```

## 📄 License

This project is licensed under the **AGPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) - Plugin scaffolding
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) - UI utilities
- [Zotero Community](https://forums.zotero.org) - Support and feedback

## 📬 Contact

- **GitHub Issues**: [Report bugs or request features](https://github.com/ShiWenber/zotero-paper-copilot/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/ShiWenber/zotero-paper-copilot/discussions)

---

<div align="center">

Made with ❤️ for researchers everywhere

</div>
