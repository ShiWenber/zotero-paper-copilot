/**
 * Agent Runtime Framework - Main Agent Class
 * LLM-agnostic agent runtime with tool support
 */

import {
  AgentMessage,
  AgentRequest,
  AgentResponse,
  ToolCall,
  ToolDefinition,
  ToolHandler,
  ToolResult,
} from "./types";

export interface AgentConfig {
  systemPrompt?: string;
  maxIterations?: number;
}

const DEFAULT_MAX_ITERATIONS = 10;

/**
 * Agent runtime class.
 * Manages messages, tools, and orchestrates the agent loop.
 * LLM integration is delegated to callLLM() which should be implemented
 * by a concrete subclass or injected via config.
 */
export class Agent {
  private tools: Map<string, ToolDefinition> = new Map();
  private systemPrompt: string;
  private maxIterations: number;

  constructor(config: AgentConfig = {}) {
    this.systemPrompt =
      config.systemPrompt ??
      "You are a helpful AI assistant for Zotero Paper Copilot.";
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  }

  /**
   * Register a tool with the agent.
   */
  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get all registered tools as an array.
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by name.
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool by name.
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Process a single request and return a response.
   * Calls the LLM and handles tool execution in a loop.
   */
  async process(request: AgentRequest): Promise<AgentResponse> {
    return this.run(request);
  }

  /**
   * Main run loop: process messages, call tools, return response.
   * Handles tool call loops (agent -> tool -> agent -> tool...).
   */
  async run(request: AgentRequest): Promise<AgentResponse> {
    const messages: AgentMessage[] = [...request.messages];

    // Prepend system prompt if not already present
    if (messages.length === 0 || messages[0].role !== "system") {
      messages.unshift({
        role: "system",
        content: this.systemPrompt,
        timestamp: Date.now(),
      });
    }

    // Merge registered tools with request tools
    const allTools = new Map<string, ToolDefinition>(this.tools);
    if (request.tools) {
      for (const tool of request.tools) {
        if (!allTools.has(tool.name)) {
          allTools.set(tool.name, tool);
        }
      }
    }

    let iteration = 0;
    let lastResponse: AgentResponse | null = null;

    while (iteration < this.maxIterations) {
      iteration++;

      // Call the LLM
      const llmResponse = await this.callLLM(
        messages,
        Array.from(allTools.values()),
        request.context,
      );

      if (llmResponse.error) {
        return { content: "", error: llmResponse.error };
      }

      lastResponse = llmResponse;

      // If no tool calls, we're done
      if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
        return llmResponse;
      }

      // Handle tool calls and append results as tool messages
      const toolResults = await this.handleToolCalls(
        llmResponse.toolCalls,
        allTools,
        request.context,
      );

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: llmResponse.content,
        timestamp: Date.now(),
      });

      // Add tool result messages
      for (const result of toolResults) {
        messages.push({
          role: "tool",
          content: result.error ?? JSON.stringify(result.result),
          timestamp: Date.now(),
        });
      }
    }

    return {
      content: lastResponse?.content ?? "",
      error: `Max iterations (${this.maxIterations}) exceeded.`,
    };
  }

  /**
   * Handle a batch of tool calls.
   * Executes each tool handler and returns results.
   */
  async handleToolCalls(
    toolCalls: ToolCall[],
    tools: Map<string, ToolDefinition>,
    context?: Record<string, any>,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of toolCalls) {
      const tool = tools.get(call.name);
      if (!tool) {
        results.push({
          id: call.id,
          result: null,
          error: `Tool "${call.name}" not found.`,
        });
        continue;
      }

      try {
        const result = await tool.handler(call.arguments, context);
        results.push({ id: call.id, result });
      } catch (err: any) {
        results.push({
          id: call.id,
          result: null,
          error: err?.message ?? String(err),
        });
      }
    }

    return results;
  }

  /**
   * Call the underlying LLM.
   * This is a placeholder that should be overridden or injected.
   * Returns a partial AgentResponse with content and optional toolCalls.
   *
   * Override this method to integrate with specific LLM providers
   * (OpenAI, Anthropic, local models, etc.).
   */
  protected async callLLM(
    messages: AgentMessage[],
    tools: ToolDefinition[],
    context?: Record<string, any>,
  ): Promise<{ content: string; toolCalls?: ToolCall[]; error?: string }> {
    // Placeholder implementation
    // In production, this would call an actual LLM API
    console.warn(
      "[Agent] callLLM() not implemented. Returning empty response.",
    );
    return { content: "" };
  }
}

export default Agent;
