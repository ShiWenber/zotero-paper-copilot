/**
 * Zotero Paper Copilot - Sidebar UI Module
 *
 * Using native HTML + zotero-plugin-toolkit
 * Reference: zotero-gpt, zotero-pdf-translate
 */

import { TranslationAPI, SUPPORTED_LANGUAGES } from "./translation";
import { LLMAPI } from "./llm-api";
import { SemanticScholarAPI, SemanticScholarPaper } from "./semantic-scholar";

export class SidebarUI {
  private static sidebarId = "zotero-paper-copilot-sidebar";
  private static sidebarWidth = 400;
  private static currentSelectedText = "";
  private static currentTargetLanguage = "ZH";
  /**
   * Create sidebar using ztoolkit.UI
   */
  public static create(win: Window): void {
    this.remove();

    const doc = win.document;

    // Create main container
    const sidebar = doc.createElement("div");
    sidebar.id = this.sidebarId;
    sidebar.style.cssText =
      "position: fixed; right: 0; top: 0; width: " +
      this.sidebarWidth +
      "px; height: 100vh; background: #ffffff; box-shadow: -2px 0 10px rgba(0,0,0,0.15); " +
      "z-index: 9999; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";

    // Header
    const header = doc.createElement("div");
    header.style.cssText =
      "padding: 16px; border-bottom: 1px solid #e0e0e0; background: #f5f5f5; " +
      "display: flex; align-items: center; justify-content: space-between;";
    header.innerHTML =
      '<div style="font-size: 16px; font-weight: 600; color: #333;">📄 Paper Copilot</div>' +
      '<button id="sidebar-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px 8px; color: #666;">×</button>';

    // Content
    const content = doc.createElement("div");
    content.style.cssText = "flex: 1; overflow-y: auto; padding: 16px;";
    content.innerHTML =
      '<div style="text-align: center; padding: 40px 20px; color: #666;">' +
      '<div style="font-size: 48px; margin-bottom: 16px;">🤖</div>' +
      '<div style="font-size: 16px; margin-bottom: 8px;">Welcome to Paper Copilot</div>' +
      '<div style="font-size: 14px; color: #999;">Select text in a PDF to ask questions<br>or get translations.</div>' +
      "</div>" +
      '<div style="margin-top: 20px; padding: 16px; background: #f0f7ff; border-radius: 8px;">' +
      '<div style="font-size: 14px; font-weight: 600; color: #0066cc; margin-bottom: 8px;">💡 Quick Tips</div>' +
      '<ul style="font-size: 13px; color: #555; padding-left: 20px; margin: 0;">' +
      "<li>Select any text in the PDF to get AI explanations</li>" +
      "<li>Click the summarize button to get paper summary</li>" +
      "<li>Use translate for instant translations</li>" +
      "</ul></div>";

    // Footer with buttons
    const footer = doc.createElement("div");
    footer.style.cssText =
      "padding: 12px 16px; border-top: 1px solid #e0e0e0; background: #f9f9f9;";
    footer.innerHTML =
      '<div style="display: flex; gap: 8px; margin-bottom: 8px;">' +
      '<button id="btn-summarize" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📝 Summarize</button>' +
      '<button id="btn-translate" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
      "</div>" +
      '<div style="display: flex; gap: 8px;">' +
      '<button id="btn-recommend" style="flex: 1; padding: 10px 16px; background: #9c27b0; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📚 Recommend</button>' +
      '<button id="btn-search" style="flex: 1; padding: 10px 16px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🔍 Search</button>' +
      "</div>";

    // Chat area (for future AI conversation)
    const chatArea = doc.createElement("div");
    chatArea.id = "paper-copilot-chat-area";
    chatArea.style.cssText =
      "flex: 1; overflow-y: auto; padding: 16px; display: none;";
    chatArea.innerHTML =
      '<div id="chat-messages" style="display: flex; flex-direction: column; gap: 12px;"></div>';

    // Assemble
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    sidebar.appendChild(chatArea);
    sidebar.appendChild(footer);
    doc.body.appendChild(sidebar);

    // Event listeners
    doc
      .getElementById("sidebar-close-btn")
      ?.addEventListener("click", () => this.remove());
    doc
      .getElementById("btn-summarize")
      ?.addEventListener("click", () => this.showSummarize(win));
    doc
      .getElementById("btn-translate")
      ?.addEventListener("click", () => this.showTranslate(win));
    doc
      .getElementById("btn-recommend")
      ?.addEventListener("click", () => this.showRecommend(win));
    doc
      .getElementById("btn-search")
      ?.addEventListener("click", () => this.showSearch(win));

    // Log
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot sidebar created with native HTML");
    }
  }

  /**
   * Remove sidebar
   */
  public static remove(): void {
    const sidebar = document.getElementById(this.sidebarId);
    if (sidebar) {
      sidebar.remove();
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot sidebar removed");
      }
    }
  }

  /**
   * Toggle sidebar
   */
  public static toggle(win: Window): void {
    const sidebar = document.getElementById(this.sidebarId);
    if (sidebar) {
      this.remove();
    } else {
      this.create(win);
    }
  }

  /**
   * Show summarize action
   */
  private static showSummarize(win: Window): void {
    this.showMessage(
      win,
      "📝 Generating paper summary...<br><br>This feature requires LLM API integration.",
    );
  }

  /**
   * Show translate action
   */
  private static showTranslate(win: Window): void {
    // Check if translation API is configured
    if (!TranslationAPI.isConfigured()) {
      this.showTranslationConfig(win);
      return;
    }

    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";

      // Build language options
      const langOptions = SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto")
        .map(
          (l) =>
            `<option value="${l.code}" ${l.code === this.currentTargetLanguage ? "selected" : ""}>${l.name}</option>`,
        )
        .join("");

      content.innerHTML =
        '<div style="padding: 16px;">' +
        '<div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px;">🌐 Translate</div>' +
        '<div style="margin-bottom: 12px;">' +
        '<label style="font-size: 13px; color: #666; display: block; margin-bottom: 4px;">Target Language:</label>' +
        `<select id="translation-target-lang" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">${langOptions}</select>` +
        "</div>" +
        '<div style="margin-bottom: 12px;">' +
        '<label style="font-size: 13px; color: #666; display: block; margin-bottom: 4px;">Enter text to translate:</label>' +
        '<textarea id="translation-input" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box;" placeholder="Enter or paste text here..."></textarea>' +
        "</div>" +
        '<button id="btn-translate-now" style="width: 100%; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-bottom: 12px;">🌐 Translate</button>' +
        '<div id="translation-result" style="display: none;">' +
        '<div style="font-size: 13px; color: #666; margin-bottom: 4px;">Translation:</div>' +
        '<div id="translation-output" style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.6; max-height: 300px; overflow-y: auto;"></div>' +
        "</div>" +
        '<div id="translation-loading" style="display: none; text-align: center; padding: 20px;">' +
        '<div style="font-size: 14px; color: #666;">Translating<span id="translation-dots">...</span></div>' +
        "</div>" +
        "</div>";

      // Add event listeners
      win.document
        .getElementById("translation-target-lang")
        ?.addEventListener("change", (e) => {
          this.currentTargetLanguage = (e.target as HTMLSelectElement).value;
        });

      win.document
        .getElementById("btn-translate-now")
        ?.addEventListener("click", () => {
          const inputText = (
            win.document.getElementById(
              "translation-input",
            ) as HTMLTextAreaElement
          )?.value.trim();
          if (!inputText) {
            alert("Please enter text to translate");
            return;
          }
          this.performTranslation(win, inputText);
        });
    }

    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }

  /**
   * Show translation configuration message
   */
  private static showTranslationConfig(win: Window): void {
    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML =
        '<div style="padding: 20px; text-align: center;">' +
        '<div style="font-size: 48px; margin-bottom: 16px;">⚙️</div>' +
        '<div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 8px;">Translation Not Configured</div>' +
        '<div style="font-size: 14px; color: #666; margin-bottom: 16px;">To use translation, please configure your translation API in Zotero Preferences.</div>' +
        '<div style="font-size: 13px; color: #888; text-align: left; background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 16px;">' +
        "<strong>Options:</strong><br>" +
        "1. DeepL API (recommended) - Get API key from deepl.com/pro-api<br>" +
        "2. Google Translate API - Get API key from cloud.google.com<br>" +
        "3. Use LLM (fallback) - Requires OpenAI or Claude API configured" +
        "</div>" +
        '<button id="btn-check-llm-config" style="width: 100%; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Check LLM Configuration</button>' +
        "</div>";

      win.document
        .getElementById("btn-check-llm-config")
        ?.addEventListener("click", () => {
          if (LLMAPI.isConfigured()) {
            this.showMessage(
              win,
              "✅ LLM is configured! You can use LLM-based translation. The translation feature will use your LLM API as fallback.",
            );
          } else {
            this.showMessage(
              win,
              "❌ LLM is not configured. Please configure at least one translation API or LLM API in Preferences.",
            );
          }
        });
    }
  }

  /**
   * Perform translation
   */
  private static async performTranslation(
    win: Window,
    text: string,
  ): Promise<void> {
    const resultDiv = win.document.getElementById("translation-result");
    const loadingDiv = win.document.getElementById("translation-loading");
    const outputDiv = win.document.getElementById("translation-output");

    if (resultDiv && loadingDiv && outputDiv) {
      resultDiv.style.display = "none";
      loadingDiv.style.display = "block";

      // Animate loading dots
      let dotCount = 0;
      const dotsInterval = setInterval(() => {
        const dotsEl = win.document.getElementById("translation-dots");
        if (dotsEl) {
          dotCount = (dotCount + 1) % 4;
          dotsEl.textContent = ".".repeat(dotCount);
        }
      }, 300);

      try {
        let fullTranslation = "";

        await TranslationAPI.translate(text, {
          targetLanguage: this.currentTargetLanguage,
          stream: {
            onChunk: (chunk) => {
              fullTranslation += chunk;
              outputDiv.innerHTML = fullTranslation.replace(/\n/g, "<br>");
              // Scroll to bottom
              outputDiv.scrollTop = outputDiv.scrollHeight;
            },
            onComplete: (fullContent) => {
              fullTranslation = fullContent;
            },
            onError: (error) => {
              clearInterval(dotsInterval);
              loadingDiv.style.display = "none";
              outputDiv.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
              resultDiv.style.display = "block";
            },
          },
        });

        clearInterval(dotsInterval);
        loadingDiv.style.display = "none";
        resultDiv.style.display = "block";
      } catch (error) {
        clearInterval(dotsInterval);
        loadingDiv.style.display = "none";
        outputDiv.innerHTML = `<span style="color: red;">Error: ${(error as Error).message}</span>`;
        resultDiv.style.display = "block";
      }
    }
  }

  /**
   * Show message in content area
   */
  private static showMessage(win: Window, html: string): void {
    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #333; font-size: 14px;">' +
        html +
        "</div>";
    }

    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }

  /**
   * Add a message to chat (for future AI conversation)
   */
  public static addChatMessage(
    win: Window,
    role: "user" | "assistant",
    content: string,
  ): void {
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    const contentArea = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );

    if (chatArea && contentArea) {
      // Hide welcome content, show chat
      (contentArea as HTMLElement).style.display = "none";
      chatArea.style.display = "block";

      const messages = win.document.getElementById("chat-messages");
      if (messages) {
        const msgDiv = win.document.createElement("div");
        msgDiv.style.cssText =
          "padding: 12px; border-radius: 8px; max-width: 90%; font-size: 14px; line-height: 1.5;";

        if (role === "user") {
          msgDiv.style.cssText += "background: #e3f2fd; margin-left: auto;";
        } else {
          msgDiv.style.cssText += "background: #f5f5f5; margin-right: auto;";
        }

        msgDiv.innerHTML = content;
        messages.appendChild(msgDiv);

        // Scroll to bottom
        chatArea.scrollTop = chatArea.scrollHeight;
      }
    }
  }

  /**
   * Show selected text in sidebar (called from PDF selection)
   */
  public static showSelectedText(win: Window, text: string): void {
    this.currentSelectedText = text;

    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";

      const displayText =
        text.length > 500 ? text.substring(0, 500) + "..." : text;
      const escapedText = displayText
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Build language options
      const langOptions = SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto")
        .map(
          (l) =>
            `<option value="${l.code}" ${l.code === this.currentTargetLanguage ? "selected" : ""}>${l.name}</option>`,
        )
        .join("");

      content.innerHTML =
        '<div style="padding: 16px;">' +
        '<div style="font-size: 12px; color: #999; margin-bottom: 8px;">Selected Text:</div>' +
        '<div style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.6; margin-bottom: 16px; max-height: 200px; overflow-y: auto; white-space: pre-wrap;">' +
        escapedText +
        "</div>" +
        '<div style="margin-bottom: 12px;">' +
        `<label style="font-size: 13px; color: #666; display: block; margin-bottom: 4px;">Translate to:</label>` +
        `<select id="selection-translate-lang" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 8px;">${langOptions}</select>` +
        "</div>" +
        '<div style="display: flex; gap: 8px;">' +
        '<button id="btn-ask-about-selection" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">💬 Ask AI</button>' +
        '<button id="btn-translate-selection" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
        "</div>" +
        '<div id="selection-translation-result" style="display: none; margin-top: 16px;">' +
        '<div style="font-size: 13px; color: #666; margin-bottom: 4px;">Translation:</div>' +
        '<div id="selection-translation-output" style="background: #e8f5e9; padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.6; max-height: 300px; overflow-y: auto;"></div>' +
        "</div>" +
        '<div id="selection-translation-loading" style="display: none; text-align: center; padding: 20px; color: #666;">Translating...</div>' +
        "</div>";

      // Add language change listener
      win.document
        .getElementById("selection-translate-lang")
        ?.addEventListener("change", (e) => {
          this.currentTargetLanguage = (e.target as HTMLSelectElement).value;
        });

      win.document
        .getElementById("btn-ask-about-selection")
        ?.addEventListener("click", () => {
          this.showMessage(win, "🤖 AI Question feature coming soon!");
        });

      win.document
        .getElementById("btn-translate-selection")
        ?.addEventListener("click", () => {
          this.translateSelectedText(win, text);
        });
    }

    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }

  /**
   * Translate selected text
   */
  private static async translateSelectedText(
    win: Window,
    text: string,
  ): Promise<void> {
    const resultDiv = win.document.getElementById(
      "selection-translation-result",
    );
    const loadingDiv = win.document.getElementById(
      "selection-translation-loading",
    );
    const outputDiv = win.document.getElementById(
      "selection-translation-output",
    );

    if (!resultDiv || !loadingDiv || !outputDiv) {
      return;
    }

    // Check if translation API is configured
    if (!TranslationAPI.isConfigured()) {
      // Try using LLM as fallback
      if (!LLMAPI.isConfigured()) {
        alert(
          "Translation not configured. Please set up DeepL, Google Translate, or LLM API in Preferences.",
        );
        return;
      }
    }

    resultDiv.style.display = "none";
    loadingDiv.style.display = "block";

    try {
      let fullTranslation = "";

      await TranslationAPI.translate(text, {
        targetLanguage: this.currentTargetLanguage,
        stream: {
          onChunk: (chunk) => {
            fullTranslation += chunk;
            outputDiv.innerHTML = fullTranslation.replace(/\n/g, "<br>");
            outputDiv.scrollTop = outputDiv.scrollHeight;
          },
          onComplete: (fullContent) => {
            fullTranslation = fullContent;
          },
          onError: (error) => {
            loadingDiv.style.display = "none";
            outputDiv.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
            resultDiv.style.display = "block";
          },
        },
      });

      loadingDiv.style.display = "none";
      resultDiv.style.display = "block";
    } catch (error) {
      loadingDiv.style.display = "none";
      outputDiv.innerHTML = `<span style="color: red;">Error: ${(error as Error).message}</span>`;
      resultDiv.style.display = "block";
    }
  }

  /**
   * Show recommendation panel
   */
  public static showRecommend(win: Window): void {
    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";

      content.innerHTML =
        '<div style="padding: 16px;">' +
        '<div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px;">📚 Paper Recommendations</div>' +
        '<div style="margin-bottom: 12px;">' +
        '<label style="font-size: 13px; color: #666; display: block; margin-bottom: 4px;">Search or enter paper DOI/ArXiv ID:</label>' +
        '<input id="recommend-search-input" type="text" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;" placeholder="e.g., 10.1234/example or 2301.12345">' +
        "</div>" +
        '<div style="display: flex; gap: 8px; margin-bottom: 16px;">' +
        '<button id="btn-get-recommendations" style="flex: 1; padding: 10px 16px; background: #9c27b0; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🔎 Get Recommendations</button>' +
        "</div>" +
        '<div id="recommendations-loading" style="display: none; text-align: center; padding: 20px; color: #666;">Loading recommendations...</div>' +
        '<div id="recommendations-result" style="display: none;"></div>' +
        '<div id="recommendations-error" style="display: none; color: red; padding: 12px; background: #ffebee; border-radius: 6px;"></div>' +
        "</div>";

      // Add event listener
      win.document
        .getElementById("btn-get-recommendations")
        ?.addEventListener("click", async () => {
          const input = win.document.getElementById(
            "recommend-search-input",
          ) as HTMLInputElement;
          const query = input?.value.trim();

          if (!query) {
            alert("Please enter a paper title, DOI, or ArXiv ID");
            return;
          }

          await this.fetchRecommendations(win, query);
        });

      // Allow Enter key to search
      win.document
        .getElementById("recommend-search-input")
        ?.addEventListener("keypress", async (e) => {
          if (e.key === "Enter") {
            const input = e.target as HTMLInputElement;
            const query = input.value.trim();

            if (!query) {
              return;
            }

            await this.fetchRecommendations(win, query);
          }
        });
    }

    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }

  /**
   * Fetch recommendations from Semantic Scholar
   */
  private static async fetchRecommendations(
    win: Window,
    query: string,
  ): Promise<void> {
    const loadingDiv = win.document.getElementById("recommendations-loading");
    const resultDiv = win.document.getElementById("recommendations-result");
    const errorDiv = win.document.getElementById("recommendations-error");

    if (!loadingDiv || !resultDiv || !errorDiv) return;

    loadingDiv.style.display = "block";
    resultDiv.style.display = "none";
    errorDiv.style.display = "none";

    try {
      let papers: SemanticScholarPaper[] = [];

      // Check if it's a DOI or ArXiv ID
      if (query.includes("10.") && query.includes("/")) {
        // Likely a DOI
        const paper = await SemanticScholarAPI.getPaperByDOI(query);
        if (paper) {
          // Get related papers
          const related = await SemanticScholarAPI.getRelatedPapers(
            paper.paperId,
            { limit: 10 },
          );
          papers = related.data;
        }
      } else if (query.match(/^\d{4}\.\d{4,5}$/)) {
        // Likely ArXiv ID
        const paper = await SemanticScholarAPI.getPaperByArXiv(query);
        if (paper) {
          const related = await SemanticScholarAPI.getRelatedPapers(
            paper.paperId,
            { limit: 10 },
          );
          papers = related.data;
        }
      } else {
        // Search by title/query
        const searchResult = await SemanticScholarAPI.searchPapers(query, {
          limit: 10,
        });
        papers = searchResult.data;
      }

      loadingDiv.style.display = "none";

      if (papers.length === 0) {
        resultDiv.innerHTML =
          '<div style="text-align: center; padding: 20px; color: #666;">No papers found. Try a different search term.</div>';
        resultDiv.style.display = "block";
        return;
      }

      // Render papers
      this.renderRecommendations(win, papers);
    } catch (error) {
      loadingDiv.style.display = "none";
      errorDiv.textContent = `Error: ${(error as Error).message}`;
      errorDiv.style.display = "block";
    }
  }

  /**
   * Render recommendation list
   */
  private static renderRecommendations(
    win: Window,
    papers: SemanticScholarPaper[],
  ): void {
    const resultDiv = win.document.getElementById("recommendations-result");
    if (!resultDiv) return;

    const papersHtml = papers
      .map((paper, index) => {
        const info = SemanticScholarAPI.formatPaperForDisplay(paper);
        return `
        <div style="background: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 12px; border-left: 4px solid #9c27b0;">
          <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 4px; line-height: 1.4;">
            <a href="${info.url}" target="_blank" style="color: #0066cc; text-decoration: none;">${info.title}</a>
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${info.authors}</div>
          <div style="font-size: 12px; color: #888;">
            <span>${info.year}</span> · 
            <span>${info.citations} citations</span> · 
            <span>${info.venue}</span>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button class="btn-view-paper" data-url="${info.url}" style="padding: 6px 12px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">View Paper</button>
            <button class="btn-add-to-zotero" data-paper-id="${paper.paperId}" data-title="${encodeURIComponent(paper.title)}" data-doi="${paper.doi || ""}" data-url="${info.url}" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Add to Zotero</button>
          </div>
        </div>
      `;
      })
      .join("");

    resultDiv.innerHTML =
      '<div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px;">Related Papers:</div>' +
      papersHtml;
    resultDiv.style.display = "block";

    // Add event listeners for buttons
    resultDiv.querySelectorAll(".btn-view-paper").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const url = (e.target as HTMLElement).getAttribute("data-url");
        if (url) {
          Zotero.LaunchURL(url);
        }
      });
    });

    resultDiv.querySelectorAll(".btn-add-to-zotero").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const paperId = (e.target as HTMLElement).getAttribute("data-paper-id");
        const title = decodeURIComponent(
          (e.target as HTMLElement).getAttribute("data-title") || "",
        );
        const doi = (e.target as HTMLElement).getAttribute("data-doi") || "";
        const url = (e.target as HTMLElement).getAttribute("data-url") || "";

        this.addPaperToZotero(win, { paperId, title, doi, url });
      });
    });
  }

  /**
   * Add paper to Zotero library
   */
  private static addPaperToZotero(
    win: Window,
    paper: { paperId: string; title: string; doi: string; url: string },
  ): void {
    try {
      // Create a new item
      const item = new Zotero.Item("journalArticle");
      item.setField("title", paper.title);

      if (paper.doi) {
        item.setField("DOI", paper.doi);
      }

      if (paper.url) {
        item.setField("url", paper.url);
      }

      item.setField("accessDate", new Date().toISOString());

      // Save the item
      item.save();

      // Show success message
      const resultDiv = win.document.getElementById("recommendations-result");
      if (resultDiv) {
        const successMsg = document.createElement("div");
        successMsg.style.cssText =
          "background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 12px; font-size: 14px;";
        successMsg.textContent = `✅ "${paper.title.substring(0, 50)}..." added to your Zotero library!`;
        resultDiv.insertBefore(successMsg, resultDiv.firstChild);
      }

      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Paper added to Zotero:", paper.title);
      }
    } catch (error) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error adding paper to Zotero:", error);
      }
      alert(`Error adding paper to Zotero: ${(error as Error).message}`);
    }
  }

  /**
   * Show search panel
   */
  public static showSearch(win: Window): void {
    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";

      content.innerHTML =
        '<div style="padding: 16px;">' +
        '<div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px;">🔍 Search Papers</div>' +
        '<div style="margin-bottom: 12px;">' +
        '<label style="font-size: 13px; color: #666; display: block; margin-bottom: 4px;">Search Semantic Scholar:</label>' +
        '<input id="paper-search-input" type="text" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;" placeholder="Enter paper title, author, or keywords...">' +
        "</div>" +
        '<div style="display: flex; gap: 8px; margin-bottom: 16px;">' +
        '<button id="btn-search-papers" style="flex: 1; padding: 10px 16px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🔍 Search</button>' +
        "</div>" +
        '<div id="search-loading" style="display: none; text-align: center; padding: 20px; color: #666;">Searching...</div>' +
        '<div id="search-result" style="display: none;"></div>' +
        '<div id="search-error" style="display: none; color: red; padding: 12px; background: #ffebee; border-radius: 6px;"></div>' +
        "</div>";

      // Add event listener
      win.document
        .getElementById("btn-search-papers")
        ?.addEventListener("click", async () => {
          const input = win.document.getElementById(
            "paper-search-input",
          ) as HTMLInputElement;
          const query = input?.value.trim();

          if (!query) {
            alert("Please enter a search query");
            return;
          }

          await this.searchPapers(win, query);
        });

      // Allow Enter key to search
      win.document
        .getElementById("paper-search-input")
        ?.addEventListener("keypress", async (e) => {
          if (e.key === "Enter") {
            const input = e.target as HTMLInputElement;
            const query = input.value.trim();

            if (!query) {
              return;
            }

            await this.searchPapers(win, query);
          }
        });
    }

    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }

  /**
   * Search papers from Semantic Scholar
   */
  private static async searchPapers(win: Window, query: string): Promise<void> {
    const loadingDiv = win.document.getElementById("search-loading");
    const resultDiv = win.document.getElementById("search-result");
    const errorDiv = win.document.getElementById("search-error");

    if (!loadingDiv || !resultDiv || !errorDiv) return;

    loadingDiv.style.display = "block";
    resultDiv.style.display = "none";
    errorDiv.style.display = "none";

    try {
      const searchResult = await SemanticScholarAPI.searchPapers(query, {
        limit: 15,
      });

      loadingDiv.style.display = "none";

      if (searchResult.data.length === 0) {
        resultDiv.innerHTML =
          '<div style="text-align: center; padding: 20px; color: #666;">No papers found. Try a different search term.</div>';
        resultDiv.style.display = "block";
        return;
      }

      // Render papers (reuse the same rendering logic)
      this.renderRecommendations(win, searchResult.data);
    } catch (error) {
      loadingDiv.style.display = "none";
      errorDiv.textContent = `Error: ${(error as Error).message}`;
      errorDiv.style.display = "block";
    }
  }
}
