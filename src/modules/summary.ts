/**
 * Zotero Paper Copilot - Summary Module
 * 
 * Generate detailed paper summaries using LLM API
 * Extracts paper metadata and generates comprehensive summaries
 */

import { LLMAPI, ChatMessage } from "./llm-api";

export interface PaperInfo {
  title?: string;
  authors?: string[];
  abstract?: string;
  year?: number;
  journal?: string;
  doi?: string;
}

export interface SummaryOptions {
  includeKeyFindings?: boolean;
  includeMethods?: boolean;
  includeLimitations?: boolean;
  maxLength?: number;
  stream?: boolean;
}

export interface SummaryResult {
  summary: string;
  keyFindings?: string[];
  methods?: string;
  limitations?: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamSummaryCallback {
  (chunk: string): void;
  onComplete?: (result: SummaryResult) => void;
  onError?: (error: Error) => void;
}

export class PaperSummary {
  private static initialized = false;
  
  /**
   * Initialize the summary module
   */
  public static init(): void {
    if (this.initialized) {
      return;
    }
    
    this.initialized = true;
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Summary module initialized");
    }
  }
  
  /**
   * Extract paper metadata from Zotero item
   */
  public static async extractPaperInfo(item: any): Promise<PaperInfo> {
    const info: PaperInfo = {};
    
    try {
      if (!item) {
        return info;
      }
      
      // Get title
      info.title = item.getField?.("title") || item.title;
      
      // Get authors
      const creators = item.getField?.("creators") || item.creators;
      if (creators && Array.isArray(creators)) {
        info.authors = creators.map((c: any) => {
          if (c.firstName || c.lastName) {
            return `${c.firstName || ""} ${c.lastName || ""}`.trim();
          }
          return c.name || "";
        }).filter(Boolean);
      }
      
      // Get publication info
      info.journal = item.getField?.("publicationTitle") || item.publicationTitle;
      info.year = item.getField?.("year") || item.year;
      info.doi = item.getField?.("DOI") || item.DOI;
      
      // Get abstract (may be in different fields depending on item type)
      info.abstract = item.getField?.("abstractNote") || item.abstractNote;
      
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error extracting paper info:", e);
      }
    }
    
