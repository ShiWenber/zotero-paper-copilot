import { assert } from "chai";
import { BaseTool } from "../../src/tools/base/Tool";
import type { ToolContext } from "../../src/tools/base/Tool";

// Minimal mock context that satisfies ToolContext
const mockContext: ToolContext = {
  window: {} as Window,
  agent: {} as any,
  services: {
    zotero: {} as any,
    pdf: {} as any
  }
};

describe("BaseTool", function () {
  it("should create a tool with name and description", function () {
    class TestTool extends BaseTool {
      name = "test_tool";
      description = "A test tool";
      category = "test";

      async doExecute() {
        return { result: "test", error: null };
      }
    }

    const tool = new TestTool();
    assert.equal(tool.name, "test_tool");
    assert.equal(tool.description, "A test tool");
    assert.equal(tool.category, "test");
  });

  it("should execute doExecute and return wrapped result", async function () {
    class TestTool extends BaseTool {
      name = "exec_tool";
      description = "Execution test";
      category = "test";

      async doExecute() {
        return { result: "executed", error: null };
      }
    }

    const tool = new TestTool();
    const result = await tool.execute({}, mockContext);

    // execute() wraps the result: { id, result, error }
    assert.isNotNull(result.id);
    assert.isTrue(result.id.startsWith("exec_tool-"));
    assert.equal(result.result, "executed");
    assert.isNull(result.error);
  });

  it("should handle errors in doExecute", async function () {
    class ErrorTool extends BaseTool {
      name = "error_tool";
      description = "Error test";
      category = "test";

      async doExecute() {
        throw new Error("Test error");
      }
    }

    const tool = new ErrorTool();
    const result = await tool.execute({}, mockContext);

    assert.isNull(result.result);
    assert.isNotNull(result.error);
    assert.include(result.error!, "Test error");
  });

  it("should validate required parameters", async function () {
    class ParamTool extends BaseTool {
      name = "param_tool";
      description = "Parameter test";
      category = "test";
      parameters = [
        {
          name: "requiredArg",
          description: "A required argument",
          type: "string",
          required: true
        }
      ];

      async doExecute() {
        return { result: "ok", error: null };
      }
    }

    const tool = new ParamTool();

    // Missing required parameter should return error
    const result = await tool.execute({}, mockContext);
    assert.isNull(result.result);
    assert.isNotNull(result.error);
    assert.include(result.error!, "requiredArg");
  });

  it("should pass args to doExecute", async function () {
    class ArgsTool extends BaseTool {
      name = "args_tool";
      description = "Args test";
      category = "test";

      async doExecute(args: Record<string, unknown>) {
        return { result: args["input"], error: null };
      }
    }

    const tool = new ArgsTool();
    const result = await tool.execute({ input: "hello" }, mockContext);
    assert.equal(result.result, "hello");
  });

  it("should return error when doExecute returns error field", async function () {
    class FailingTool extends BaseTool {
      name = "failing_tool";
      description = "Failing test";
      category = "test";

      async doExecute() {
        return { result: null, error: "intentional failure" };
      }
    }

    const tool = new FailingTool();
    const result = await tool.execute({}, mockContext);
    assert.isNull(result.result);
    assert.equal(result.error, "intentional failure");
  });
});
