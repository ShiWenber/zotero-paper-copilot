import { assert } from "chai";
import { actionRegistry } from "../../src/actions/ActionRegistry";
import { BaseAction, ActionContext, ActionResult } from "../../src/actions/base/Action";
import type { ParameterDefinition } from "../../src/tools/base/Tool";

// Helper: create a concrete action class for testing
function makeTestAction(name: string, description: string, params?: ParameterDefinition[]) {
  return class extends BaseAction {
    name = name;
    description = description;
    parameters = params ?? [];

    canApply() { return true; }
    doExecute() { return { success: true, message: "Done" }; }
  };
}

describe("ActionRegistry", function () {
  // Use the singleton registry; clear before each test for isolation
  let registry: typeof actionRegistry;

  beforeEach(function () {
    registry = actionRegistry;
    registry.clear();
  });

  describe("register", function () {
    it("should register an action", function () {
      const TestAction = makeTestAction("test_action", "A test action");
      registry.register(new TestAction());
      assert.isTrue(registry.has("test_action"));
    });

    it("should throw on duplicate action", function () {
      const TestAction = makeTestAction("dup_action", "A test action");
      registry.register(new TestAction());
      assert.throws(function () {
        registry.register(new TestAction());
      });
    });

    it("should throw when registering action with no name", function () {
      const NoNameAction = makeTestAction("", "No name action");
      assert.throws(function () {
        registry.register(new NoNameAction());
      });
    });

    it("should throw when registering null", function () {
      assert.throws(function () {
        registry.register(null as any);
      });
    });
  });

  describe("get", function () {
    it("should return registered action", function () {
      const GetAction = makeTestAction("get_action", "A test action");
      registry.register(new GetAction());
      const action = registry.get("get_action");
      assert.equal(action?.name, "get_action");
    });

    it("should return undefined for unknown action", function () {
      const action = registry.get("nonexistent");
      assert.isUndefined(action);
    });
  });

  describe("list", function () {
    it("should list all actions", function () {
      const Action1 = makeTestAction("action_1", "Action 1");
      const Action2 = makeTestAction("action_2", "Action 2");
      registry.register(new Action1());
      registry.register(new Action2());
      const actions = registry.list();
      assert.lengthOf(actions, 2);
    });

    it("should return empty array when no actions registered", function () {
      const actions = registry.list();
      assert.lengthOf(actions, 0);
    });
  });

  describe("has", function () {
    it("should return true for registered action", function () {
      const HasAction = makeTestAction("has_action", "Test");
      registry.register(new HasAction());
      assert.isTrue(registry.has("has_action"));
    });

    it("should return false for unknown action", function () {
      assert.isFalse(registry.has("unknown_action"));
    });
  });

  describe("unregister", function () {
    it("should unregister an action", function () {
      const RemoveAction = makeTestAction("remove_action", "Test");
      registry.register(new RemoveAction());
      const result = registry.unregister("remove_action");
      assert.isTrue(result);
      assert.isFalse(registry.has("remove_action"));
    });

    it("should return false for unknown action", function () {
      const result = registry.unregister("nonexistent");
      assert.isFalse(result);
    });
  });

  describe("size", function () {
    it("should return the number of registered actions", function () {
      assert.equal(registry.size(), 0);
      const SizeAction = makeTestAction("size_action", "Test");
      registry.register(new SizeAction());
      assert.equal(registry.size(), 1);
    });
  });

  describe("clear", function () {
    it("should remove all registered actions", function () {
      const ClearAction = makeTestAction("clear_action", "Test");
      registry.register(new ClearAction());
      assert.isTrue(registry.has("clear_action"));
      registry.clear();
      assert.isFalse(registry.has("clear_action"));
      assert.equal(registry.size(), 0);
    });
  });

  describe("listByCategory", function () {
    it("should return actions grouped by category prefix", function () {
      const ReadAction = makeTestAction("read_items", "Read items");
      const WriteAction = makeTestAction("write_items", "Write items");
      registry.register(new ReadAction());
      registry.register(new WriteAction());

      const categories = registry.listByCategory();
      assert.isTrue(categories.has("read"));
      assert.isTrue(categories.has("write"));
      assert.lengthOf(categories.get("read")!, 1);
      assert.lengthOf(categories.get("write")!, 1);
    });

    it("should put unnamed-prefix actions in misc category", function () {
      const MiscAction = makeTestAction("simple", "Simple action");
      registry.register(new MiscAction());

      const categories = registry.listByCategory();
      assert.isTrue(categories.has("misc"));
      assert.lengthOf(categories.get("misc")!, 1);
    });
  });
});
