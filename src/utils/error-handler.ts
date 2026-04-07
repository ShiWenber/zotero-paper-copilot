/**
 * Zotero Paper Copilot - Error Handler Module
 *
 * Global error boundary, exception handling, user-friendly error messages
 * Error logging (local + remote)
 */

export type ErrorLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: ErrorLevel;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAgent?: string;
  pluginVersion?: string;
}

export interface ErrorHandlerConfig {
  enableRemoteLogging: boolean;
  remoteLogEndpoint?: string;
  maxLocalLogs: number;
  enableUserNotifications: boolean;
}

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES: Record<string, { user: string; debug?: string }> =
  {
    // LLM API Errors
    LLM_API_KEY_MISSING: {
      user: "API key not configured. Please set your API key in plugin preferences.",
      debug: "LLM API key is missing or empty",
    },
    LLM_API_KEY_INVALID: {
      user: "API key is invalid. Please check your API key in plugin preferences.",
      debug: "LLM API key validation failed",
    },
    LLM_PROVIDER_ERROR: {
      user: "AI service temporarily unavailable. Please try again later.",
      debug: "LLM provider returned an error",
    },
    LLM_RATE_LIMIT: {
      user: "Too many requests. Please wait a moment and try again.",
      debug: "Rate limit exceeded for LLM API",
    },
    LLM_TIMEOUT: {
      user: "Request timed out. Please check your internet connection and try again.",
      debug: "LLM API request timed out",
    },

    // Network Errors
    NETWORK_OFFLINE: {
      user: "You appear to be offline. Please check your internet connection.",
      debug: "Network is offline",
    },
    NETWORK_TIMEOUT: {
      user: "Request timed out. Please check your internet connection.",
      debug: "Network request timed out",
    },
    NETWORK_ERROR: {
      user: "Network error occurred. Please try again.",
      debug: "Generic network error",
    },

    // PDF Errors
    PDF_PARSE_ERROR: {
      user: "Failed to parse PDF. The file may be corrupted or password-protected.",
      debug: "PDF parsing failed",
    },
    PDF_NO_SELECTION: {
      user: "No text selected. Please select some text in the PDF first.",
      debug: "No text selected by user",
    },
    PDF_READER_NOT_FOUND: {
      user: "No PDF document open. Please open a PDF in Zotero first.",
      debug: "Zotero reader not found",
    },

    // Zotero Errors
    ZOTERO_ITEM_NOT_FOUND: {
      user: "Could not find the selected item in your library.",
      debug: "Zotero item not found",
    },
    ZOTERO_SYNC_ERROR: {
      user: "Failed to sync with Zotero. Your changes may not be saved.",
      debug: "Zotero sync failed",
    },

    // Config Errors
    CONFIG_INVALID: {
      user: "Invalid configuration. Please check plugin settings.",
      debug: "Configuration is invalid",
    },
    CONFIG_MISSING: {
      user: "Required configuration is missing. Please check plugin settings.",
      debug: "Required configuration not found",
    },

    // Generic Errors
    UNKNOWN_ERROR: {
      user: "An unexpected error occurred. Please try again.",
      debug: "Unknown error",
    },
    INITIALIZATION_ERROR: {
      user: "Failed to initialize plugin. Please restart Zotero.",
      debug: "Plugin initialization failed",
    },
  };

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get plugin version
 */
function getPluginVersion(): string {
  try {
    return (
      Zotero?.Addons?.get?.("paper-copilot@github.com")?.version || "unknown"
    );
  } catch {
    return "unknown";
  }
}

/**
 * Error Handler class
 */
export class ErrorHandler {
  private static config: ErrorHandlerConfig = {
    enableRemoteLogging: false,
    maxLocalLogs: 100,
    enableUserNotifications: true,
  };

  private static logs: ErrorLogEntry[] = [];
  private static initialized = false;

