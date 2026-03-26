/**
 * Unit tests for Agent Runtime Types
 * Tests type definitions and interfaces for the agent framework
 */

import { assert } from "chai";
/* eslint-disable mocha/max-top-level-suites */
import {
  AgentMessage,
  ToolCall,
  ToolResult,
  ToolDefinition,
  AgentRequest,
  AgentResponse,
  ToolHandler,
} from "../../src/agent/types";

describe("AgentMessage", function () {
  it("should create a valid user message", function () {
    const msg: AgentMessage = { role: "user", content: "Hello" };
    assert.equal(msg.role, "user");
    assert.equal(msg.content, "Hello");
    assert.isUndefined(msg.toolCallId);
    assert.isUndefined(msg.timestamp);
  });

  it("should create a valid assistant message", function () {
    const msg: AgentMessage = { role: "assistant", content: "How can I help?" };
    assert.equal(msg.role, "assistant");
    assert.equal(msg.content, "How can I help?");
  });

  it("should create a valid system message", function () {
    const msg: AgentMessage = { role: "system", content: "You are helpful." };
    assert.equal(msg.role, "system");
    assert.equal(msg.content, "You are helpful.");
  });

  it("should support tool role with toolCallId", function () {
    const msg: AgentMessage = {
      role: "tool",
      content: "Tool result",
      toolCallId: "call_123",
    };
    assert.equal(msg.role, "tool");
    assert.equal(msg.toolCallId, "call_123");
    assert.equal(msg.content, "Tool result");
  });

  it("should support optional timestamp", function () {
    const timestamp = Date.now();
    const msg: AgentMessage = {
      role: "user",
      content: "Hello",
      timestamp,
    };
    assert.equal(msg.timestamp, timestamp);
  });

  it("should allow empty content", function () {
    const msg: AgentMessage = { role: "user", content: "" };
    assert.equal(msg.content, "");
  });
});

describe("ToolCall", function () {
  it("should create a valid tool call", function () {
    const call: ToolCall = {
      id: "call_1",
      name: "search_papers",
      arguments: { query: "machine learning" },
    };
    assert.equal(call.id, "call_1");
    assert.equal(call.name, "search_papers");
    assert.deepEqual(call.arguments, { query: "machine learning" });
  });

  it("should support empty arguments", function () {
    const call: ToolCall = {
      id: "call_2",
      name: "noop_tool",
      arguments: {},
    };
    assert.deepEqual(call.arguments, {});
  });

  it("should support complex nested arguments", function () {
    const call: ToolCall = {
      id: "call_3",
      name: "complex_tool",
      arguments: {
        items: [
          { id: 1, name: "item1" },
          { id: 2, name: "item2" },
        ],
        config: { nested: { deep: true } },
      },
    };
    assert.isArray(call.arguments.items);
    assert.equal(call.arguments.items.length, 2);
    assert.isTrue(call.arguments.config.nested.deep);
  });

  it("should support various argument types", function () {
    const call: ToolCall = {
      id: "call_4",
      name: "mixed_args",
      arguments: {
        str: "string",
        num: 42,
        bool: true,
        null: null,
        array: [1, 2, 3],
      },
    };
    assert.equal(call.arguments.str, "string");
    assert.equal(call.arguments.num, 42);
    assert.isTrue(call.arguments.bool);
    assert.isNull(call.arguments.null);
    assert.deepEqual(call.arguments.array, [1, 2, 3]);
  });
});

describe("ToolResult", function () {
  it("should create a valid successful tool result", function () {
    const result: ToolResult = {
      id: "call_1",
      result: { found: 5 },
    };
    assert.equal(result.id, "call_1");
    assert.deepEqual(result.result, { found: 5 });
    assert.isUndefined(result.error);
  });

  it("should create a valid error tool result", function () {
    const result: ToolResult = {
      id: "call_2",
      result: null,
      error: "Tool execution failed",
    };
    assert.equal(result.id, "call_2");
    assert.isNull(result.result);
    assert.equal(result.error, "Tool execution failed");
  });

  it("should support string result", function () {
    const result: ToolResult = {
      id: "call_3",
      result: "Simple string result",
    };
    assert.equal(result.result, "Simple string result");
  });

  it("should support array result", function () {
    const result: ToolResult = {
      id: "call_4",
      result: [{ id: 1 }, { id: 2 }],
    };
    assert.isArray(result.result);
    assert.equal(result.result.length, 2);
  });
});

