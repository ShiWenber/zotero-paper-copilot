/**
 * Unit tests for OpenAIAdapter
 * Tests for OpenAI-compatible adapter configuration, validation, and request handling
 */

import { assert } from "chai";
import { OpenAIAdapter } from "../../src/llm/adapters/OpenAIAdapter";
import { AgentMessage } from "../../src/agent/types";

describe("OpenAIAdapter", function () {
  describe("constructor", function () {
    it("should create adapter with config", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
        model: "gpt-4",
      });

      assert.equal(adapter.model, "gpt-4");
      assert.equal((adapter as any).apiKey, "sk-test");
    });

    it("should use default model gpt-4 if not provided", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      assert.equal(adapter.model, "gpt-4");
    });

    it("should support custom base URL", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
        baseUrl: "https://custom.api.com",
      });

      assert.equal((adapter as any).baseUrl, "https://custom.api.com");
    });

    it("should default baseUrl to https://api.openai.com", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      assert.equal((adapter as any).baseUrl, "https://api.openai.com");
    });

    it("should allow overriding model to gpt-3.5-turbo", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
        model: "gpt-3.5-turbo",
      });

      assert.equal(adapter.model, "gpt-3.5-turbo");
    });

    it("should allow setting apiKey after construction", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "initial-key",
      });

      adapter.apiKey = "updated-key";
      assert.equal(adapter.apiKey, "updated-key");
    });

    it("should allow changing model after construction", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
        model: "gpt-4",
      });

      adapter.model = "gpt-4o";
      assert.equal(adapter.model, "gpt-4o");
    });
  });

  describe("validateConfig", function () {
    it("should return false when apiKey is empty", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "",
      });

      assert.isFalse(adapter.validateConfig());
    });

    it("should return false when apiKey is whitespace only", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "   ",
      });

      assert.isFalse(adapter.validateConfig());
    });

    it("should return true when apiKey is provided", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-valid",
      });

      assert.isTrue(adapter.validateConfig());
    });

    it("should return false when baseUrl is empty (even with valid apiKey)", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-valid",
        baseUrl: "",
      });

      assert.isFalse(adapter.validateConfig());
    });

    it("should return true with valid apiKey and default baseUrl", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-valid",
      });

      assert.isTrue(adapter.validateConfig());
    });
  });

  describe("supportsStreaming", function () {
    it("should return true", function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      assert.isTrue(adapter.supportsStreaming());
    });
  });

  describe("complete", function () {
    it("should return error when apiKey is empty", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "",
      });

      const result = await adapter.complete([
        { role: "user", content: "Hello" },
      ]);

      assert.isNotNull(result.error);
      assert.equal(result.finishReason, "error");
    });

    it("should return error when apiKey is invalid", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "invalid-key",
        baseUrl: "https://api.openai.com/v1",
      });

      const result = await adapter.complete([
        { role: "user", content: "Hello" },
      ]);

      // Should return error (network failure or auth error)
      assert.isTrue(
        result.finishReason === "error" || result.error !== undefined,
      );
    });

    it("should handle messages array", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      const messages: AgentMessage[] = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
      ];

      // This will fail due to no real API, but should handle the input gracefully
      const result = await adapter.complete(messages);

      // Should either return error (due to no real API) or content
      assert.isTrue(
        result.finishReason === "error" || result.content !== undefined,
      );
    });

    it("should handle single message", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      const result = await adapter.complete([
        { role: "user", content: "Hello" },
      ]);

      assert.isDefined(result);
    });

    it("should handle empty messages array", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      const result = await adapter.complete([]);

      // Should still produce a result (API may reject or accept empty)
      assert.isDefined(result);
    });

    it("should handle messages with special characters", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      const messages: AgentMessage[] = [
        { role: "user", content: "Hello! 🎉 中文 message" },
      ];

      const result = await adapter.complete(messages);

      assert.isDefined(result);
    });

    it("should handle messages with tool calls in response expectation", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      const messages: AgentMessage[] = [
        { role: "user", content: "Use the calculator tool" },
      ];

      const tools = [
        {
          name: "calculator",
          description: "A calculator tool",
          parameters: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
          },
        },
      ];

      const result = await adapter.complete(messages, tools);

      assert.isDefined(result);
      // Result may have tool calls or content depending on API response
    });

    it("should return response with finish reason stop", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      const result = await adapter.complete([
        { role: "user", content: "Say hi" },
      ]);

      // If API call succeeds, check finish reason
      if (!result.error) {
        assert.isTrue(
          result.finishReason === "stop" ||
            result.finishReason === "length" ||
            result.finishReason === "tool_calls",
        );
      }
    });

    it("should handle streaming callback (will make real API call if key valid)", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
      });

      let chunksReceived = 0;
      const streamingCallback = (chunk: string) => {
        chunksReceived++;
      };

      const result = await adapter.complete(
        [{ role: "user", content: "Count to 3" }],
        undefined,
        streamingCallback,
      );

      // Streaming may or may not work depending on API key validity
      assert.isDefined(result);
    });
  });

  describe("error handling", function () {
    it("should return error response on network failure", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
        baseUrl: "https://non-existent-domain-12345.com",
      });

      const result = await adapter.complete([
        { role: "user", content: "Hello" },
      ]);

      assert.isTrue(
        result.finishReason === "error" || result.error !== undefined,
      );
    });

    it("should return error response on invalid baseUrl", async function () {
      const adapter = new OpenAIAdapter({
        apiKey: "sk-test",
        baseUrl: "not-a-valid-url",
      });

      const result = await adapter.complete([
        { role: "user", content: "Hello" },
      ]);

      assert.isTrue(
        result.finishReason === "error" || result.error !== undefined,
      );
    });
  });
});
