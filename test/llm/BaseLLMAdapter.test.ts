/**
 * Unit tests for BaseLLMAdapter
 * Tests for abstract adapter class interface compliance
 */

import { assert } from "chai";
import { BaseLLMAdapter } from "../../src/llm/adapters/base/BaseLLMAdapter";

describe("BaseLLMAdapter", function () {
  describe("interface compliance", function () {
    it("should define model and apiKey as abstract", function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test-model";
        apiKey = "test-key";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      const adapter = new TestAdapter();
      assert.equal(adapter.model, "test-model");
      assert.equal(adapter.apiKey, "test-key");
    });

    it("should allow mutable model property", function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "original";
        apiKey = "key";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      const adapter = new TestAdapter();
      adapter.model = "updated";
      assert.equal(adapter.model, "updated");
    });

    it("should allow mutable apiKey property", function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "original-key";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      const adapter = new TestAdapter();
      adapter.apiKey = "new-key";
      assert.equal(adapter.apiKey, "new-key");
    });

    it("supportsStreaming should return false by default", function () {
      class DefaultAdapter extends BaseLLMAdapter {
        model = "default";
        apiKey = "key";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new DefaultAdapter();
      assert.isFalse(adapter.supportsStreaming());
    });

    it("supportsStreaming should return boolean", function () {
      class StreamAdapter extends BaseLLMAdapter {
        model = "stream";
        apiKey = "key";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return true;
        }
      }

      const adapter = new StreamAdapter();
      assert.isTrue(adapter.supportsStreaming());
    });

    it("validateConfig should return true by default when apiKey is set", function () {
      class DefaultAdapter extends BaseLLMAdapter {
        model = "default";
        apiKey = "valid-key";

        async complete() {
          return { content: "", finishReason: "stop" };
        }
      }

      const adapter = new DefaultAdapter();
      assert.isTrue(adapter.validateConfig());
    });

    it("validateConfig should return false when apiKey is empty", function () {
      class EmptyAdapter extends BaseLLMAdapter {
        model = "empty";
        apiKey = "";

        async complete() {
          return { content: "", finishReason: "stop" };
        }
      }

      const adapter = new EmptyAdapter();
      assert.isFalse(adapter.validateConfig());
    });

    it("validateConfig should return false when apiKey is undefined", function () {
      class UndefinedAdapter extends BaseLLMAdapter {
        model = "undefined";
        apiKey = undefined as any;

        async complete() {
          return { content: "", finishReason: "stop" };
        }
      }

      const adapter = new UndefinedAdapter();
      assert.isFalse(adapter.validateConfig());
    });

    it("validateConfig should return boolean", function () {
      class ConfigAdapter extends BaseLLMAdapter {
        model = "config";
        apiKey = "";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return this.apiKey.length > 0;
        }

        supportsStreaming() {
          return false;
        }
      }

      const adapter = new ConfigAdapter();
      assert.isFalse(adapter.validateConfig());

      adapter.apiKey = "valid-key";
      assert.isTrue(adapter.validateConfig());
    });
  });

  describe("complete method signature", function () {
    it("should accept messages array", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete(messages: any) {
          assert.isArray(messages);
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      await adapter.complete([{ role: "user", content: "Hello" }]);
    });

    it("should accept optional tools parameter", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete(messages: any, tools?: any) {
          assert.isUndefined(tools);
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      await adapter.complete([{ role: "user", content: "Hello" }]);
    });

    it("should accept optional streaming callback", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete(messages: any, tools?: any, streaming?: any) {
          assert.isUndefined(streaming);
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      await adapter.complete([{ role: "user", content: "Hello" }]);
    });

    it("should pass tools to complete implementation", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete(messages: any, tools?: any) {
          if (tools) {
            return {
              content: "tools received: " + tools.length,
              finishReason: "stop",
            };
          }
          return { content: "no tools", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      const tools = [{ name: "tool1", description: "d", parameters: {} }];
      const result = await adapter.complete([], tools);
      assert.include(result.content, "tools received");
    });
  });

  describe("LLMResponse interface", function () {
    it("should require content string", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete() {
          return { content: "test content", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      const result = await adapter.complete([]);
      assert.isString(result.content);
      assert.equal(result.content, "test content");
    });

    it("should require finishReason string", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      const result = await adapter.complete([]);
      assert.equal(result.finishReason, "stop");
    });

    it("should support toolCalls in response", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete() {
          return {
            content: "",
            finishReason: "tool_calls",
            toolCalls: [
              { id: "call_1", name: "test_tool", arguments: { arg: "value" } },
            ],
          };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      const result = await adapter.complete([]);
      assert.isArray(result.toolCalls);
      assert.lengthOf(result.toolCalls!, 1);
      assert.equal(result.toolCalls![0].name, "test_tool");
    });

    it("should support error in response", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete() {
          return {
            content: "",
            finishReason: "error",
            error: "Something went wrong",
          };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      const result = await adapter.complete([]);
      assert.equal(result.error, "Something went wrong");
    });

    it("should support usage info in response", async function () {
      class TestAdapter extends BaseLLMAdapter {
        model = "test";
        apiKey = "key";

        async complete() {
          return {
            content: "response",
            finishReason: "stop",
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
            },
          };
        }

        validateConfig() {
          return true;
        }
      }

      const adapter = new TestAdapter();
      const result = await adapter.complete([]);
      assert.isDefined(result.usage);
      assert.equal(result.usage!.totalTokens, 30);
    });
  });
});
