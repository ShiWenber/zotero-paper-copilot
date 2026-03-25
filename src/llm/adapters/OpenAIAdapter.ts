/**
 * OpenAI-compatible LLM Adapter
 * Supports GPT-4, GPT-3.5-turbo, and other OpenAI-compatible APIs
 */

import {
  BaseLLMAdapter,
  LLMResponse,
  StreamingCallback,
} from "./base/BaseLLMAdapter";
import { AgentMessage, ToolCall, ToolDefinition } from "../../../agent/types";

export interface OpenAIAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface OpenAIMessage {
  role: string;
  content: string;
  name?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChoice {
  message: {
    role: string;
    content: string;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string;
}

interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
}

/**
 * OpenAI-compatible adapter using the Chat Completions API.
 * Supports streaming via Server-Sent Events (SSE).
 */
export class OpenAIAdapter extends BaseLLMAdapter {
  model = "gpt-4";
  apiKey: string;
  baseUrl: string;

  constructor(config: OpenAIAdapterConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model ?? this.model;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com";
  }

  supportsStreaming(): boolean {
    return true;
  }

  validateConfig(): boolean {
    return super.validateConfig() && Boolean(this.baseUrl);
  }

  /**
   * Send a completion request to OpenAI's Chat Completions API.
   */
  async complete(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    streaming?: StreamingCallback,
  ): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      return {
        content: "",
        finishReason: "error",
        error:
          "OpenAI adapter is not properly configured. Please provide an API key.",
      };
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    const body = this.buildRequestBody(messages, tools, Boolean(streaming));

    try {
      if (streaming && this.supportsStreaming()) {
        return await this.completeStreaming(url, body, streaming);
      }
      return await this.completeNonStreaming(url, body);
    } catch (err: any) {
      const errorMessage = err?.message ?? String(err);
      console.error("[OpenAIAdapter] Request failed:", errorMessage);
      return {
        content: "",
        finishReason: "error",
        error: `OpenAI API error: ${errorMessage}`,
      };
    }
  }

  /**
   * Build the request body for the Chat Completions API.
   */
  private buildRequestBody(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    stream?: boolean = false,
  ): object {
    const openAIMessages: OpenAIMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      ...(msg.role === "user" && "name" in msg
        ? { name: (msg as any).name }
        : {}),
    }));

    const body: Record<string, any> = {
      model: this.model,
      messages: openAIMessages,
      stream: stream ?? false,
    };

    // Add tool definitions if provided
    if (tools && tools.length > 0) {
      body.tools = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    return body;
  }

  /**
   * Handle non-streaming completion.
   */
  private async completeNonStreaming(
    url: string,
    body: object,
  ): Promise<LLMResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    return this.parseResponse(json);
  }

  /**
   * Handle streaming completion using SSE.
   */
  private async completeStreaming(
    url: string,
    body: object,
    streamingCallback: StreamingCallback,
  ): Promise<LLMResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("Response body is not available");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    const toolCalls: OpenAIToolCall[] = [];
    let finishReason: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const chunk = this.parseSSEChunk(line);
          if (chunk === null) continue;

          try {
            const parsed: OpenAIStreamChunk = JSON.parse(chunk);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
              streamingCallback(delta.content);
            }

            if (delta?.tool_calls) {
              // Ensure toolCalls array is large enough
              for (const tc of delta.tool_calls) {
                while (toolCalls.length <= tc.index) {
                  toolCalls.push({
                    id: "",
                    type: "function",
                    function: { name: "", arguments: "" },
                  });
                }
                const existing = toolCalls[tc.index];
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name)
                  existing.function.name = tc.function.name;
                if (tc.function?.arguments) {
                  existing.function.arguments += tc.function.arguments;
                  // Parse and re-serialize to ensure valid JSON
                  try {
                    JSON.parse(existing.function.arguments);
                  } catch {
                    // Arguments are incomplete, keep buffering
                  }
                }
              }
            }

            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Parse tool call arguments
    const parsedToolCalls: ToolCall[] = toolCalls
      .filter((tc) => tc.id && tc.function.name)
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.parseArguments(tc.function.arguments),
      }));

    return {
      content: fullContent,
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
      finishReason: (finishReason as LLMResponse["finishReason"]) ?? "stop",
    };
  }

  /**
   * Parse a single SSE data line.
   * @param line The SSE line (e.g., "data: {\"choices\":[...]}")
   * @returns The JSON string without the "data: " prefix, or null if not a data line
   */
  private parseSSEChunk(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return null;
    const data = trimmed.slice(6).trim();
    if (data === "[DONE]") return null;
    return data;
  }

  /**
   * Parse tool call arguments from a JSON string.
   */
  private parseArguments(args: string): Record<string, any> {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }

  /**
   * Parse a non-streaming API response.
   */
  private parseResponse(json: any): LLMResponse {
    const choice: OpenAIChoice = json.choices?.[0];
    if (!choice) {
      return {
        content: "",
        finishReason: "error",
        error: "Invalid response format: no choices in response",
      };
    }

    const toolCalls: ToolCall[] = (choice.message?.tool_calls ?? [])
      .filter((tc) => tc.id && tc.function?.name)
      .map((tc: OpenAIToolCall) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.parseArguments(tc.function.arguments),
      }));

    return {
      content: choice.message?.content ?? "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice.finish_reason as LLMResponse["finishReason"],
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }
}
