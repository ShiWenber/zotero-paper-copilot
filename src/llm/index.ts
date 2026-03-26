/**
 * LLM Module - Multi-Model LLM Adapter System
 *
 * Provides a unified interface for interacting with multiple LLM providers:
 * - OpenAI (GPT-4, GPT-3.5-turbo, and OpenAI-compatible APIs)
 * - Anthropic Claude (stub)
 * - Google Gemini (stub)
 */

export {
  BaseLLMAdapter,
  LLMResponse,
  StreamingCallback,
} from "./adapters/base/BaseLLMAdapter";
export { OpenAIAdapter } from "./adapters/OpenAIAdapter";
export { ClaudeAdapter } from "./adapters/ClaudeAdapter";
export { GeminiAdapter } from "./adapters/GeminiAdapter";
export { LLMManager, LLMProvider } from "./LLMManager";
