import { assert } from "chai";
import { toolRegistry } from "../../src/tools/index";
import type { Tool, ToolContext } from "../../src/tools/base/Tool";

describe("ToolRegistry", function () {
  // Use the singleton registry; clear before each test to ensure isolation
  let registry: typeof toolRegistry;

  beforeEach(function () {
    registry = toolRegistry;
    registry.clear();
  });

  describe("register", function () {
    it("should register a tool", function () {
      const mockTool = {
        name: "test_tool",
        description: "A test tool",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      };

      registry.register(mockTool as unknown as Tool);
      assert.isTrue(registry.has("test_tool"));
    });

    it("should throw on duplicate registration", function () {
      const mockTool = {
        name: "dup_tool",
        description: "A test tool",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      };

      registry.register(mockTool as unknown as Tool);
      assert.throws(function () {
        registry.register(mockTool as unknown as Tool);
      });
    });

    it("should throw when registering a tool with no name", function () {
      const mockTool = {
        name: "",
        description: "A test tool",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      } as unknown as Tool;

      assert.throws(function () {
        registry.register(mockTool);
      });
    });
  });

  describe("get", function () {
    it("should return registered tool", function () {
      const mockTool = {
        name: "get_tool",
        description: "A test tool",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      };

      registry.register(mockTool as unknown as Tool);
      const retrieved = registry.get("get_tool");
      assert.equal(retrieved?.name, "get_tool");
    });

    it("should return undefined for unknown tool", function () {
      const retrieved = registry.get("nonexistent");
      assert.isUndefined(retrieved);
    });
  });

  describe("list", function () {
    it("should list all registered tools", function () {
      const tool1 = {
        name: "tool_1",
        description: "Tool 1",
        category: "test",
        execute: async () => ({ success: true, result: "1" }),
      };
      const tool2 = {
        name: "tool_2",
        description: "Tool 2",
        category: "test",
        execute: async () => ({ success: true, result: "2" }),
      };

      registry.register(tool1 as unknown as Tool);
      registry.register(tool2 as unknown as Tool);

      const tools = registry.list();
      assert.lengthOf(tools, 2);
    });

    it("should return empty array when no tools registered", function () {
      const tools = registry.list();
      assert.lengthOf(tools, 0);
    });
  });

  describe("has", function () {
    it("should return true for registered tool", function () {
      const mockTool = {
        name: "has_tool",
        description: "A test tool",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      };

      registry.register(mockTool as unknown as Tool);
      assert.isTrue(registry.has("has_tool"));
    });

    it("should return false for unregistered tool", function () {
      assert.isFalse(registry.has("unknown_tool"));
    });
  });

  describe("unregister", function () {
    it("should unregister a tool", function () {
      const mockTool = {
        name: "remove_tool",
        description: "A test tool",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      };

      registry.register(mockTool as unknown as Tool);
      const result = registry.unregister("remove_tool");
      assert.isTrue(result);
      assert.isFalse(registry.has("remove_tool"));
    });

    it("should return false for unknown tool", function () {
      const result = registry.unregister("nonexistent");
      assert.isFalse(result);
    });
  });

  describe("listByCategory", function () {
    it("should return tools in a given category", function () {
      const tool1 = {
        name: "read_tool",
        description: "Read tool",
        category: "read",
        execute: async () => ({ success: true, result: "1" }),
      };
      const tool2 = {
        name: "write_tool",
        description: "Write tool",
        category: "write",
        execute: async () => ({ success: true, result: "2" }),
      };

      registry.register(tool1 as unknown as Tool);
      registry.register(tool2 as unknown as Tool);

      const readTools = registry.listByCategory("read");
      const writeTools = registry.listByCategory("write");

      assert.lengthOf(readTools, 1);
      assert.equal(readTools[0].name, "read_tool");
      assert.lengthOf(writeTools, 1);
      assert.equal(writeTools[0].name, "write_tool");
    });

    it("should return empty array for unknown category", function () {
      const tools = registry.listByCategory("nonexistent");
      assert.lengthOf(tools, 0);
    });
  });

  describe("size", function () {
    it("should return the number of registered tools", function () {
      assert.equal(registry.size(), 0);
      registry.register({
        name: "size_tool",
        description: "Size test",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      } as unknown as Tool);
      assert.equal(registry.size(), 1);
    });
  });

  describe("clear", function () {
    it("should remove all registered tools", function () {
      registry.register({
        name: "clear_tool",
        description: "Clear test",
        category: "test",
        execute: async () => ({ success: true, result: "test" }),
      } as unknown as Tool);
      assert.isTrue(registry.has("clear_tool"));
      registry.clear();
      assert.isFalse(registry.has("clear_tool"));
      assert.equal(registry.size(), 0);
    });
  });
});
