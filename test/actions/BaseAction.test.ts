import { assert } from "chai";
import {
  BaseAction,
  ActionContext,
  ActionResult,
} from "../../src/actions/base/Action";
import type { ParameterDefinition } from "../../src/tools/base/Tool";

// Minimal mock context that satisfies ActionContext
const mockContext: ActionContext = {
  window: {} as Window,
  agent: {} as any,
  llmManager: {} as any,
  services: {
    zotero: {} as any,
    pdf: {} as any,
  },
  toolRegistry: {} as any,
};

describe("BaseAction", function () {
  describe("canApply", function () {
    it("should return boolean true", function () {
      class BooleanAction extends BaseAction {
        name = "bool_action";
        description = "Test";
        parameters = [];

        canApply() {
          return true;
        }
        doExecute() {
          return { success: true, message: "Done" };
        }
      }

      const action = new BooleanAction();
      assert.isTrue(action.canApply([] as any, mockContext));
    });

    it("should return boolean false", function () {
      class FalseAction extends BaseAction {
        name = "false_action";
        description = "Test";
        parameters = [];

        canApply() {
          return false;
        }
        doExecute() {
          return { success: true, message: "Done" };
        }
      }

      const action = new FalseAction();
      assert.isFalse(action.canApply([] as any, mockContext));
    });
  });

  describe("doExecute", function () {
    it("should return ActionResult with success", async function () {
      class ExecAction extends BaseAction {
        name = "exec_action";
        description = "Test";
        parameters = [];

        canApply() {
          return true;
        }
        doExecute() {
          return { success: true, message: "Executed" };
        }
      }

      const action = new ExecAction();
      const result = await action.doExecute({}, mockContext);

      assert.isTrue(result.success);
      assert.equal(result.message, "Executed");
    });

    it("should handle errors gracefully", async function () {
      class ErrorAction extends BaseAction {
        name = "error_action";
        description = "Test";
        parameters = [];

        canApply() {
          return true;
        }
        doExecute() {
          throw new Error("Test error");
        }
      }

      const action = new ErrorAction();
      const result = await action.execute({}, mockContext);

      assert.isFalse(result.success);
      assert.isNotNull(result.error);
    });

    it("should include data in result", async function () {
      class DataAction extends BaseAction {
        name = "data_action";
        description = "Test";
        parameters = [];

        canApply() {
          return true;
        }
        doExecute() {
          return { success: true, message: "Done", data: { items: [1, 2, 3] } };
        }
      }

      const action = new DataAction();
      const result = await action.doExecute({}, mockContext);

      assert.isArray(result.data?.items);
      assert.lengthOf(result.data?.items, 3);
    });
  });

  describe("execute (wrapper with validation)", function () {
    it("should pass args to doExecute via execute()", async function () {
      class ArgsAction extends BaseAction {
        name = "args_action";
        description = "Test";
        parameters = [];

        canApply() {
          return true;
        }
        doExecute(args: Record<string, any>) {
          return { success: true, message: String(args["input"]) };
        }
      }

      const action = new ArgsAction();
      const result = await action.execute({ input: "hello" }, mockContext);
      assert.isTrue(result.success);
      assert.equal(result.message, "hello");
    });

    it("should return error for missing required parameter", async function () {
      class ParamAction extends BaseAction {
        name = "param_action";
        description = "Test";
        parameters = [
          {
            name: "requiredArg",
            description: "A required argument",
            type: "string",
            required: true,
          } as ParameterDefinition,
        ];

        canApply() {
          return true;
        }
        doExecute() {
          return { success: true, message: "ok" };
        }
      }

      const action = new ParamAction();
      const result = await action.execute({}, mockContext);

      assert.isFalse(result.success);
      assert.isNotNull(result.errors);
      assert.include(result.errors![0], "requiredArg");
    });

    it("should succeed when required parameter is provided", async function () {
      class ParamAction extends BaseAction {
        name = "param_action";
        description = "Test";
        parameters = [
          {
            name: "requiredArg",
            description: "A required argument",
            type: "string",
            required: true,
          } as ParameterDefinition,
        ];

        canApply() {
          return true;
        }
        doExecute(args: Record<string, any>) {
          return { success: true, message: args["requiredArg"] };
        }
      }

      const action = new ParamAction();
      const result = await action.execute(
        { requiredArg: "value" },
        mockContext,
      );
      assert.isTrue(result.success);
      assert.equal(result.message, "value");
    });

    it("should wrap errors from doExecute in execute()", async function () {
      class FailAction extends BaseAction {
        name = "fail_action";
        description = "Test";
        parameters = [];

        canApply() {
          return true;
        }
        doExecute() {
          throw new Error("inner error");
        }
      }

      const action = new FailAction();
      const result = await action.execute({}, mockContext);

      assert.isFalse(result.success);
      assert.isNotNull(result.errors);
      assert.include(result.message, "fail_action");
    });
  });

  describe("name and description", function () {
    it("should expose name and description", function () {
      class NamedAction extends BaseAction {
        name = "named_action";
        description = "A named action for testing";
        parameters = [];

        canApply() {
          return true;
        }
        doExecute() {
          return { success: true, message: "Done" };
        }
      }

      const action = new NamedAction();
      assert.equal(action.name, "named_action");
      assert.equal(action.description, "A named action for testing");
    });
  });
});
