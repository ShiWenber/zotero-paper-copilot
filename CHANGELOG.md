# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-13

### Added
- **Phase 1: Core Foundation**
  - Sidebar UI with native HTML implementation
  - PDF text extraction from Zotero reader
  - Quick action buttons (Summarize, Translate, Ask AI)
  - Menu integration for sidebar toggle

- **Phase 2: PDF Analysis**
  - PDF page structure parsing module
  - Figure and chart detection
  - Table of contents extraction
  - Metadata storage and indexing

- **Phase 3: AI Conversation**
  - LLM API integration framework
  - Chat interface for paper discussions
  - Streaming response support
  - Context-aware conversations

- **Phase 4: Research Features**
  - Paper summary generation
  - Translation support (DeepL, Google, LLM fallback)
  - Collection knowledge base Q&A
  - Literature recommendations via Semantic Scholar API

- **Phase 5: Polish & Performance**
  - Performance optimization modules
  - Testing infrastructure
  - Theme support (light/dark mode)
  - Onboarding experience
  - UI/UX improvements

### Changed
- Migrated from Vue 3 to native HTML for sidebar
- Improved PDF selection detection
- Enhanced preference pane with table support

### Fixed
- PDF text selection in Zotero 7 reader
- Sidebar toggle menu integration
- Initial startup sequence

## [0.1.0] - 2024-03-12

### Added
- Initial plugin structure from zotero-plugin-template
- Basic sidebar UI framework (Vue 3)
- PDF text selection extraction
- Basic preferences pane

### Notes
- This version is considered pre-release
- Basic functionality for text selection and UI

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0.0 | 2026-03-13 | Current |
| 0.1.0 | 2024-03-12 | Deprecated |

## Upgrade Notes

### Upgrading from 0.1.x to 1.0.0

1. **Backup your settings** - Export preferences if needed
2. **Clean install recommended** - Uninstall old version first
3. **API keys** - Re-enter API keys in preferences
4. **Restart Zotero** - Required after upgrade

---

## Known Issues

- PDF selection may not work in all PDF viewers
- Some LLM providers may require additional configuration
- Knowledge base Q&A requires indexed papers

## Roadmap

See [GitHub Projects](https://github.com/ShiWenber/zotero-paper-copilot/projects) for planned features.

---

*Generated on 2026-03-13*
