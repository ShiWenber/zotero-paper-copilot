/**
 * Zotero Paper Copilot - LLM API Module
 *
 * Handles LLM API calls with streaming support
 * Supports OpenAI-compatible APIs
 */

import { getPref, setPref } from "../utils/prefs";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface LLMResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: LLMMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }[];
}

export type StreamCallback = (
  chunk: StreamChunk,
  fullContent: string,
) => void | Promise<void>;

/**
 * Extended LLM API with provider support (from feature/translation)
 */
export type LLMProvider = "openai" | "anthropic";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ExtendedLLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ExtendedStreamCallback {
  (chunk: string): void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
  onChunk?: (chunk: string) => void;
}

export class LLMAPI {
  private static config: ExtendedLLMConfig | null = null;

  /**
   * Initialize LLM API with configuration
   */
  public static init(config: ExtendedLLMConfig): void {
    this.config = config;

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log(
        "Paper Copilot: LLM API initialized with provider:",
        config.provider,
      );
    }
  }

  /**
   * Get current configuration
   */
  public static getConfig(): ExtendedLLMConfig | null {
    return this.config;
  }

  /**
   * Load configuration from Zotero preferences
   */
  public static loadFromPrefs(): boolean {
    try {
      const provider = Zotero.Prefs.get("paper-copilot.llm-provider") as string;
      const apiKey = Zotero.Prefs.get("paper-copilot.llm-api-key") as string;
      const model = Zotero.Prefs.get("paper-copilot.llm-model") as string;

      if (provider && apiKey && model) {
        this.config = {
          provider: provider as LLMProvider,
          apiKey,
          model,
          maxTokens:
            (Zotero.Prefs.get("paper-copilot.llm-max-tokens") as number) ||
            2048,
          temperature:
            (Zotero.Prefs.get("paper-copilot.llm-temperature") as number) ||
            0.7,
        };

        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log("Paper Copilot: LLM config loaded from prefs");
        }
        return true;
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error loading LLM config:", e);
      }
    }
    return false;
  }

  /**
   * Save configuration to Zotero preferences
   */
  public static saveToPrefs(config: ExtendedLLMConfig): void {
    try {
      Zotero.Prefs.set("paper-copilot.llm-provider", config.provider);
      Zotero.Prefs.set("paper-copilot.llm-api-key", config.apiKey);
      Zotero.Prefs.set("paper-copilot.llm-model", config.model);
      Zotero.Prefs.set(
        "paper-copilot.llm-max-tokens",
        config.maxTokens || 2048,
      );
      Zotero.Prefs.set(
        "paper-copilot.llm-temperature",
        config.temperature || 0.7,
      );

      this.config = config;

      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: LLM config saved to prefs");
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error saving LLM config:", e);
      }
    }
  }

  /**
   * Check if API is configured
   */
  public static isConfigured(): boolean {
    return this.config !== null && this.config.apiKey !== "";
  }

  /**
   * Send chat completion request
   */
  public static async chat(
    messages: ChatMessage[],
    options?: {
      stream?: ExtendedStreamCallback;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<ExtendedLLMResponse> {
    if (!this.config) {
      throw new Error("LLM API not configured");
    }

    if (options?.stream) {
      return this.streamChat(messages, options.stream, options);
    }

    switch (this.config.provider) {
      case "openai":
        return this.openAIChat(messages, options);
      case "anthropic":
        return this.anthropicChat(messages, options);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Stream chat completion
   */
  public static async streamChat(
    messages: ChatMessage[],
    callback: ExtendedStreamCallback,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<ExtendedLLMResponse> {
    if (!this.config) {
      throw new Error("LLM API not configured");
    }

    switch (this.config.provider) {
      case "openai":
        return this.openAIStreamChat(messages, callback, options);
      case "anthropic":
        return this.anthropicStreamChat(messages, callback, options);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Stream chat completion with extended callback options
   */
  public static async streamChatWithCallbacks(
    messages: ChatMessage[],
    callbacks: {
      onChunk?: (chunk: string) => void;
      onComplete?: (fullContent: string) => void;
      onError?: (error: Error) => void;
    },
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<ExtendedLLMResponse> {
    const callback: ExtendedStreamCallback = (chunk: string) => {
      callbacks.onChunk?.(chunk);
    };
    callback.onComplete = callbacks.onComplete;
    callback.onError = callbacks.onError;

    return this.streamChat(messages, callback, options);
  }

  /**
   * OpenAI Chat API
   */
  private static async openAIChat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<ExtendedLLMResponse> {
    const config = this.config!;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || "",
      model: data.model,
      usage: data.usage,
    };
  }

  /**
   * OpenAI Streaming Chat API
   */
  private static async openAIStreamChat(
    messages: ChatMessage[],
    callback: ExtendedStreamCallback,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<ExtendedLLMResponse> {
    const config = this.config!;
    let fullContent = "";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
                callback(content);
                callback.onChunk?.(content);
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    callback.onComplete?.(fullContent);

    return {
      content: fullContent,
      model: config.model,
    };
  }

  /**
   * Anthropic Claude API
   */
  private static async anthropicChat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<ExtendedLLMResponse> {
    const config = this.config!;

    // Convert messages to Anthropic format
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        messages: userMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        system: systemMessage?.content,
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.content[0]?.text || "",
      model: data.model,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  /**
   * Anthropic Streaming Chat API
   */
  private static async anthropicStreamChat(
    messages: ChatMessage[],
    callback: ExtendedStreamCallback,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<ExtendedLLMResponse> {
    const config = this.config!;
    let fullContent = "";

    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        messages: userMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        system: systemMessage?.content,
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta") {
                const content = parsed.delta?.text;
                if (content) {
                  fullContent += content;
                  callback(content);
                  callback.onChunk?.(content);
                }
              } else if (parsed.type === "message_delta") {
                // Done
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    callback.onComplete?.(fullContent);

    return {
      content: fullContent,
      model: config.model,
    };
  }

  /**
   * Build context prompt for PDF/Q&A
   */
  public static buildContextPrompt(
    selectedText: string,
    context?: { title?: string; authors?: string[]; page?: number },
  ): ChatMessage[] {
    let systemPrompt = `You are a helpful academic research assistant helping the user understand a scientific paper. 
Provide clear, accurate, and concise explanations. 
When appropriate, explain technical terms and concepts.
If the question is about a specific part of the paper, refer to that part in your answer.`;

    if (context?.title) {
      systemPrompt += `\n\nThe user is reading: "${context.title}"`;
    }
    if (context?.authors?.length) {
      systemPrompt += `\nAuthors: ${context.authors.join(", ")}`;
    }
    if (context?.page) {
      systemPrompt += `\nCurrent page: ${context.page}`;
    }

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: selectedText },
    ];
  }
}

/**
 * Extended LLM API configuration (with provider support)
 */
export interface ExtendedLLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * LLM API configuration
 */
export interface LLMConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Get LLM configuration from preferences
 */
export function getLLMConfig(): LLMConfig {
  const prefs = {
    apiUrl:
      getPref("apiUrl") || "https://api.minimax.chat/v1/text/chatcompletion_v2",
    apiKey: getPref("apiKey") || "",
    model: getPref("model") || "abab6.5s-chat",
    temperature: getPref("temperature") ?? 0.7,
    maxTokens: getPref("maxTokens") ?? 4096,
  };

  return prefs;
}

/**
 * Update LLM configuration
 */
export function updateLLMConfig(config: Partial<LLMConfig>): void {
  if (config.apiUrl !== undefined) {
    setPref("apiUrl", config.apiUrl);
  }
  if (config.apiKey !== undefined) {
    setPref("apiKey", config.apiKey);
  }
  if (config.model !== undefined) {
    setPref("model", config.model);
  }
  if (config.temperature !== undefined) {
    setPref("temperature", config.temperature);
  }
  if (config.maxTokens !== undefined) {
    setPref("maxTokens", config.maxTokens);
  }
}

/**
 * Call LLM API (non-streaming)
 */
export async function callLLM(
  messages: LLMMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<LLMResponse> {
  const config = getLLMConfig();

  const request: LLMRequest = {
    model: options?.model || config.model,
    messages,
    stream: false,
    temperature: options?.temperature ?? config.temperature,
    max_tokens: options?.maxTokens ?? config.maxTokens,
  };

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as LLMResponse;
  return data;
}

/**
 * Call LLM API with streaming
 */
export async function* callLLMStream(
  messages: LLMMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): AsyncGenerator<StreamChunk> {
  const config = getLLMConfig();

  const request: LLMRequest = {
    model: options?.model || config.model,
    messages,
    stream: true,
    temperature: options?.temperature ?? config.temperature,
    max_tokens: options?.maxTokens ?? config.maxTokens,
  };

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error("LLM API response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) {
        continue;
      }

      const data = trimmed.slice(5).trim();

      if (data === "[DONE]") {
        return;
      }

      try {
        const chunk: StreamChunk = JSON.parse(data);
        yield chunk;
      } catch (e) {
        // Skip invalid JSON
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log("Paper Copilot: Failed to parse stream chunk:", e);
        }
      }
    }
  }
}

/**
 * Call LLM with streaming and callback
 */
export async function callLLMWithStream(
  messages: LLMMessage[],
  onChunk: StreamCallback,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  let fullContent = "";

  for await (const chunk of callLLMStream(messages, options)) {
    const content = chunk.choices[0]?.delta?.content || "";
    fullContent += content;

    const result = await onChunk(chunk, fullContent);
    // Allow callback to return false to stop streaming
    if (result === false) {
      break;
    }
  }

  return fullContent;
}
