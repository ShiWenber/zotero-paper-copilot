/**
 * Unit tests for SidebarAgentIntegrator
 * Tests interface and structure (full integration requires Zotero runtime)
 *
 * Note: MockAgent is a private class within SidebarAgentIntegrator.ts and
 * is not exported. These tests focus on what is actually exported.
 */

import { assert } from "chai";
/* eslint-disable mocha/max-top-level-suites */
import { Agent } from "../../src/agent/Agent";
import { SidebarAgentIntegrator } from "../../src/integration/SidebarAgentIntegrator";

describe("SidebarAgentIntegrator", function () {
  describe("export", function () {
    it("should be exported as a class constructor", function () {
      assert.isFunction(SidebarAgentIntegrator);
    });

    it("should have a prototype", function () {
      assert.isObject(SidebarAgentIntegrator.prototype);
    });
  });

  describe("interface - public methods", function () {
    it("should have initialize method", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.initialize);
    });

    it("should have handleAskAI method", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.handleAskAI);
    });

    it("should have handleSummarize method", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.handleSummarize);
    });

    it("should have handleTranslate method", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.handleTranslate);
    });

    it("should have handleSelectedText method", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.handleSelectedText);
    });

    it("should have syncNotes method", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.syncNotes);
    });

    it("should have getChatHistory method", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.getChatHistory);
    });
  });

  describe("interface - private method references", function () {
    it("should have both ask and summarize handlers", function () {
      const prototype = SidebarAgentIntegrator.prototype;
      assert.isFunction(prototype.handleAskAI);
      assert.isFunction(prototype.handleSummarize);
    });

    it("should have both ask and translate handlers", function () {
      const prototype = SidebarAgentIntegrator.prototype;
      assert.isFunction(prototype.handleAskAI);
      assert.isFunction(prototype.handleTranslate);
    });

    it("should have selected text handler that dispatches to ask or translate", function () {
      const prototype = SidebarAgentIntegrator.prototype;
      assert.isFunction(prototype.handleSelectedText);
    });
  });

  describe("chat history interface", function () {
    it("getChatHistory should be a function on the prototype", function () {
      assert.isFunction(SidebarAgentIntegrator.prototype.getChatHistory);
    });
  });
});

