/**
 * Zotero Paper Copilot - LLM API Module
 * 
 * Handles LLM API calls with streaming support
 * Supports OpenAI-compatible APIs
 */

import { Preference } from "zotero-plugin-toolkit";

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

export type StreamCallback = (chunk: StreamChunk, fullContent: string) => void | Promise<void>;

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
    apiUrl: new Preference("apiUrl").get("https://api.minimax.chat/v1/text/chatcompletion_v2"),
    apiKey: new Preference("apiKey").get(""),
    model: new Preference("model").get("abab6.5s-chat"),
    temperature: new Preference("temperature").get(0.7),
    maxTokens: new Preference("maxTokens").get(4096),
  };

  return prefs;
}

/**
 * Update LLM configuration
 */
export function updateLLMConfig(config: Partial<LLMConfig>): void {
  if (config.apiUrl !== undefined) {
    new Preference("apiUrl").set(config.apiUrl);
  }
  if (config.apiKey !== undefined) {
    new Preference("apiKey").set(config.apiKey);
  }
  if (config.model !== undefined) {
    new Preference("model").set(config.model);
  }
  if (config.temperature !== undefined) {
    new Preference("temperature").set(config.temperature);
  }
  if (config.maxTokens !== undefined) {
    new Preference("maxTokens").set(config.maxTokens);
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
  }
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
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  return response.json();
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
  }
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
      "Authorization": `Bearer ${config.apiKey}`,
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
  }
): Promise<string> {
  let fullContent = "";
  
  for await (const chunk of callLLMStream(messages, options)) {
    const content = chunk.choices[0]?.delta?.content || "";
    fullContent += content;
    
    const result = await onChunk(chunk, fullContent);
    // Allow callback to control flow
    if (result === false) {
      break;
    }
  }
  
  return fullContent;
}
