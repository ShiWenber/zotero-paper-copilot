/**
 * Unit tests for Agent Tool Utilities
 * Tests for createToolDefinition, BaseTool, and BaseToolClass
 */

import { assert } from "chai";
/* eslint-disable mocha/max-top-level-suites */
import { createToolDefinition, BaseToolClass } from "../../src/agent/Tool";
import type { ToolDefinition, ToolHandler } from "../../src/agent/types";

describe("createToolDefinition", function () {
  it("should create a valid tool definition", function () {
    const handler: ToolHandler = async () => ({ success: true });
    const tool = createToolDefinition(
      {
        name: "test_tool",
        description: "A test tool",
        parameters: [],
      },
      handler,
    );

    assert.equal(tool.name, "test_tool");
    assert.equal(tool.description, "A test tool");
    assert.deepEqual(tool.parameters, []);
    assert.isFunction(tool.handler);
  });

  it("should use empty object as default parameters", function () {
    const handler: ToolHandler = async () => "done";
    const tool = createToolDefinition(
      {
        name: "no_params_tool",
        description: "Tool without parameters",
      },
      handler,
    );

    assert.deepEqual(tool.parameters, {});
  });

  it("should preserve handler function", async function () {
    const expectedResult = { data: [1, 2, 3] };
    const handler: ToolHandler = async () => expectedResult;
    const tool = createToolDefinition(
      {
        name: "handler_test",
        description: "Test handler preservation",
      },
      handler,
    );

    const result = await tool.handler({});
    assert.deepEqual(result, expectedResult);
  });

  it("should accept complex parameter schema", function () {
    const handler: ToolHandler = async () => null;
    const schema = {
      type: "object",
      properties: {
        query: { type: "string" },
        options: {
          type: "object",
          properties: {
            limit: { type: "number", default: 10 },
          },
        },
      },
      required: ["query"],
    };
    const tool = createToolDefinition(
      {
        name: "complex_tool",
        description: "Tool with complex schema",
        parameters: schema,
      },
      handler,
    );

    assert.equal(tool.parameters.type, "object");
    assert.isArray(tool.parameters.required);
    assert.equal(tool.parameters.required[0], "query");
  });

  it("should create multiple distinct tools", function () {
    const handler1: ToolHandler = async () => "tool1";
    const handler2: ToolHandler = async () => "tool2";
    const handler3: ToolHandler = async () => "tool3";

    const tool1 = createToolDefinition(
      { name: "tool_a", description: "First tool" },
      handler1,
    );
    const tool2 = createToolDefinition(
      { name: "tool_b", description: "Second tool" },
      handler2,
    );
    const tool3 = createToolDefinition(
      { name: "tool_c", description: "Third tool" },
      handler3,
    );

    assert.notEqual(tool1.name, tool2.name);
    assert.notEqual(tool2.name, tool3.name);
    assert.equal(tool1.name, "tool_a");
    assert.equal(tool2.name, "tool_b");
    assert.equal(tool3.name, "tool_c");
  });

  it("should allow empty string as name and description", function () {
    const handler: ToolHandler = async () => null;
    const tool = createToolDefinition({ name: "", description: "" }, handler);

    assert.equal(tool.name, "");
    assert.equal(tool.description, "");
  });
});

