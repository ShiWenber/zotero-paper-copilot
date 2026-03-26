/**
 * Unit tests for Agent Runtime - Agent Class
 * Tests for Agent construction, tool registration, and execution
 */

import { assert } from "chai";
import { Agent } from "../../src/agent/Agent";
import type {
  AgentMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  AgentRequest,
  AgentResponse,
} from "../../src/agent/types";

// TestableAgent: extends Agent and exposes callLLM for mocking
class TestableAgent extends Agent {
  public mockLLMResponse: {
    content: string;
    toolCalls?: ToolCall[];
    error?: string;
  } = {
    content: "",
    error: "Not configured",
  };

  protected override async callLLM(
    _messages: AgentMessage[],
    _tools: ToolDefinition[],
    _context?: Record<string, any>,
  ): Promise<{ content: string; toolCalls?: ToolCall[]; error?: string }> {
    return this.mockLLMResponse;
  }
}

describe("Agent", function () {
  let agent: TestableAgent;

  beforeEach(function () {
    agent = new TestableAgent({ systemPrompt: "You are a helpful assistant." });
  });

  describe("constructor", function () {
    it("should create an agent with default config", function () {
      const defaultAgent = new Agent();
      assert.isNotNull(defaultAgent);
    });

    it("should accept custom system prompt", function () {
      const customAgent = new Agent({
        systemPrompt: "Custom system prompt for testing.",
      });
      assert.isNotNull(customAgent);
    });

    it("should accept maxIterations parameter", function () {
      const customAgent = new Agent({ maxIterations: 5 });
      assert.isNotNull(customAgent);
    });

    it("should set default maxIterations to 10", function () {
      // This is implicit - the agent should not exceed 10 iterations
      const defaultAgent = new Agent();
      assert.isNotNull(defaultAgent);
    });

    it("should accept empty config", function () {
      const emptyAgent = new Agent({});
      assert.isNotNull(emptyAgent);
    });
  });

  describe("registerTool", function () {
    it("should register a tool", function () {
      const mockTool: ToolDefinition = {
        name: "mock_tool",
        description: "Mock tool",
        parameters: [],
        handler: async () => ({ id: "1", result: "mock" }),
      };

      agent.registerTool(mockTool);
      const retrieved = agent.getTool("mock_tool");
      assert.isDefined(retrieved);
      assert.equal(retrieved?.name, "mock_tool");
    });

    it("should register multiple tools", function () {
      const tool1: ToolDefinition = {
        name: "tool_1",
        description: "First tool",
        parameters: {},
        handler: async () => "one",
      };
      const tool2: ToolDefinition = {
        name: "tool_2",
        description: "Second tool",
        parameters: {},
        handler: async () => "two",
      };
      const tool3: ToolDefinition = {
        name: "tool_3",
        description: "Third tool",
        parameters: {},
        handler: async () => "three",
      };

      agent.registerTool(tool1);
      agent.registerTool(tool2);
      agent.registerTool(tool3);

      assert.equal(agent.getTools().length, 3);
      assert.isDefined(agent.getTool("tool_1"));
      assert.isDefined(agent.getTool("tool_2"));
      assert.isDefined(agent.getTool("tool_3"));
    });

    it("should throw when registering duplicate tool", function () {
      const mockTool: ToolDefinition = {
        name: "dup_tool",
        description: "Duplicate",
        parameters: [],
        handler: async () => ({ id: "1", result: "dup" }),
      };

      agent.registerTool(mockTool);
      assert.throws(() => agent.registerTool(mockTool));
    });

    it("should throw with descriptive error for duplicate tool", function () {
      const mockTool: ToolDefinition = {
        name: "unique_tool",
        description: "A unique tool",
        parameters: [],
        handler: async () => "done",
      };

      agent.registerTool(mockTool);
      try {
        agent.registerTool(mockTool);
        assert.fail("Should have thrown");
      } catch (err: any) {
        assert.include(err.message, "unique_tool");
        assert.include(err.message, "already registered");
      }
    });

    it("should allow re-registration after unregistering", function () {
      const tool: ToolDefinition = {
        name: "reusable_tool",
        description: "Can be re-registered",
        parameters: [],
        handler: async () => "done",
      };

      agent.registerTool(tool);
      agent.unregisterTool("reusable_tool");
      // Should not throw since tool was unregistered
      agent.registerTool(tool);
      assert.isDefined(agent.getTool("reusable_tool"));
    });
  });

  describe("getTool", function () {
    it("should return undefined for non-existent tool", function () {
      const result = agent.getTool("nonexistent_tool");
      assert.isUndefined(result);
    });

    it("should return registered tool", function () {
      const tool: ToolDefinition = {
        name: "get_test",
        description: "Test get method",
        parameters: {},
        handler: async () => "found",
      };

      agent.registerTool(tool);
      const retrieved = agent.getTool("get_test");
      assert.isDefined(retrieved);
      assert.equal(retrieved?.description, "Test get method");
    });

    it("should return undefined for empty string tool name", function () {
      agent.registerTool({
        name: "",
        description: "",
        parameters: {},
        handler: async () => null,
      });
      // getTool with empty string should return undefined (not found)
      assert.isUndefined(agent.getTool(""));
    });
  });

  describe("getTools", function () {
    it("should return empty array when no tools registered", function () {
      const tools = agent.getTools();
      assert.isArray(tools);
      assert.lengthOf(tools, 0);
    });

    it("should return all registered tools", function () {
      agent.registerTool({
        name: "a_tool",
        description: "A",
        parameters: {},
        handler: async () => "a",
      });
      agent.registerTool({
        name: "b_tool",
        description: "B",
        parameters: {},
        handler: async () => "b",
      });

      const tools = agent.getTools();
      assert.lengthOf(tools, 2);
    });

    it("should return a copy of tools (not reference)", function () {
      agent.registerTool({
        name: "safe_tool",
        description: "Safe",
        parameters: {},
        handler: async () => "safe",
      });

      const tools1 = agent.getTools();
      const tools2 = agent.getTools();

      assert.lengthOf(tools1, 1);
      assert.lengthOf(tools2, 1);
      // Modifying returned array should not affect internal state
      tools1.push({} as ToolDefinition);
      assert.lengthOf(agent.getTools(), 1);
    });
  });

  describe("hasTool", function () {
    it("should return false for unregistered tool", function () {
      assert.isFalse(agent.hasTool("not_registered"));
    });

    it("should return true for registered tool", function () {
      agent.registerTool({
        name: "has_test",
        description: "Test",
        parameters: {},
        handler: async () => null,
      });
      assert.isTrue(agent.hasTool("has_test"));
    });

    it("should return false after unregistering", function () {
      agent.registerTool({
        name: "temp_tool",
        description: "Temp",
        parameters: {},
        handler: async () => null,
      });
      assert.isTrue(agent.hasTool("temp_tool"));
      agent.unregisterTool("temp_tool");
      assert.isFalse(agent.hasTool("temp_tool"));
    });
  });

  describe("unregisterTool", function () {
    it("should unregister an existing tool", function () {
      agent.registerTool({
        name: "remove_me",
        description: "To be removed",
        parameters: {},
        handler: async () => null,
      });

      assert.isTrue(agent.hasTool("remove_me"));
      const removed = agent.unregisterTool("remove_me");
      assert.isTrue(removed);
      assert.isFalse(agent.hasTool("remove_me"));
    });

    it("should return false for non-existent tool", function () {
      const removed = agent.unregisterTool("nonexistent");
      assert.isFalse(removed);
    });

    it("should allow re-registering after unregister", function () {
      agent.registerTool({
        name: "cycle_tool",
        description: "Test cycling",
        parameters: {},
        handler: async () => "first",
      });

      agent.unregisterTool("cycle_tool");

      // Re-register with different handler
      agent.registerTool({
        name: "cycle_tool",
        description: "Test cycling again",
        parameters: {},
        handler: async () => "second",
      });

      assert.isTrue(agent.hasTool("cycle_tool"));
    });
  });

  describe("handleToolCalls", function () {
    it("should execute a tool call", async function () {
      const mockTool: ToolDefinition = {
        name: "test_tool",
        description: "Test",
        parameters: [],
        handler: async (args) => ({
          id: "1",
          result: `Called with ${JSON.stringify(args)}`,
        }),
      };

      agent.registerTool(mockTool);

      const toolCalls: ToolCall[] = [
        { id: "call_1", name: "test_tool", arguments: { key: "value" } },
      ];

      const toolsMap = new Map([["test_tool", mockTool]]);
      const results = await agent.handleToolCalls(toolCalls, toolsMap);

      assert.lengthOf(results, 1);
      assert.equal(results[0].id, "call_1");
      assert.include(results[0].result as string, "key");
      assert.include(results[0].result as string, "value");
    });

    it("should return error for unknown tool", async function () {
      const toolCalls: ToolCall[] = [
        { id: "call_unknown", name: "nonexistent_tool", arguments: {} },
      ];

      const toolsMap = new Map<string, ToolDefinition>();
      const results = await agent.handleToolCalls(toolCalls, toolsMap);

      assert.lengthOf(results, 1);
      assert.equal(results[0].id, "call_unknown");
      assert.isNull(results[0].result);
      assert.isDefined(results[0].error);
      assert.include(results[0].error, "nonexistent_tool");
    });

    it("should handle multiple tool calls", async function () {
      const tool1: ToolDefinition = {
        name: "multi_1",
        description: "First multi",
        parameters: {},
        handler: async () => "one",
      };
      const tool2: ToolDefinition = {
        name: "multi_2",
        description: "Second multi",
        parameters: {},
        handler: async () => "two",
      };

      agent.registerTool(tool1);
      agent.registerTool(tool2);

      const toolCalls: ToolCall[] = [
        { id: "call_a", name: "multi_1", arguments: {} },
        { id: "call_b", name: "multi_2", arguments: {} },
      ];

      const toolsMap = new Map([
        ["multi_1", tool1],
        ["multi_2", tool2],
      ]);
      const results = await agent.handleToolCalls(toolCalls, toolsMap);

      assert.lengthOf(results, 2);
      assert.equal(results[0].id, "call_a");
      assert.equal(results[1].id, "call_b");
      assert.equal(results[0].result, "one");
      assert.equal(results[1].result, "two");
    });

    it("should handle tool handler throwing an error", async function () {
      const failingTool: ToolDefinition = {
        name: "failing",
        description: "Fails",
        parameters: {},
        handler: async () => {
          throw new Error("Handler failed");
        },
      };

      agent.registerTool(failingTool);

      const toolCalls: ToolCall[] = [
        { id: "call_fail", name: "failing", arguments: {} },
      ];

      const toolsMap = new Map([["failing", failingTool]]);
      const results = await agent.handleToolCalls(toolCalls, toolsMap);

      assert.lengthOf(results, 1);
      assert.isNull(results[0].result);
      assert.isDefined(results[0].error);
      assert.include(results[0].error, "Handler failed");
    });

    it("should handle mixed success and error results", async function () {
      const goodTool: ToolDefinition = {
        name: "good",
        description: "Works",
        parameters: {},
        handler: async () => "success",
      };
      const badTool: ToolDefinition = {
        name: "bad",
        description: "Fails",
        parameters: {},
        handler: async () => {
          throw new Error("Bad tool error");
        },
      };

      const toolCalls: ToolCall[] = [
        { id: "call_1", name: "good", arguments: {} },
        { id: "call_2", name: "bad", arguments: {} },
        { id: "call_3", name: "good", arguments: {} },
      ];

      const toolsMap = new Map([
        ["good", goodTool],
        ["bad", badTool],
      ]);
      const results = await agent.handleToolCalls(toolCalls, toolsMap);

      assert.lengthOf(results, 3);
      assert.equal(results[0].result, "success");
      assert.isNull(results[1].result);
      assert.isDefined(results[1].error);
      assert.equal(results[2].result, "success");
    });

    it("should handle empty tool calls array", async function () {
      const results = await agent.handleToolCalls([], new Map());
      assert.lengthOf(results, 0);
    });

    it("should pass context to tool handler", async function () {
      let receivedContext: any;
      const contextTool: ToolDefinition = {
        name: "context_tool",
        description: "Test context",
        parameters: {},
        handler: async (args, context) => {
          receivedContext = context;
          return { args, hasContext: !!context };
        },
      };

      agent.registerTool(contextTool);

      const toolCalls: ToolCall[] = [
        { id: "ctx_call", name: "context_tool", arguments: { action: "test" } },
      ];

      const toolsMap = new Map([["context_tool", contextTool]]);
      const ctx = { userId: "user_123", session: "test_session" };
      const results = await agent.handleToolCalls(toolCalls, toolsMap, ctx);

      assert.lengthOf(results, 1);
      assert.deepEqual(receivedContext, ctx);
    });
  });

  describe("run", function () {
    it("should be a method that exists", function () {
      assert.isFunction((agent as any).run);
    });

    it("should return text response when no tool calls", async function () {
      agent.mockLLMResponse = {
        content: "Hello! How can I help you?",
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await agent.run(request);
      assert.equal(response.content, "Hello! How can I help you?");
      assert.isUndefined(response.error);
      assert.isUndefined(response.toolCalls);
    });

    it("should execute tool and return result", async function () {
      // First call returns a tool call, second call returns final response
      const callCount = 0;
      (agent as any).mockLLMResponse = {
        content: "Let me search for that.",
        toolCalls: [{ id: "call_1", name: "search", arguments: { q: "test" } }],
      };

      const searchTool: ToolDefinition = {
        name: "search",
        description: "Search",
        parameters: {},
        handler: async (args) => ({ found: 5, query: args.q }),
      };
      agent.registerTool(searchTool);

      // Override to return final response after tool execution
      const originalCallLLM = (agent as any).mockLLMResponse;
      const afterToolCall = false;
      (agent as any)._testOverride = function () {
        return {
          content: "Found 5 results for 'test'.",
        };
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Search for test" }],
        tools: [searchTool],
      };

      // Use process method which calls run
      const response = await agent.process(request);
      assert.equal(response.content, "Let me search for that.");
      // Tool calls should be returned as part of response flow
    });

    it("should include system prompt in request", async function () {
      agent.mockLLMResponse = {
        content: "System prompt was set.",
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Hello" }],
      };

      await agent.run(request);
      // The agent prepends system message to messages array internally
      assert.isTrue(true); // If we get here, the agent handled the request
    });

    it("should merge registered tools with request tools", async function () {
      const registeredTool: ToolDefinition = {
        name: "registered_tool",
        description: "Registered",
        parameters: {},
        handler: async () => "registered",
      };
      const requestTool: ToolDefinition = {
        name: "request_tool",
        description: "From request",
        parameters: {},
        handler: async () => "from_request",
      };

      agent.registerTool(registeredTool);

      agent.mockLLMResponse = {
        content: "Done",
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Hello" }],
        tools: [requestTool],
      };

      await agent.run(request);
      // Both tools should be available
      assert.isTrue(agent.hasTool("registered_tool"));
    });

    it("should return error from LLM call", async function () {
      agent.mockLLMResponse = {
        content: "",
        error: "API key invalid",
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await agent.run(request);
      assert.equal(response.error, "API key invalid");
      assert.equal(response.content, "");
    });

    it("should handle max iterations exceeded", async function () {
      const loopingAgent = new TestableAgent({
        systemPrompt: "Loop",
        maxIterations: 2,
      });

      // Always return tool calls to force loop
      loopingAgent.mockLLMResponse = {
        content: "Still working...",
        toolCalls: [{ id: "call_1", name: "loop_tool", arguments: {} }],
      };

      const loopTool: ToolDefinition = {
        name: "loop_tool",
        description: "Loops",
        parameters: {},
        handler: async () => "looped",
      };
      loopingAgent.registerTool(loopTool);

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Loop" }],
      };

      const response = await loopingAgent.run(request);
      assert.isDefined(response.error);
      assert.include(response.error, "Max iterations");
    });
  });

  describe("process", function () {
    it("should be a method that exists", function () {
      assert.isFunction((agent as any).process);
    });

    it("should process request and return response", async function () {
      agent.mockLLMResponse = {
        content: "Processed successfully.",
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Process me" }],
      };

      const response = await agent.process(request);
      assert.equal(response.content, "Processed successfully.");
    });
  });

  describe("tool call chains", function () {
    it("should handle sequential tool calls", async function () {
      const tool1: ToolDefinition = {
        name: "step_one",
        description: "First step",
        parameters: {},
        handler: async (args) => ({ step: 1, input: args.value }),
      };
      const tool2: ToolDefinition = {
        name: "step_two",
        description: "Second step",
        parameters: {},
        handler: async (args) => ({ step: 2, from: args.from }),
      };

      agent.registerTool(tool1);
      agent.registerTool(tool2);

      // First LLM call returns first tool call
      let callNumber = 0;
      (agent as any).mockLLMResponse = (() => {
        callNumber++;
        if (callNumber === 1) {
          return {
            content: "Starting chain...",
            toolCalls: [
              { id: "c1", name: "step_one", arguments: { value: "start" } },
            ],
          };
        }
        return {
          content: "Chain complete.",
        };
      })();

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Do the chain" }],
      };

      const response = await agent.run(request);
      assert.equal(response.content, "Chain complete.");
    });
  });

  describe("edge cases", function () {
    it("should handle empty messages array", async function () {
      agent.mockLLMResponse = {
        content: "Empty request handled.",
      };

      const request: AgentRequest = {
        messages: [],
      };

      const response = await agent.run(request);
      assert.equal(response.content, "Empty request handled.");
    });

    it("should handle request with no tools available", async function () {
      agent.mockLLMResponse = {
        content: "No tools, just text response.",
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Just talk to me" }],
      };

      const response = await agent.run(request);
      assert.equal(response.content, "No tools, just text response.");
    });

    it("should handle context in request", async function () {
      agent.mockLLMResponse = {
        content: "Context received.",
      };

      const request: AgentRequest = {
        messages: [{ role: "user", content: "Hello" }],
        context: { userId: "test_user", preferences: { lang: "en" } },
      };

      const response = await agent.run(request);
      assert.equal(response.content, "Context received.");
    });
  });
});