  /**
   * Initialize error handler
   * @param config - Configuration options
   */
  public static init(config?: Partial<ErrorHandlerConfig>): void {
    if (this.initialized) return;

    this.config = {
      ...this.config,
      ...config,
    };

    this.initialized = true;

    // Set up global error handler
    this.setupGlobalErrorHandler();

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Error handler initialized");
    }
  }

  /**
   * Set up global error handlers
   */
  private static setupGlobalErrorHandler(): void {
    // Handle uncaught exceptions
    if (typeof window !== "undefined") {
      window.addEventListener("error", (event) => {
        this.handleError(event.error || new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });

      window.addEventListener("unhandledrejection", (event) => {
        this.handleError(
          event.reason || new Error("Unhandled Promise rejection"),
          {
            unhandledPromise: true,
          },
        );
      });
    }

    // Handle Zotero-specific errors
    if (typeof Zotero !== "undefined") {
      Zotero.debug = Zotero.debug || function () {};

      // Wrap Zotero promise rejections
      const originalDebug = Zotero.debug;
      Zotero.debug = function (...args: any[]) {
        // Check for error patterns
        const message = args.join(" ");
        if (message.includes("Error") || message.includes("Exception")) {
          this.handleError(new Error(message), { source: "Zotero.debug" });
        }
        return originalDebug.apply(this, args);
      }.bind(this);
    }
  }

  /**
   * Handle an error
   * @param error - Error object or error code
   * @param context - Additional context
   */
  public static handleError(
    error: Error | string,
    context?: Record<string, any>,
  ): ErrorLogEntry | null {
    // Get error code and message
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage: string;
    let stack: string | undefined;

    if (typeof error === "string") {
      errorCode = error;
      errorMessage = ERROR_MESSAGES[error]?.debug || error;
    } else {
      errorMessage = error.message;
      stack = error.stack;

      // Try to match error message to known error codes
      for (const [code, messages] of Object.entries(ERROR_MESSAGES)) {
        if (
          errorMessage
            .toLowerCase()
            .includes(code.toLowerCase().replace(/_/g, " "))
        ) {
          errorCode = code;
          break;
        }
      }
    }

    // Create log entry
    const entry: ErrorLogEntry = {
      id: generateErrorId(),
      timestamp: new Date().toISOString(),
      level: this.determineErrorLevel(error),
      message: errorMessage,
      stack,
      context,
      pluginVersion: getPluginVersion(),
    };

    // Add to local logs
    this.addLog(entry);

    // Log to console
    this.logToConsole(entry);

    // Send to remote if enabled
    if (this.config.enableRemoteLogging && this.config.remoteLogEndpoint) {
      this.sendToRemote(entry);
    }

    return entry;
  }

  /**
   * Handle error and notify user
   * @param error - Error object or error code
   * @param context - Additional context
   */
  public static handleErrorWithNotification(
    error: Error | string,
    context?: Record<string, any>,
  ): ErrorLogEntry | null {
    const entry = this.handleError(error, context);

    if (entry && this.config.enableUserNotifications) {
      this.notifyUser(error);
    }

    return entry;
  }

  /**
   * Get user-friendly error message
   * @param error - Error object or error code
   * @returns User-friendly message
   */
  public static getUserMessage(error: Error | string): string {
    let errorCode: string;

    if (typeof error === "string") {
      errorCode = error;
    } else {
      errorCode = "UNKNOWN_ERROR";

      // Match error to known codes
      for (const [code, messages] of Object.entries(ERROR_MESSAGES)) {
        if (
          error.message
            .toLowerCase()
            .includes(code.toLowerCase().replace(/_/g, " "))
        ) {
          errorCode = code;
          break;
        }
      }
    }

    return ERROR_MESSAGES[errorCode]?.user || ERROR_MESSAGES.UNKNOWN_ERROR.user;
  }

  /**
   * Notify user of error
   * @param error - Error object or error code
   */
  private static notifyUser(error: Error | string): void {
    const message = this.getUserMessage(error);

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.alert("Paper Copilot Error", message);
    } else if (typeof window !== "undefined") {
      // Fallback to browser alert
      window.alert(`Paper Copilot Error\n\n${message}`);
    }
  }

  /**
   * Determine error level based on error
   */
  private static determineErrorLevel(error: Error | string): ErrorLevel {
    const message = typeof error === "string" ? error : error.message;
    const stack = typeof error === "string" ? undefined : error.stack;

    if (stack?.includes("fatal") || stack?.includes("crash")) {
      return "critical";
    }

    if (message.toLowerCase().includes("timeout")) {
      return "warn";
    }

    if (
      message.toLowerCase().includes("network") ||
      message.toLowerCase().includes("offline")
    ) {
      return "warn";
    }

    return "error";
  }

  /**
   * Add log entry to local storage
   */
  private static addLog(entry: ErrorLogEntry): void {
    this.logs.push(entry);

    // Trim old logs
    if (this.logs.length > this.config.maxLocalLogs) {
      this.logs = this.logs.slice(-this.config.maxLocalLogs);
    }
  }

  /**
   * Log to console
   */
  private static logToConsole(entry: ErrorLogEntry): void {
    const prefix = `[PaperCopilot:${entry.level.toUpperCase()}]`;

    switch (entry.level) {
      case "debug":
        console.debug(prefix, entry.message, entry.context || "");
        break;
      case "info":
        console.info(prefix, entry.message, entry.context || "");
        break;
      case "warn":
        console.warn(prefix, entry.message, entry.context || "");
        break;
      case "error":
      case "critical":
        console.error(
          prefix,
          entry.message,
          entry.stack || "",
          entry.context || "",
        );
        break;
    }
  }

  /**
   * Send log to remote endpoint
   */
  private static async sendToRemote(entry: ErrorLogEntry): Promise<void> {
    if (!this.config.remoteLogEndpoint) return;

    try {
      await fetch(this.config.remoteLogEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      });
    } catch (e) {
      // Silently fail - don't cause recursive errors
      console.error("Failed to send error log to remote:", e);
    }
  }

  /**
   * Get all error logs
   */
  public static getLogs(level?: ErrorLevel): ErrorLogEntry[] {
    if (!level) return [...this.logs];
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Clear error logs
   */
  public static clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs for debugging
   */
  public static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get error statistics
   */
  public static getStats(): Record<ErrorLevel, number> {
    const stats: Record<ErrorLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    for (const log of this.logs) {
      stats[log.level]++;
    }

    return stats;
  }

  /**
   * Update configuration
   */
  public static setConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============== Toast Notification System ==============

export interface ToastOptions {
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
  title?: string;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  title?: string;
  duration: number;
  element?: HTMLElement;
}

/**
 * Toast notification manager for non-blocking user feedback
 */
export class ToastManager {
  private static containerId = "paper-copilot-toast-container";
  private static notifications: Map<string, ToastNotification> = new Map();
  private static defaultDuration = 4000;

  /**
   * Show a toast notification
   */
  public static show(options: ToastOptions): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const {
      message,
      type = "info",
      duration = this.defaultDuration,
      title,
    } = options;

    // Ensure container exists
    this.ensureContainer();

    // Create toast element
    const toast = document.createElement("div");
    toast.id = id;
    toast.className = `paper-copilot-toast paper-copilot-toast-${type}`;
    toast.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 8px;
      background: ${this.getBackgroundColor(type)};
      border-left: 4px solid ${this.getBorderColor(type)};
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: paperCopilotToastSlideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      max-width: 350px;
      opacity: 0;
      transform: translateX(100%);
      transition: opacity 0.3s, transform 0.3s;
    `;

    const icon = this.getIcon(type);
    const titleHtml = title ? `<strong style="display: block; margin-bottom: 4px;">${title}</strong>` : "";

    toast.innerHTML = `
      <span style="font-size: 18px; flex-shrink: 0;">${icon}</span>
      <div style="flex: 1; color: #333;">
        ${titleHtml}
        <span style="line-height: 1.4;">${message}</span>
      </div>
      <button class="toast-close" style="
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        color: #666;
        flex-shrink: 0;
        line-height: 1;
      ">×</button>
    `;

    // Add close button handler
    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.dismiss(id));
    }

    // Add to container
    const container = document.getElementById(this.containerId);
    container?.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    });

    // Store notification
    const notification: ToastNotification = {
      id,
      message,
      type,
      title,
      duration,
      element: toast,
    };
    this.notifications.set(id, notification);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  /**
   * Show success toast
   */
  public static success(message: string, title?: string, duration?: number): string {
    return this.show({ message, type: "success", title, duration });
  }

  /**
   * Show error toast
   */
  public static error(message: string, title?: string, duration?: number): string {
    return this.show({ message, type: "error", title, duration: duration || 6000 });
  }

  /**
   * Show warning toast
   */
  public static warning(message: string, title?: string, duration?: number): string {
    return this.show({ message, type: "warning", title, duration });
  }

  /**
   * Show info toast
   */
  public static info(message: string, title?: string, duration?: number): string {
    return this.show({ message, type: "info", title, duration });
  }

  /**
   * Dismiss a toast notification
   */
  public static dismiss(id: string): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    const toast = notification.element;
    if (toast) {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      
      setTimeout(() => {
        toast.remove();
      }, 300);
    }

    this.notifications.delete(id);
  }

  /**
   * Dismiss all notifications
   */
  public static dismissAll(): void {
    for (const id of this.notifications.keys()) {
      this.dismiss(id);
    }
  }

  /**
   * Ensure toast container exists
   */
  private static ensureContainer(): void {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = this.containerId;
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
      `;
      document.body.appendChild(container);

      // Add animation styles
      const style = document.createElement("style");
      style.textContent = `
        @keyframes paperCopilotToastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private static getBackgroundColor(type: string): string {
    switch (type) {
      case "success": return "#e8f5e9";
      case "error": return "#ffebee";
      case "warning": return "#fff3e0";
      default: return "#e3f2fd";
    }
  }

  private static getBorderColor(type: string): string {
    switch (type) {
      case "success": return "#4caf50";
      case "error": return "#f44336";
      case "warning": return "#ff9800";
      default: return "#2196f3";
    }
  }

  private static getIcon(type: string): string {
    switch (type) {
      case "success": return "✅";
      case "error": return "❌";
      case "warning": return "⚠️";
      default: return "ℹ️";
    }
  }
}

// ============== Retry Mechanism ==============

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: ((error: any) => boolean) | RegExp[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryableErrors = [
      /network/i,
      /timeout/i,
      /rate.limit/i,
      /429/,
      /503/,
      /502/,
    ],
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (attempt === maxAttempts) {
        break;
      }

      // Check if error is retryable
      const isRetryable = Array.isArray(retryableErrors)
        ? retryableErrors.some((pattern) => {
            if (pattern instanceof RegExp) {
              return pattern.test(lastError.message);
            }
            if (typeof pattern === "function") {
              return pattern(lastError);
            }
            return false;
          })
        : retryableErrors(lastError);

      if (!isRetryable) {
        throw lastError;
      }

      // Call onRetry callback
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Decorator for automatic retry on failure
 */
export function withRetryDecorator(options: RetryOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        options,
      );
    };

    return descriptor;
  };
}

// ============== Enhanced Error Handler Integration ==============

// Override ErrorHandler.notifyUser to use Toast when available
const originalNotifyUser = ErrorHandler.notifyUser.bind(ErrorHandler);
ErrorHandler.notifyUser = function(error: Error | string): void {
  // Try Toast first for non-critical errors
  const message = this.getUserMessage(error);
  
  if (typeof ToastManager !== "undefined") {
    const errorCode = typeof error === "string" ? error : "UNKNOWN_ERROR";
    if (errorCode.includes("timeout") || errorCode.includes("rate")) {
      ToastManager.warning(message, "Paper Copilot");
    } else {
      ToastManager.error(message, "Paper Copilot");
    }
  } else {
    // Fallback to original behavior
    originalNotifyUser(error);
  }
};

/**
 * Decorator for error handling
 */
export function errorHandler(
  errorCode?: string,
  notifyUser: boolean = false,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const errorToHandle =
          errorCode ||
          (error instanceof Error ? error : new Error(String(error)));

        if (notifyUser) {
          ErrorHandler.handleErrorWithNotification(errorToHandle, {
            method: String(propertyKey),
            args: args.map((arg) =>
              typeof arg === "object" ? "[object]" : arg,
            ),
          });
        } else {
          ErrorHandler.handleError(errorToHandle, {
            method: String(propertyKey),
            args: args.map((arg) =>
              typeof arg === "object" ? "[object]" : arg,
            ),
          });
        }

        // Re-throw for callers that expect errors
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Async wrapper with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorCode?: string,
  context?: Record<string, any>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const errorToHandle =
      errorCode || (error instanceof Error ? error : new Error(String(error)));
    ErrorHandler.handleError(errorToHandle, context);
    throw error;
  }
}

/**
 * Initialize error handler on module load
 */
export function initErrorHandler(): void {
  ErrorHandler.init();
}
