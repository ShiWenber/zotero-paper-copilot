/**
 * Unit tests for LLM Manager
 * Tests for LLMManager singleton, adapter registration, and API key management
 */

import { assert } from "chai";
import { LLMManager, LLMProvider } from "../../src/llm/LLMManager";
import { BaseLLMAdapter } from "../../src/llm/adapters/base/BaseLLMAdapter";
import { AgentMessage } from "../../src/agent/types";

describe("LLMManager", function () {
  let manager: LLMManager;

  beforeEach(function () {
    manager = LLMManager.getInstance();
  });

  describe("getInstance", function () {
    it("should return a singleton instance", function () {
      const instance1 = LLMManager.getInstance();
      const instance2 = LLMManager.getInstance();
      assert.equal(instance1, instance2);
    });

    it("should return LLMManager instance", function () {
      const instance = LLMManager.getInstance();
      assert.instanceOf(instance, LLMManager);
    });
  });

  describe("registerAdapter", function () {
    it("should register an adapter", function () {
      class MockAdapter extends BaseLLMAdapter {
        model = "mock-model";
        apiKey = "test-key";

        async complete() {
          return { content: "mock response", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("openai", new MockAdapter());
      const adapter = (manager as any).adapters.get("openai");
      assert.isNotNull(adapter);
    });

    it("should replace existing adapter for same provider", function () {
      class FirstAdapter extends BaseLLMAdapter {
        model = "first";
        apiKey = "key1";

        async complete() {
          return { content: "first", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      class SecondAdapter extends BaseLLMAdapter {
        model = "second";
        apiKey = "key2";

        async complete() {
          return { content: "second", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("openai", new FirstAdapter());
      manager.registerAdapter("openai", new SecondAdapter());

      const adapter = manager.getAdapter("openai");
      assert.equal(adapter.model, "second");
    });
  });

  describe("getAdapter", function () {
    it("should return registered adapter", function () {
      class MockAdapter extends BaseLLMAdapter {
        model = "mock";
        apiKey = "key";

        async complete() {
          return { content: "ok", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("openai", new MockAdapter());
      const adapter = manager.getAdapter("openai");
      assert.equal(adapter.model, "mock");
    });

    it("should throw when no adapter registered", function () {
      // Use a fresh manager to avoid existing adapters
      const freshManager = new (LLMManager as any)();
      (freshManager as any).adapters = new Map();

      assert.throws(() => freshManager.getAdapter("openai"));
    });

    it("should use current provider when none specified", function () {
      class MockAdapter extends BaseLLMAdapter {
        model = "current";
        apiKey = "key";

        async complete() {
          return { content: "ok", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("openai", new MockAdapter());
      const adapter = manager.getAdapter();
      assert.equal(adapter.model, "current");
    });
  });

  describe("setProvider / currentProvider", function () {
    it("should set current provider", function () {
      class MockAdapter extends BaseLLMAdapter {
        model = "claude-model";
        apiKey = "key";

        async complete() {
          return { content: "ok", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("claude", new MockAdapter());
      manager.setProvider("claude");
      assert.equal(manager.currentProvider, "claude");
    });

    it("should throw when setting unregistered provider", function () {
      assert.throws(() => manager.setProvider("claude"));
    });

    it("should default to openai", function () {
      assert.equal(manager.currentProvider, "openai");
    });
  });

  describe("setApiKey / getApiKey", function () {
    it("should store and retrieve API key", function () {
      manager.setApiKey("openai", "sk-test123");
      assert.equal(manager.getApiKey("openai"), "sk-test123");
    });

    it("should return undefined for unknown provider", function () {
      assert.isUndefined(manager.getApiKey("claude"));
    });

    it("should update adapter apiKey when adapter exists", function () {
      class MockAdapter extends BaseLLMAdapter {
        model = "mock";
        apiKey = "old-key";

        async complete() {
          return { content: "ok", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("openai", new MockAdapter());
      manager.setApiKey("openai", "new-key");
      assert.equal(manager.getApiKey("openai"), "new-key");
    });
  });

  describe("hasApiKey", function () {
    it("should return true when API key is set", function () {
      manager.setApiKey("openai", "sk-valid");
      assert.isTrue(manager.hasApiKey("openai"));
    });

    it("should return false when no API key", function () {
      assert.isFalse(manager.hasApiKey("claude"));
    });

    it("should return false when API key is empty string", function () {
      manager.setApiKey("openai", "");
      assert.isFalse(manager.hasApiKey("openai"));
    });
  });

  describe("complete", function () {
    it("should return mock response when adapter is set", async function () {
      class MockAdapter extends BaseLLMAdapter {
        model = "mock";
        apiKey = "test";

        async complete() {
          return { content: "Hello from mock", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("openai", new MockAdapter());
      const result = await manager.complete([{ role: "user", content: "Hi" }]);
      assert.equal(result.content, "Hello from mock");
    });

    it("should throw when no adapter registered", async function () {
      // Use a fresh manager with no adapters
      const freshManager = new (LLMManager as any)();
      (freshManager as any).adapters = new Map();
      (freshManager as any)._currentProvider = "openai";

      await assert.isRejected(
        freshManager.complete([{ role: "user", content: "Hi" }]),
      );
    });

    it("should pass tools to adapter", async function () {
      class MockAdapter extends BaseLLMAdapter {
        model = "mock";
        apiKey = "test";
        lastTools: any;

        async complete(messages: AgentMessage[], tools?: any) {
          this.lastTools = tools;
          return { content: "ok", finishReason: "stop" };
        }

        validateConfig() {
          return true;
        }

        supportsStreaming() {
          return false;
        }
      }

      const adapter = new MockAdapter();
      manager.registerAdapter("openai", adapter);

      const tools = [
        { name: "test_tool", description: "A test", parameters: {} },
      ];
      await manager.complete([{ role: "user", content: "Hi" }], tools);

      assert.isArray(adapter.lastTools);
      assert.lengthOf(adapter.lastTools, 1);
    });
  });

  describe("supportsStreaming", function () {
    it("should return true when adapter supports streaming", function () {
      class StreamingAdapter extends BaseLLMAdapter {
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

      manager.registerAdapter("openai", new StreamingAdapter());
      assert.isTrue(manager.supportsStreaming());
    });

    it("should return false when adapter does not support streaming", function () {
      class NonStreamingAdapter extends BaseLLMAdapter {
        model = "no-stream";
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

      manager.registerAdapter("openai", new NonStreamingAdapter());
      assert.isFalse(manager.supportsStreaming());
    });

    it("should return false when no adapter registered", function () {
      const freshManager = new (LLMManager as any)();
      (freshManager as any).adapters = new Map();
      assert.isFalse(freshManager.supportsStreaming());
    });
  });

  describe("validateConfig", function () {
    it("should return true when adapter config is valid", function () {
      class ValidAdapter extends BaseLLMAdapter {
        model = "valid";
        apiKey = "sk-valid";

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

      manager.registerAdapter("openai", new ValidAdapter());
      assert.isTrue(manager.validateConfig());
    });

    it("should return false when adapter config is invalid", function () {
      class InvalidAdapter extends BaseLLMAdapter {
        model = "invalid";
        apiKey = "";

        async complete() {
          return { content: "", finishReason: "stop" };
        }

        validateConfig() {
          return false;
        }

        supportsStreaming() {
          return false;
        }
      }

      manager.registerAdapter("openai", new InvalidAdapter());
      assert.isFalse(manager.validateConfig());
    });

    it("should return false when no adapter registered", function () {
      const freshManager = new (LLMManager as any)();
      (freshManager as any).adapters = new Map();
      assert.isFalse(freshManager.validateConfig());
    });
  });

  describe("initializeOpenAI", function () {
    it("should create and register OpenAI adapter", function () {
      const adapter = manager.initializeOpenAI("sk-test-key", "gpt-4");
      assert.equal(adapter.model, "gpt-4");
      assert.isTrue(manager.hasApiKey("openai"));
    });

    it("should use default model gpt-4", function () {
      const adapter = manager.initializeOpenAI("sk-test-key");
      assert.equal(adapter.model, "gpt-4");
    });

    it("should support custom base URL", function () {
      const adapter = manager.initializeOpenAI(
        "sk-test-key",
        "gpt-4",
        "https://custom.api.com",
      );
      assert.equal((adapter as any).baseUrl, "https://custom.api.com");
    });
  });
});
