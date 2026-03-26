import { assert } from "chai";
import {
  loadAllTools,
  getAllTools,
  getToolsByCategory,
} from "../../src/tools/ToolLoader";
import { toolRegistry } from "../../src/tools/index";

describe("ToolLoader", function () {
  beforeEach(function () {
    toolRegistry.clear();
  });

  describe("loadAllTools", function () {
    it("should load and register all read and write tools", function () {
      loadAllTools();

      const tools = toolRegistry.list();
      // 5 read tools + 4 write tools = 9 total
      assert.lengthOf(tools, 9);
    });

    it("should register each tool only once", function () {
      loadAllTools();

      // All tools should be registered
      assert.isTrue(toolRegistry.has("get_item"));
      assert.isTrue(toolRegistry.has("get_selected_items"));
      assert.isTrue(toolRegistry.has("get_pdf_text"));
      assert.isTrue(toolRegistry.has("search_items"));
      assert.isTrue(toolRegistry.has("screenshot_ocr"));
      assert.isTrue(toolRegistry.has("add_note"));
      assert.isTrue(toolRegistry.has("update_tags"));
      assert.isTrue(toolRegistry.has("create_highlight"));
      assert.isTrue(toolRegistry.has("sync_notes"));
    });

    it("should throw when loading twice without clearing", function () {
      loadAllTools();
      assert.throws(function () {
        loadAllTools();
      });
    });
  });

  describe("getAllTools", function () {
    it("should return all loaded tools", function () {
      loadAllTools();
      const tools = getAllTools();
      assert.lengthOf(tools, 9);
    });

    it("should return empty array when no tools loaded", function () {
      const tools = getAllTools();
      assert.lengthOf(tools, 0);
    });
  });

  describe("getToolsByCategory", function () {
    it("should return only read tools", function () {
      loadAllTools();
      const readTools = getToolsByCategory("read");
      assert.lengthOf(readTools, 5);
      for (const tool of readTools) {
        assert.equal(tool.category, "read");
      }
    });

    it("should return only write tools", function () {
      loadAllTools();
      const writeTools = getToolsByCategory("write");
      assert.lengthOf(writeTools, 4);
      for (const tool of writeTools) {
        assert.equal(tool.category, "write");
      }
    });

    it("should return empty array for unknown category", function () {
      loadAllTools();
      const unknownTools = getToolsByCategory("nonexistent");
      assert.lengthOf(unknownTools, 0);
    });
  });
});
