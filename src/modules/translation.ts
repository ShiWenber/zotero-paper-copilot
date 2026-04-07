/**
 * Zotero Paper Copilot - Translation Module
 *
 * Translation functionality using DeepL API, Google Translate API, or LLM-based translation
 * Supports streaming translations
 */

import { LLMAPI, ChatMessage } from "./llm-api";

export type TranslationProvider = "deepl" | "google" | "llm";

export interface TranslationConfig {
  provider: TranslationProvider;
  apiKey: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  provider: TranslationProvider;
}

export interface TranslationStreamCallback {
  (chunk: string): void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  onChunk?: (chunk: string) => void;
}

// Supported languages for translation
export const SUPPORTED_LANGUAGES = [
  { code: "auto", name: "Auto-detect" },
  { code: "EN", name: "English" },
  { code: "ZH", name: "Chinese" },
  { code: "ES", name: "Spanish" },
  { code: "FR", name: "French" },
  { code: "DE", name: "German" },
  { code: "IT", name: "Italian" },
  { code: "PT", name: "Portuguese" },
  { code: "RU", name: "Russian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "AR", name: "Arabic" },
  { code: "NL", name: "Dutch" },
  { code: "PL", name: "Polish" },
  { code: "TR", name: "Turkish" },
  { code: "VI", name: "Vietnamese" },
  { code: "TH", name: "Thai" },
  { code: "ID", name: "Indonesian" },
  { code: "UK", name: "Ukrainian" },
];

// DeepL API language codes mapping
const DEEPL_LANGUAGE_MAP: { [key: string]: string } = {
  EN: "EN",
  ZH: "ZH",
  ES: "ES",
  FR: "FR",
  DE: "DE",
  IT: "IT",
  PT: "PT",
  RU: "RU",
  JA: "JA",
  KO: "KO",
  AR: "AR",
  NL: "NL",
  PL: "PL",
  TR: "TR",
};

export class TranslationAPI {
  private static config: TranslationConfig | null = null;

  /**
   * Initialize Translation API with configuration
   */
  public static init(config: TranslationConfig): void {
    this.config = config;

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log(
        "Paper Copilot: Translation API initialized with provider:",
        config.provider,
      );
    }
  }

  /**
   * Get current configuration
   */
  public static getConfig(): TranslationConfig | null {
    return this.config;
  }

  /**
   * Load configuration from Zotero preferences
   */
  public static loadFromPrefs(): boolean {
    try {
      const provider = Zotero.Prefs.get(
        "paper-copilot.translation-provider",
      ) as string;
      const apiKey = Zotero.Prefs.get(
        "paper-copilot.translation-api-key",
      ) as string;
      const targetLanguage = Zotero.Prefs.get(
        "paper-copilot.translation-target-language",
      ) as string;

      if (provider && targetLanguage) {
        this.config = {
          provider: provider as TranslationProvider,
          apiKey: apiKey || "",
          targetLanguage,
          sourceLanguage:
            (Zotero.Prefs.get(
              "paper-copilot.translation-source-language",
            ) as string) || "auto",
        };

        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log("Paper Copilot: Translation config loaded from prefs");
        }
        return true;
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error loading translation config:", e);
      }
    }
    return false;
  }

  /**
   * Save configuration to Zotero preferences
   */
  public static saveToPrefs(config: TranslationConfig): void {
    try {
      Zotero.Prefs.set("paper-copilot.translation-provider", config.provider);
      Zotero.Prefs.set("paper-copilot.translation-api-key", config.apiKey);
      Zotero.Prefs.set(
        "paper-copilot.translation-target-language",
        config.targetLanguage,
      );
      if (config.sourceLanguage) {
        Zotero.Prefs.set(
          "paper-copilot.translation-source-language",
          config.sourceLanguage,
        );
      }

      this.config = config;

      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Translation config saved to prefs");
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error saving translation config:", e);
      }
    }
  }

  /**
   * Check if API is configured
   */
  public static isConfigured(): boolean {
    if (!this.config) {
      return false;
    }

    // LLM doesn't require API key in translation config (uses LLM API key)
    if (this.config.provider === "llm") {
      return LLMAPI.isConfigured();
    }

    return this.config.apiKey !== "";
  }

  /**
   * Translate text using the configured provider
   */
  public static async translate(
    text: string,
    options?: {
      targetLanguage?: string;
      sourceLanguage?: string;
      stream?: TranslationStreamCallback;
    },
  ): Promise<TranslationResult> {
    if (!this.config) {
      // Try loading from prefs
      if (!this.loadFromPrefs()) {
        throw new Error("Translation API not configured");
      }
    }

    const targetLanguage =
      options?.targetLanguage || this.config!.targetLanguage;
    const sourceLanguage =
      options?.sourceLanguage || this.config!.sourceLanguage || "auto";

    if (this.config!.provider === "deepl") {
      return this.deeplTranslate(
        text,
        targetLanguage,
        sourceLanguage,
        options?.stream,
      );
    } else if (this.config!.provider === "google") {
      return this.googleTranslate(
        text,
        targetLanguage,
        sourceLanguage,
        options?.stream,
      );
    } else {
      return this.llmTranslate(
        text,
        targetLanguage,
        sourceLanguage,
        options?.stream,
      );
    }
  }

  /**
   * Translate using DeepL API
   */
  private static async deeplTranslate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    streamCallback?: TranslationStreamCallback,
  ): Promise<TranslationResult> {
    const apiKey = this.config!.apiKey;

    if (!apiKey) {
      throw new Error("DeepL API key not configured");
    }

    const targetLang = DEEPL_LANGUAGE_MAP[targetLanguage] || targetLanguage;
    const sourceLang =
      sourceLanguage === "auto"
        ? ""
        : DEEPL_LANGUAGE_MAP[sourceLanguage] || sourceLanguage;

    // DeepL API endpoint (use free API if API key ends with ":fx" otherwise pro)
    const isFreeApi = apiKey.endsWith(":fx");
    const baseUrl = isFreeApi
      ? "https://api-free.deepl.com/v2"
      : "https://api.deepl.com/v2";

    // For streaming, we'll simulate by chunking the response
    // DeepL doesn't support streaming in the same way, but we can provide a better UX
    if (streamCallback) {
      try {
        const response = await fetch(`${baseUrl}/translate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `DeepL-Auth-Key ${apiKey}`,
          },
          body: JSON.stringify({
            text: [text],
            target_lang: targetLang,
            source_lang: sourceLang || undefined,
            formality: "default",
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`DeepL API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as any;
        const translatedText = data.translations?.[0]?.text || "";

        // Simulate streaming by sending chunks
        const chunks = this.chunkText(translatedText, 20);
        for (const chunk of chunks) {
          await new Promise((resolve) => setTimeout(resolve, 30));
          streamCallback(chunk);
        }

        streamCallback.onComplete?.(translatedText);

        return {
          translatedText,
          detectedLanguage: data.translations?.[0]?.detected_source_language,
          provider: "deepl",
        };
      } catch (error) {
        streamCallback.onError?.(error as Error);
        throw error;
      }
    } else {
      const response = await fetch(`${baseUrl}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang,
          source_lang: sourceLang || undefined,
          formality: "default",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepL API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as any;
      const translatedText = data.translations?.[0]?.text || "";

      return {
        translatedText,
        detectedLanguage: data.translations?.[0]?.detected_source_language,
        provider: "deepl",
      };
    }
  }

  /**
   * Translate using Google Translate API
   */
  private static async googleTranslate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    streamCallback?: TranslationStreamCallback,
  ): Promise<TranslationResult> {
    const apiKey = this.config!.apiKey;

    if (!apiKey) {
      throw new Error("Google Translate API key not configured");
    }

    const targetLang =
      targetLanguage === "EN" ? "en" : targetLanguage.toLowerCase();
    const sourceLang =
      sourceLanguage === "auto"
        ? "auto"
        : sourceLanguage === "EN"
          ? "en"
          : sourceLanguage.toLowerCase();

    const url = new URL(
      "https://translation.googleapis.com/language/translate/v2",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", text);
    url.searchParams.set("target", targetLang);
    if (sourceLang !== "auto") {
      url.searchParams.set("source", sourceLang);
    }
    url.searchParams.set("format", "text");

    const response = await fetch(url.toString(), {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Google Translate API error: ${response.status} - ${error}`,
      );
    }

    const data = (await response.json()) as any;
    const translatedText = data.data?.translations?.[0]?.translatedText || "";

    if (streamCallback) {
      // Simulate streaming
      const chunks = this.chunkText(translatedText, 20);
      for (const chunk of chunks) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        streamCallback(chunk);
      }
      streamCallback.onComplete?.(translatedText);
    }

    return {
      translatedText,
      detectedLanguage: data.data?.translations?.[0]?.detectedSourceLanguage,
      provider: "google",
    };
  }

  /**
   * Translate using LLM API (fallback)
   */
  private static async llmTranslate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    streamCallback?: TranslationStreamCallback,
  ): Promise<TranslationResult> {
    // Build prompt based on source language
    const sourceLangName =
      sourceLanguage === "auto"
        ? "the original language"
        : this.getLanguageName(sourceLanguage);
    const targetLangName = this.getLanguageName(targetLanguage);

    const systemPrompt = `You are a professional academic translator. 
Your task is to translate the given text from ${sourceLangName} to ${targetLangName}.
Requirements:
1. Preserve the original meaning and nuance as accurately as possible
2. Maintain academic terminology correctly
3. Keep the same formatting and structure as much as possible
4. Only output the translated text, nothing else`;

    const userPrompt = `Translate the following text to ${targetLangName}:\n\n${text}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    if (streamCallback) {
      const result = await LLMAPI.streamChatWithCallbacks(messages, {
        onChunk: (chunk) => {
          streamCallback(chunk);
        },
        onComplete: (fullContent) => {
          streamCallback.onComplete?.(fullContent);
        },
        onError: (error) => {
          streamCallback.onError?.(error);
        },
      });

      return {
        translatedText: result.content,
        provider: "llm",
      };
    } else {
      const result = await LLMAPI.chat(messages);
      return {
        translatedText: result.content,
        provider: "llm",
      };
    }
  }

  /**
   * Get language name from code
   */
  private static getLanguageName(code: string): string {
    const lang = SUPPORTED_LANGUAGES.find(
      (l) => l.code === code || l.code.toLowerCase() === code.toLowerCase(),
    );
    return lang?.name || code;
  }

  /**
   * Chunk text for streaming simulation
   */
  private static chunkText(text: string, chunkSize: number): string[] {
    const words = text.split("");
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(""));
    }

    return chunks;
  }

  /**
   * Detect text language (simple heuristic)
   */
  public static detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    if (/[\u4e00-\u9fff]/.test(text)) return "ZH";
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "JA";
    if (/[\uac00-\ud7af]/.test(text)) return "KO";
    if (/[\u0400-\u04ff]/.test(text)) return "RU";
    if (/[\u0600-\u06ff]/.test(text)) return "AR";
    if (/[äöüß]/i.test(text)) return "DE";
    if (/[éèêëàâùûç]/i.test(text)) return "FR";
    if (/[áéíóúñ¿¡]/i.test(text)) return "ES";
    if (/[àèéìíòóù]/i.test(text)) return "IT";
    if (/[ãõç]/i.test(text)) return "PT";

    return "EN"; // Default to English
  }
}

/**
 * Initialize Translation API
 */
export function initTranslationAPI(): void {
  // Try to load config from preferences
  TranslationAPI.loadFromPrefs();

  if (typeof ztoolkit !== "undefined") {
    ztoolkit.log("Paper Copilot: Translation API module initialized");
  }
}