    return info;
  }
  
  /**
   * Generate a comprehensive summary of the paper
   */
  public static async generateSummary(
    paperInfo: PaperInfo,
    options?: SummaryOptions
  ): Promise<SummaryResult> {
    const opts = {
      includeKeyFindings: true,
      includeMethods: true,
      includeLimitations: false,
      maxLength: 500,
      ...options,
    };
    
    if (!LLMAPI.isConfigured()) {
      throw new Error("LLM API not configured. Please set up your API key in preferences.");
    }
    
    // Build prompt based on options
    const messages = this.buildSummaryPrompt(paperInfo, opts);
    
    // Make API call
    const response = await LLMAPI.chat(messages, {
      temperature: 0.5,
      maxTokens: opts.maxLength ? opts.maxLength * 4 : 2000,
    });
    
    // Parse response
    return this.parseSummaryResponse(response.content, response.model, response.usage);
  }
  
  /**
   * Generate summary with streaming output
   */
  public static async generateSummaryStream(
    paperInfo: PaperInfo,
    callback: StreamSummaryCallback,
    options?: SummaryOptions
  ): Promise<SummaryResult> {
    const opts = {
      includeKeyFindings: true,
      includeMethods: true,
      includeLimitations: false,
      maxLength: 500,
      ...options,
    };
    
    if (!LLMAPI.isConfigured()) {
      throw new Error("LLM API not configured. Please set up your API key in preferences.");
    }
    
    // Build prompt based on options
    const messages = this.buildSummaryPrompt(paperInfo, opts);
    
    let fullContent = "";
    let fullResult: SummaryResult | null = null;
    
    // Make streaming API call
    const response = await LLMAPI.chat(messages, {
      stream: (chunk) => {
        fullContent += chunk;
        callback(chunk);
      },
      temperature: 0.5,
      maxTokens: opts.maxLength ? opts.maxLength * 4 : 2000,
    });
    
    // Build result
    fullResult = this.parseSummaryResponse(fullContent, response.model);
    
    callback.onComplete?.(fullResult);
    
    return fullResult;
  }
  
  /**
   * Build summary prompt based on paper info and options
   */
  private static buildSummaryPrompt(paperInfo: PaperInfo, options: SummaryOptions): ChatMessage[] {
    const parts: string[] = [];
    
    // Title
    if (paperInfo.title) {
      parts.push(`Paper Title: ${paperInfo.title}`);
    }
    
    // Authors
    if (paperInfo.authors && paperInfo.authors.length > 0) {
      parts.push(`Authors: ${paperInfo.authors.join(", ")}`);
    }
    
    // Year and journal
    if (paperInfo.year) {
      parts.push(`Year: ${paperInfo.year}`);
    }
    if (paperInfo.journal) {
      parts.push(`Journal: ${paperInfo.journal}`);
    }
    
    // Abstract
    if (paperInfo.abstract) {
      parts.push(`\nAbstract:\n${paperInfo.abstract}`);
    }
    
    // Build system prompt
    let systemPrompt = `You are a helpful academic research assistant. 
Your task is to provide a clear and comprehensive summary of the given research paper.
`;
    
    const userInstructions: string[] = [];
    
    userInstructions.push("Please provide a detailed summary of this paper that includes:");
    userInstructions.push("1. **Main Research Question/Objective**: What problem does this paper address?");
    userInstructions.push("2. **Key Methods**: What methodology or approach did the authors use?");
    userInstructions.push("3. **Main Findings**: What are the most important results or discoveries?");
    userInstructions.push("4. **Conclusions**: What conclusions do the authors draw? What are the implications?");
    
    if (options.includeKeyFindings) {
      userInstructions.push("5. **Key Findings (Bullet Points)**: List 3-5 key findings in bullet point format");
    }
    
    if (options.includeMethods) {
      userInstructions.push("6. **Methodology Details**: Provide more detail about the research methods used");
    }
    
    if (options.includeLimitations) {
      userInstructions.push("7. **Limitations**: What are the limitations mentioned by the authors?");
    }
    
    userInstructions.push("\nFormat the summary with clear headings and bullet points for readability.");
    userInstructions.push(`Keep the summary concise but informative (around ${options.maxLength || 500} words for the main summary).`);
    
    return [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: `${parts.join("\n")}\n\n${userInstructions.join("\n")}` 
      },
    ];
  }
  
  /**
   * Parse LLM response into structured summary
   */
  private static parseSummaryResponse(
    content: string,
    model: string,
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  ): SummaryResult {
    const result: SummaryResult = {
      summary: content,
      model,
      usage,
    };
    
    // Try to extract structured sections from the response
    try {
      // Extract key findings (look for bullet points)
      const findingsMatch = content.match(/Key Findings[:\s]*(?:[-•*]\s*(.+?)(?:\n|$))+/i);
      if (findingsMatch) {
        const findings = content.match(/[-•*]\s*(.+?)(?:\n|$)/g);
        if (findings) {
          result.keyFindings = findings.map(f => f.replace(/^[-•*]\s*/, "").trim());
        }
      }
      
      // Extract methods section
      const methodsMatch = content.match(/Methodology|Methods[:\s]*(.+?)(?=\n##|\n\*\*|$)/is);
      if (methodsMatch) {
        result.methods = methodsMatch[1].trim();
      }
      
      // Extract limitations
      const limitationsMatch = content.match(/Limitations[:\s]*(.+?)(?=\n##|\n\*\*|$)/is);
      if (limitationsMatch) {
        result.limitations = limitationsMatch[1].trim();
      }
      
    } catch (e) {
      // If parsing fails, just return the raw content as summary
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Warning: Could not parse structured sections from summary");
      }
    }
    
    return result;
  }
  
  /**
   * Quick summary - just the abstract enhanced by LLM
   */
  public static async quickSummary(paperInfo: PaperInfo): Promise<string> {
    if (!paperInfo.abstract && !paperInfo.title) {
      throw new Error("Paper info is incomplete. Need at least title or abstract.");
    }
    
    if (!LLMAPI.isConfigured()) {
      throw new Error("LLM API not configured.");
    }
    
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: "You are a helpful academic research assistant. Provide a concise summary of the given paper in 2-3 sentences.",
      },
      {
        role: "user",
        content: paperInfo.abstract 
          ? `Summarize this paper:\n\nTitle: ${paperInfo.title || "N/A"}\n\nAbstract: ${paperInfo.abstract}`
          : `Summarize this paper: ${paperInfo.title}`,
      },
    ];
    
    const response = await LLMAPI.chat(messages, {
      temperature: 0.5,
      maxTokens: 300,
    });
    
    return response.content;
  }
  
  /**
   * Quick summary with streaming
   */
  public static async quickSummaryStream(
    paperInfo: PaperInfo,
    callback: StreamSummaryCallback
  ): Promise<string> {
    if (!paperInfo.abstract && !paperInfo.title) {
      throw new Error("Paper info is incomplete. Need at least title or abstract.");
    }
    
    if (!LLMAPI.isConfigured()) {
      throw new Error("LLM API not configured.");
    }
    
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: "You are a helpful academic research assistant. Provide a concise summary of the given paper in 2-3 sentences.",
      },
      {
        role: "user",
        content: paperInfo.abstract 
          ? `Summarize this paper:\n\nTitle: ${paperInfo.title || "N/A"}\n\nAbstract: ${paperInfo.abstract}`
          : `Summarize this paper: ${paperInfo.title}`,
      },
    ];
    
    let fullContent = "";
    
    await LLMAPI.chat(messages, {
      stream: (chunk) => {
        fullContent += chunk;
        callback(chunk);
      },
      temperature: 0.5,
      maxTokens: 300,
    });
    
    callback.onComplete?.({
      summary: fullContent,
      model: LLMAPI.getConfig()?.model || "unknown",
    });
    
    return fullContent;
  }
}

/**
 * Initialize summary module
 */
export function initSummary(): void {
  PaperSummary.init();
  
  if (typeof ztoolkit !== "undefined") {
    ztoolkit.log("Paper Copilot: Summary module loaded");
  }
}