describe("BaseToolClass", function () {
  it("should create a concrete tool class", function () {
    class TestTool extends BaseToolClass {
      name = "concrete_tool";
      description = "A concrete tool implementation";
      parameters = { type: "object", properties: {} };

      async execute(args: Record<string, any>): Promise<any> {
        return { executed: true, args };
      }
    }

    const tool = new TestTool();
    assert.equal(tool.name, "concrete_tool");
    assert.equal(tool.description, "A concrete tool implementation");
  });

  it("should convert to ToolDefinition via toDefinition()", async function () {
    class SearchTool extends BaseToolClass {
      name = "search";
      description = "Search for items";
      parameters = {
        type: "object",
        properties: { query: { type: "string" } },
      };

      async execute(args: Record<string, any>): Promise<any> {
        return `Searching for: ${args.query}`;
      }
    }

    const searchTool = new SearchTool();
    const definition = searchTool.toDefinition();

    assert.equal(definition.name, "search");
    assert.equal(definition.description, "Search for items");
    assert.equal(definition.parameters.type, "object");
    assert.isFunction(definition.handler);

    // Test that the handler calls execute
    const result = await definition.handler({ query: "test" });
    assert.equal(result, "Searching for: test");
  });

  it("should pass context through to execute", async function () {
    class ContextTool extends BaseToolClass {
      name = "context_tool";
      description = "Tool that uses context";
      parameters = {};

      async execute(
        args: Record<string, any>,
        context?: Record<string, any>,
      ): Promise<any> {
        return { args, context };
      }
    }

    const tool = new ContextTool();
    const definition = tool.toDefinition();
    const ctx = { userId: "user_123", role: "admin" };
    const result = await definition.handler({ action: "do" }, ctx);

    assert.deepEqual(result.args, { action: "do" });
    assert.deepEqual(result.context, ctx);
  });

  it("should support undefined context", async function () {
    class SimpleTool extends BaseToolClass {
      name = "simple";
      description = "Simple tool";
      parameters = {};

      async execute(args: Record<string, any>): Promise<any> {
        return args;
      }
    }

    const tool = new SimpleTool();
    const definition = tool.toDefinition();
    const result = await definition.handler({ x: 1 }, undefined);
    assert.deepEqual(result, { x: 1 });
  });

  it("should allow multiple concrete implementations", function () {
    class ToolA extends BaseToolClass {
      name = "tool_a";
      description = "Tool A";
      parameters = {};
      async execute(): Promise<any> {
        return "A";
      }
    }

    class ToolB extends BaseToolClass {
      name = "tool_b";
      description = "Tool B";
      parameters = {};
      async execute(): Promise<any> {
        return "B";
      }
    }

    const toolA = new ToolA();
    const toolB = new ToolB();

    assert.equal(toolA.name, "tool_a");
    assert.equal(toolB.name, "tool_b");
    assert.notEqual(toolA.name, toolB.name);
  });

  it("should support optional parameters property", async function () {
    class NoParamsTool extends BaseToolClass {
      name = "no_params";
      description = "Tool without parameters";
      parameters = {};

      async execute(): Promise<any> {
        return "executed";
      }
    }

    const tool = new NoParamsTool();
    const definition = tool.toDefinition();

    assert.isUndefined(definition.parameters);
  });

  it("toDefinition should create callable handler", async function () {
    class EchoTool extends BaseToolClass {
      name = "echo";
      description = "Echoes the input";
      parameters = {
        type: "object",
        properties: { value: { type: "string" } },
      };

      async execute(args: Record<string, any>): Promise<any> {
        return { echoed: args.value };
      }
    }

    const echoTool = new EchoTool();
    const def = echoTool.toDefinition();

    // Handler should be callable with args
    const result = await def.handler({ value: "hello" });
    assert.deepEqual(result, { echoed: "hello" });
  });

  it("should handle execute throwing an error", async function () {
    class FailingTool extends BaseToolClass {
      name = "failing";
      description = "This tool fails";
      parameters = {};

      async execute(): Promise<any> {
        throw new Error("Execute failed");
      }
    }

    const tool = new FailingTool();
    const def = tool.toDefinition();

    try {
      await def.handler({});
      assert.fail("Should have thrown");
    } catch (err: any) {
      assert.equal(err.message, "Execute failed");
    }
  });
});

describe("ToolDefinition interop", function () {
  it("should be compatible with Agent.registerTool", function () {
    // This is a structural test - verifying that createToolDefinition
    // returns an object compatible with ToolDefinition interface
    const handler: ToolHandler = async () => ({ ok: true });
    const tool = createToolDefinition(
      {
        name: "interop_test",
        description: "Testing interoperability",
        parameters: {},
      },
      handler,
    );

    // Check all required properties exist
    assert.isString(tool.name);
    assert.isString(tool.description);
    assert.isFunction(tool.handler);
  });

  it("should work with tool call arguments", async function () {
    const handler: ToolHandler = async (args, context) => {
      return {
        received: args,
        hasContext: context !== undefined,
      };
    };

    const tool = createToolDefinition(
      { name: "arg_test", description: "Argument test" },
      handler,
    );

    const result = await tool.handler(
      { key: "value", nested: { a: 1, b: 2 } },
      { session: "test" },
    );

    assert.equal(result.received.key, "value");
    assert.deepEqual(result.received.nested, { a: 1, b: 2 });
    assert.isTrue(result.hasContext);
  });
});
