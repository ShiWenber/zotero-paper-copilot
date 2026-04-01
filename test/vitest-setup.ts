/**
 * Vitest setup file — runs before each test file.
 *
 * Provides minimal Zotero mock globals so unit tests that reference
 * Zotero globals (e.g. startup.test.ts) don't crash in Node.js.
 * Also provides fetch mock for HTTP tests.
 */

import { config } from "../package.json";

// Minimal Zotero mock for startup/environment tests
(globalThis as typeof globalThis & { Zotero?: unknown }).Zotero = {
  initializationPromise: Promise.resolve(),
  unlockPromise: Promise.resolve(),
  uiReadyPromise: Promise.resolve(),
  // @ts-expect-error – mock addon instance
  [config.addonInstance]: { data: { initialized: true } },
};
