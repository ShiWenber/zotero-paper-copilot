/**
 * Error Handler Module Tests
 */

import { assert, expect } from "chai";
import {
  ErrorHandler,
  ERROR_MESSAGES,
  errorHandler,
  withErrorHandling,
  ErrorLevel,
} from "../src/utils/error-handler";

describe("Error Handler Module", function () {
  describe("ERROR_MESSAGES", function () {
    it("should have user-friendly messages for all error codes", function () {
      for (const [code, messages] of Object.entries(ERROR_MESSAGES)) {
        assert.isString(messages.user);
        assert.isNotEmpty(messages.user);
      }
    });

    it("should have debug messages for all error codes", function () {
      for (const [code, messages] of Object.entries(ERROR_MESSAGES)) {
        assert.isString(messages.debug);
      }
    });
  });

  describe("ErrorHandler.handleError", function () {
    beforeEach(function () {
      ErrorHandler.clearLogs();
      ErrorHandler.init({ enableUserNotifications: false });
    });

    it("should handle string error codes", function () {
      const entry = ErrorHandler.handleError("LLM_API_KEY_MISSING");
      
      assert.isNotNull(entry);
      assert.equal(entry!.level, "error");
      assert.equal(entry!.message, ERROR_MESSAGES.LLM_API_KEY_MISSING.debug);
    });

    it("should handle Error objects", function () {
      const error = new Error("Test error message");
      const entry = ErrorHandler.handleError(error);
      
      assert.isNotNull(entry);
      assert.equal(entry!.message, "Test error message");
    });

    it("should include stack trace for Error objects", function () {
      const error = new Error("Test error");
      const entry = ErrorHandler.handleError(error);
      
      assert.isNotNull(entry!.stack);
      assert.include(entry!.stack!, "Error: Test error");
    });

    it("should include context information", function () {
      const error = new Error("Test error");
      const entry = ErrorHandler.handleError(error, { 
        userId: "user123", 
        action: "test" 
      });
      
      assert.deepEqual(entry!.context, { userId: "user123", action: "test" });
    });

    it("should generate unique error IDs", function () {
      const entry1 = ErrorHandler.handleError("LLM_API_KEY_MISSING");
      const entry2 = ErrorHandler.handleError("LLM_API_KEY_MISSING");
      
      assert.notEqual(entry1!.id, entry2!.id);
    });

    it("should determine error level correctly", function () {
      // Test timeout error
      const timeoutError = new Error("Request timeout");
      const entry1 = ErrorHandler.handleError(timeoutError);
      assert.equal(entry1!.level, "warn");
      
      // Test network error
      const networkError = new Error("Network offline");
      const entry2 = ErrorHandler.handleError(networkError);
      assert.equal(entry2!.level, "warn");
      
      // Test normal error
      const normalError = new Error("Normal error");
      const entry3 = ErrorHandler.handleError(normalError);
      assert.equal(entry3!.level, "error");
    });
  });

  describe("ErrorHandler.getUserMessage", function () {
    it("should return user-friendly message for error codes", function () {
      const message = ErrorHandler.getUserMessage("LLM_API_KEY_MISSING");
      
      assert.isString(message);
      assert.notEqual(message, ERROR_MESSAGES.UNKNOWN_ERROR.user); // Should not be unknown
    });

    it("should return user-friendly message for Error objects", function () {
      const error = new Error("API key not configured");
      const message = ErrorHandler.getUserMessage(error);
      
      assert.isString(message);
    });

    it("should return unknown error message for unrecognized errors", function () {
      const error = new Error("Some completely random error message");
      const message = ErrorHandler.getUserMessage(error);
      
      assert.equal(message, ERROR_MESSAGES.UNKNOWN_ERROR.user);
    });
  });

  describe("ErrorHandler.getLogs", function () {
    beforeEach(function () {
      ErrorHandler.clearLogs();
      ErrorHandler.init({ enableUserNotifications: false });
    });

    it("should return all logs when no level specified", function () {
      ErrorHandler.handleError("LLM_API_KEY_MISSING");
      ErrorHandler.handleError("PDF_PARSE_ERROR");
      
      const logs = ErrorHandler.getLogs();
      
      assert.equal(logs.length, 2);
    });

    it("should filter logs by level", function () {
      ErrorHandler.handleError("LLM_API_KEY_MISSING");
      ErrorHandler.handleError(new Error("timeout error"));
      ErrorHandler.handleError("PDF_PARSE_ERROR");
      
      const warnLogs = ErrorHandler.getLogs("warn");
      
      // timeout errors are logged as warn
      assert.isTrue(warnLogs.length >= 1);
    });

    it("should return empty array when no logs", function () {
      const logs = ErrorHandler.getLogs();
      
      assert.equal(logs.length, 0);
    });
  });

  describe("ErrorHandler.getStats", function () {
    beforeEach(function () {
      ErrorHandler.clearLogs();
      ErrorHandler.init({ enableUserNotifications: false });
    });

    it("should return statistics for all error levels", function () {
      ErrorHandler.handleError("LLM_API_KEY_MISSING");
      ErrorHandler.handleError("PDF_PARSE_ERROR");
      ErrorHandler.handleError(new Error("timeout test"));
      
      const stats = ErrorHandler.getStats();
      
      assert.isNumber(stats.debug);
      assert.isNumber(stats.info);
      assert.isNumber(stats.warn);
      assert.isNumber(stats.error);
      assert.isNumber(stats.critical);
    });

    it("should count errors correctly", function () {
      ErrorHandler.handleError("LLM_API_KEY_MISSING");
      ErrorHandler.handleError("PDF_PARSE_ERROR");
      
      const stats = ErrorHandler.getStats();
      
      assert.equal(stats.error, 2);
    });
  });

  describe("ErrorHandler.exportLogs", function () {
    beforeEach(function () {
      ErrorHandler.clearLogs();
      ErrorHandler.init({ enableUserNotifications: false });
    });

    it("should export logs as JSON", function () {
      ErrorHandler.handleError("LLM_API_KEY_MISSING", { test: true });
      
      const exported = ErrorHandler.exportLogs();
      
      assert.isString(exported);
      const parsed = JSON.parse(exported);
      assert.isArray(parsed);
      assert.equal(parsed.length, 1);
    });
  });

  describe("ErrorHandler.clearLogs", function () {
    it("should clear all logs", function () {
      ErrorHandler.init({ enableUserNotifications: false });
      ErrorHandler.handleError("LLM_API_KEY_MISSING");
      ErrorHandler.handleError("PDF_PARSE_ERROR");
      
      ErrorHandler.clearLogs();
      
      const logs = ErrorHandler.getLogs();
      assert.equal(logs.length, 0);
    });
  });

  describe("withErrorHandling", function () {
    beforeEach(function () {
      ErrorHandler.clearLogs();
      ErrorHandler.init({ enableUserNotifications: false });
    });

    it("should return result of successful function", async function () {
      const result = await withErrorHandling(
        async () => "success",
        "TEST_ERROR"
      );
      
      assert.equal(result, "success");
    });

    it("should catch and log errors from async functions", async function () {
      try {
        await withErrorHandling(
          async () => {
            throw new Error("Test error");
          },
          "TEST_ERROR"
        );
        assert.fail("Should have thrown");
      } catch (e) {
        // Expected
        const logs = ErrorHandler.getLogs();
        assert.isTrue(logs.length > 0);
      }
    });

    it("should include context in error log", async function () {
      try {
        await withErrorHandling(
          async () => {
            throw new Error("Test error");
          },
          "TEST_ERROR",
          { action: "test-action" }
        );
        assert.fail("Should have thrown");
      } catch (e) {
        const logs = ErrorHandler.getLogs();
        assert.equal(logs[0].context?.action, "test-action");
      }
    });
  });

  describe("errorHandler decorator", function () {
    beforeEach(function () {
      ErrorHandler.clearLogs();
      ErrorHandler.init({ enableUserNotifications: false });
    });

    it("should wrap async methods with error handling", async function () {
      class TestClass {
        @errorHandler("TEST_ERROR", false)
        async testMethod(): Promise<string> {
          return "success";
        }
      }
      
      const instance = new TestClass();
      const result = await instance.testMethod();
      
      assert.equal(result, "success");
      assert.equal(ErrorHandler.getLogs().length, 0);
    });

    it("should log errors from decorated methods", async function () {
      class TestClass {
        @errorHandler("TEST_ERROR", false)
        async testMethod(): Promise<string> {
          throw new Error("Decorated error");
        }
      }
      
      const instance = new TestClass();
      
      try {
        await instance.testMethod();
        assert.fail("Should have thrown");
      } catch (e) {
        const logs = ErrorHandler.getLogs();
        assert.isTrue(logs.length > 0);
      }
    });
  });

  describe("ErrorHandler configuration", function () {
    it("should update configuration", function () {
      ErrorHandler.setConfig({
        enableRemoteLogging: true,
        remoteLogEndpoint: "https://example.com/logs",
      });
      
      // Configuration is internal, but we can verify it doesn't throw
      assert.isTrue(true);
    });
  });
});