describe("SidebarAgentIntegrator internal MockAgent", function () {
  // MockAgent is a private class used internally by SidebarAgentIntegrator.
  // These tests verify the Agent base class behavior that MockAgent relies on.

  describe("Agent base class", function () {
    it("should support tool registration", function () {
      const agent = new Agent();

      agent.registerTool({
        name: "test_tool",
        description: "A test tool",
        parameters: {},
        handler: async () => ({ id: "1", result: "test" }),
      });

      assert.isTrue(agent.hasTool("test_tool"));
    });

    it("should allow unregistering tools", function () {
      const agent = new Agent();

      agent.registerTool({
        name: "temp_tool",
        description: "Temporary",
        parameters: {},
        handler: async () => "temp",
      });

      assert.isTrue(agent.hasTool("temp_tool"));

      const removed = agent.unregisterTool("temp_tool");
      assert.isTrue(removed);
      assert.isFalse(agent.hasTool("temp_tool"));
    });

    it("should return false when unregistering non-existent tool", function () {
      const agent = new Agent();
      const removed = agent.unregisterTool("nonexistent");
      assert.isFalse(removed);
    });

    it("should throw when registering duplicate tool", function () {
      const agent = new Agent();
      agent.registerTool({
        name: "dup_tool",
        description: "Duplicate",
        parameters: {},
        handler: async () => "dup",
      });

      assert.throws(() => {
        agent.registerTool({
          name: "dup_tool",
          description: "Duplicate again",
          parameters: {},
          handler: async () => "dup2",
        });
      });
    });

    it("should get all registered tools", function () {
      const agent = new Agent();

      agent.registerTool({
        name: "tool_a",
        description: "A",
        parameters: {},
        handler: async () => "a",
      });
      agent.registerTool({
        name: "tool_b",
        description: "B",
        parameters: {},
        handler: async () => "b",
      });

      const tools = agent.getTools();
      assert.lengthOf(tools, 2);
    });

    it("should return undefined for non-existent tool", function () {
      const agent = new Agent();
      const tool = agent.getTool("nonexistent");
      assert.isUndefined(tool);
    });

    it("should get a registered tool by name", function () {
      const agent = new Agent();
      const toolDef = {
        name: "get_test",
        description: "Get test",
        parameters: {},
        handler: async () => "found",
      };

      agent.registerTool(toolDef);
      const retrieved = agent.getTool("get_test");
      assert.isDefined(retrieved);
      assert.equal(retrieved?.name, "get_test");
    });

    it("should have run method for processing requests", function () {
      const agent = new Agent();
      assert.isFunction((agent as any).run);
    });

    it("should have process method as public API", function () {
      const agent = new Agent();
      assert.isFunction((agent as any).process);
    });

    it("should throw descriptive error when registering duplicate tool", function () {
      const agent = new Agent();
      agent.registerTool({
        name: "unique_tool",
        description: "A unique tool",
        parameters: {},
        handler: async () => "done",
      });

      try {
        agent.registerTool({
          name: "unique_tool",
          description: "Duplicate",
          parameters: {},
          handler: async () => "dup",
        });
        assert.fail("Should have thrown");
      } catch (err: any) {
        assert.include(err.message, "unique_tool");
        assert.include(err.message, "already registered");
      }
    });
  });

  describe("Agent instantiation patterns", function () {
    it("should create agent with default config", function () {
      const agent = new Agent();
      assert.isNotNull(agent);
    });

    it("should create agent with custom system prompt", function () {
      const agent = new Agent({
        systemPrompt: "You are a test assistant.",
      });
      assert.isNotNull(agent);
    });

    it("should create agent with max iterations", function () {
      const agent = new Agent({ maxIterations: 5 });
      assert.isNotNull(agent);
    });

    it("should create agent with empty config", function () {
      const agent = new Agent({});
      assert.isNotNull(agent);
    });
  });

  describe("Agent process flow", function () {
    it("should return text response when no tools are called", async function () {
      class TestableAgent extends Agent {
        protected override async callLLM(
          _messages: any[],
          _tools: any[],
          _context?: Record<string, any>,
        ): Promise<{ content: string; toolCalls?: any[]; error?: string }> {
          return { content: "Hello from test agent!" };
        }
      }

      const agent = new TestableAgent();
      const response = await (agent as any).run({
        messages: [{ role: "user", content: "Hello" }],
      });

      assert.equal(response.content, "Hello from test agent!");
      assert.isUndefined(response.error);
    });

    it("should handle empty messages array", async function () {
      class TestableAgent extends Agent {
        protected override async callLLM(
          _messages: any[],
          _tools: any[],
          _context?: Record<string, any>,
        ): Promise<{ content: string; toolCalls?: any[]; error?: string }> {
          return { content: "Handled empty messages." };
        }
      }

      const agent = new TestableAgent();
      const response = await (agent as any).run({
        messages: [],
      });

      assert.equal(response.content, "Handled empty messages.");
    });

    it("should return error from LLM call", async function () {
      class TestableAgent extends Agent {
        protected override async callLLM(
          _messages: any[],
          _tools: any[],
          _context?: Record<string, any>,
        ): Promise<{ content: string; toolCalls?: any[]; error?: string }> {
          return { content: "", error: "API key invalid" };
        }
      }

      const agent = new TestableAgent();
      const response = await (agent as any).run({
        messages: [{ role: "user", content: "Hello" }],
      });

      assert.equal(response.error, "API key invalid");
      assert.equal(response.content, "");
    });

    it("should handle max iterations exceeded", async function () {
      class LoopingAgent extends Agent {
        protected override async callLLM(
          _messages: any[],
          _tools: any[],
          _context?: Record<string, any>,
        ): Promise<{ content: string; toolCalls?: any[]; error?: string }> {
          return {
            content: "Still looping...",
            toolCalls: [{ id: "call_1", name: "loop_tool", arguments: {} }],
          };
        }
      }

      const agent = new LoopingAgent({
        maxIterations: 2,
      });

      const response = await (agent as any).run({
        messages: [{ role: "user", content: "Loop" }],
      });

      assert.isDefined(response.error);
      assert.include(response.error, "Max iterations");
    });

    it("should return tool call results when tools are executed", async function () {
      class ToolAgent extends Agent {
        protected override async callLLM(
          messages: any[],
          tools: any[],
          _context?: Record<string, any>,
        ): Promise<{ content: string; toolCalls?: any[]; error?: string }> {
          if (messages.length === 1) {
            return {
              content: "Let me search for that.",
              toolCalls: [
                { id: "call_1", name: "search", arguments: { q: "test" } },
              ],
            };
          }
          return { content: "Found results for 'test'." };
        }
      }

      const agent = new ToolAgent();
      agent.registerTool({
        name: "search",
        description: "Search",
        parameters: {},
        handler: async (args: any) => ({
          id: "call_1",
          result: { found: 5, query: args.q },
        }),
      });

      const response = await (agent as any).run({
        messages: [{ role: "user", content: "Search for test" }],
      });

      assert.equal(response.content, "Found results for 'test'.");
      assert.isUndefined(response.error);
    });
  });
});