describe("ToolDefinition", function () {
  it("should create a valid tool definition", function () {
    const handler: ToolHandler = async () => ({ success: true });
    const tool: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      parameters: { type: "object", properties: {} },
      handler,
    };
    assert.equal(tool.name, "test_tool");
    assert.equal(tool.description, "A test tool");
    assert.deepEqual(tool.parameters, { type: "object", properties: {} });
    assert.isFunction(tool.handler);
  });

  it("should create tool definition with empty parameters", function () {
    const handler: ToolHandler = async () => "done";
    const tool: ToolDefinition = {
      name: "simple_tool",
      description: "Simple tool",
      parameters: [],
      handler,
    };
    assert.deepEqual(tool.parameters, []);
  });

  it("should support complex parameter schema", function () {
    const handler: ToolHandler = async (args) => args;
    const schema = {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" },
        filters: {
          type: "object",
          properties: {
            year: { type: "number" },
            author: { type: "string" },
          },
        },
      },
      required: ["query"],
    };
    const tool: ToolDefinition = {
      name: "search_tool",
      description: "Search for papers",
      parameters: schema,
      handler,
    };
    assert.equal(tool.parameters.type, "object");
    assert.isArray(tool.parameters.required);
    assert.equal(tool.parameters.required[0], "query");
  });
});

describe("AgentRequest", function () {
  it("should create a valid request with messages only", function () {
    const request: AgentRequest = {
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    };
    assert.lengthOf(request.messages, 2);
    assert.isUndefined(request.tools);
    assert.isUndefined(request.context);
  });

  it("should create a valid request with tools", function () {
    const tool: ToolDefinition = {
      name: "tool1",
      description: "A tool",
      parameters: {},
      handler: async () => "result",
    };
    const request: AgentRequest = {
      messages: [{ role: "user", content: "Use a tool" }],
      tools: [tool],
    };
    assert.lengthOf(request.tools, 1);
    assert.equal(request.tools[0].name, "tool1");
  });

  it("should create a valid request with context", function () {
    const request: AgentRequest = {
      messages: [{ role: "user", content: "Hello" }],
      context: { userId: "user_123", sessionId: "sess_456" },
    };
    assert.equal(request.context.userId, "user_123");
    assert.equal(request.context.sessionId, "sess_456");
  });

  it("should create a valid request with all fields", function () {
    const tool: ToolDefinition = {
      name: "full_tool",
      description: "Full tool",
      parameters: {},
      handler: async () => "done",
    };
    const request: AgentRequest = {
      messages: [{ role: "user", content: "Hello" }],
      tools: [tool],
      context: { key: "value" },
    };
    assert.lengthOf(request.messages, 1);
    assert.lengthOf(request.tools, 1);
    assert.deepEqual(request.context, { key: "value" });
  });

  it("should allow empty messages array", function () {
    const request: AgentRequest = {
      messages: [],
    };
    assert.lengthOf(request.messages, 0);
  });
});

describe("AgentResponse", function () {
  it("should create a valid text response", function () {
    const response: AgentResponse = {
      content: "Here is your answer.",
    };
    assert.equal(response.content, "Here is your answer.");
    assert.isUndefined(response.toolCalls);
    assert.isUndefined(response.error);
  });

  it("should create a response with tool calls", function () {
    const response: AgentResponse = {
      content: "Let me search for that.",
      toolCalls: [{ id: "call_1", name: "search", arguments: { q: "test" } }],
    };
    assert.equal(response.content, "Let me search for that.");
    assert.lengthOf(response.toolCalls, 1);
    assert.equal(response.toolCalls[0].name, "search");
  });

  it("should create an error response", function () {
    const response: AgentResponse = {
      content: "",
      error: "Something went wrong",
    };
    assert.equal(response.content, "");
    assert.equal(response.error, "Something went wrong");
  });

  it("should create response with multiple tool calls", function () {
    const response: AgentResponse = {
      content: "I'll do multiple things.",
      toolCalls: [
        { id: "call_1", name: "tool1", arguments: {} },
        { id: "call_2", name: "tool2", arguments: { x: 1 } },
        { id: "call_3", name: "tool3", arguments: {} },
      ],
    };
    assert.lengthOf(response.toolCalls, 3);
  });
});

describe("ToolHandler type", function () {
  it("should accept handler with no context", async function () {
    const handler: ToolHandler = async (args) => {
      return { received: args };
    };
    const result = await handler({ key: "value" });
    assert.deepEqual(result, { received: { key: "value" } });
  });

  it("should accept handler with context", async function () {
    const handler: ToolHandler = async (args, context) => {
      return { args, context };
    };
    const ctx = { userId: "123" };
    const result = await handler({ key: "value" }, ctx);
    assert.deepEqual(result.args, { key: "value" });
    assert.deepEqual(result.context, ctx);
  });

  it("should accept async handler that throws", async function () {
    const handler: ToolHandler = async () => {
      throw new Error("Handler error");
    };
    try {
      await handler({});
      assert.fail("Should have thrown");
    } catch (err: any) {
      assert.equal(err.message, "Handler error");
    }
  });
});
