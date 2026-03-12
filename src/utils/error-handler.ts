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
export const ERROR_MESSAGES: Record<string, { user: string; debug?: string }> = {
  // LLM API Errors
  "LLM_API_KEY_MISSING": {
    user: "API key not configured. Please set your API key in plugin preferences.",
    debug: "LLM API key is missing or empty",
  },
  "LLM_API_KEY_INVALID": {
    user: "API key is invalid. Please check your API key in plugin preferences.",
    debug: "LLM API key validation failed",
  },
  "LLM_PROVIDER_ERROR": {
    user: "AI service temporarily unavailable. Please try again later.",
    debug: "LLM provider returned an error",
  },
  "LLM_RATE_LIMIT": {
    user: "Too many requests. Please wait a moment and try again.",
    debug: "Rate limit exceeded for LLM API",
  },
  "LLM_TIMEOUT": {
    user: "Request timed out. Please check your internet connection and try again.",
    debug: "LLM API request timed out",
  },
  
  // Network Errors
  "NETWORK_OFFLINE": {
    user: "You appear to be offline. Please check your internet connection.",
    debug: "Network is offline",
  },
  "NETWORK_TIMEOUT": {
    user: "Request timed out. Please check your internet connection.",
    debug: "Network request timed out",
  },
  "NETWORK_ERROR": {
    user: "Network error occurred. Please try again.",
    debug: "Generic network error",
  },
  
  // PDF Errors
  "PDF_PARSE_ERROR": {
    user: "Failed to parse PDF. The file may be corrupted or password-protected.",
    debug: "PDF parsing failed",
  },
  "PDF_NO_SELECTION": {
    user: "No text selected. Please select some text in the PDF first.",
    debug: "No text selected by user",
  },
  "PDF_READER_NOT_FOUND": {
    user: "No PDF document open. Please open a PDF in Zotero first.",
    debug: "Zotero reader not found",
  },
  
  // Zotero Errors
  "ZOTERO_ITEM_NOT_FOUND": {
    user: "Could not find the selected item in your library.",
    debug: "Zotero item not found",
  },
  "ZOTERO_SYNC_ERROR": {
    user: "Failed to sync with Zotero. Your changes may not be saved.",
    debug: "Zotero sync failed",
  },
  
  // Config Errors
  "CONFIG_INVALID": {
    user: "Invalid configuration. Please check plugin settings.",
    debug: "Configuration is invalid",
  },
  "CONFIG_MISSING": {
    user: "Required configuration is missing. Please check plugin settings.",
    debug: "Required configuration not found",
  },
  
  // Generic Errors
  "UNKNOWN_ERROR": {
    user: "An unexpected error occurred. Please try again.",
    debug: "Unknown error",
  },
  "INITIALIZATION_ERROR": {
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
    return Zotero?.Addons?.get?.("paper-copilot@github.com")?.version || "unknown";
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
        this.handleError(event.reason || new Error("Unhandled Promise rejection"), {
          unhandledPromise: true,
        });
      });
    }
    
    // Handle Zotero-specific errors
    if (typeof Zotero !== "undefined") {
      Zotero.debug = Zotero.debug || function() {};
      
      // Wrap Zotero promise rejections
      const originalDebug = Zotero.debug;
      Zotero.debug = function(...args: any[]) {
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
    context?: Record<string, any>
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
        if (errorMessage.toLowerCase().includes(code.toLowerCase().replace(/_/g, " "))) {
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
    context?: Record<string, any>
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
        if (error.message.toLowerCase().includes(code.toLowerCase().replace(/_/g, " "))) {
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
    
    if (message.toLowerCase().includes("network") || message.toLowerCase().includes("offline")) {
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
        console.error(prefix, entry.message, entry.stack || "", entry.context || "");
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
    return this.logs.filter(log => log.level === level);
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

/**
 * Decorator for error handling
 */
export function errorHandler(
  errorCode?: string,
  notifyUser: boolean = false
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const errorToHandle = errorCode || (error instanceof Error ? error : new Error(String(error)));
        
        if (notifyUser) {
          ErrorHandler.handleErrorWithNotification(errorToHandle, {
            method: String(propertyKey),
            args: args.map(arg => typeof arg === "object" ? "[object]" : arg),
          });
        } else {
          ErrorHandler.handleError(errorToHandle, {
            method: String(propertyKey),
            args: args.map(arg => typeof arg === "object" ? "[object]" : arg),
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
  context?: Record<string, any>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const errorToHandle = errorCode || (error instanceof Error ? error : new Error(String(error)));
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
