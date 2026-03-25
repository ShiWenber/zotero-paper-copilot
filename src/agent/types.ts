/**
 * Agent Runtime Framework - Type Definitions
 * LLM-agnostic agent framework for Zotero Paper Copilot
 */

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  id: string;
  result: any;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  handler: ToolHandler;
}

export type ToolHandler = (
  args: Record<string, any>,
  context?: Record<string, any>,
) => Promise<any>;

export interface AgentRequest {
  messages: AgentMessage[];
  tools?: ToolDefinition[];
  context?: Record<string, any>;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  error?: string;
}
