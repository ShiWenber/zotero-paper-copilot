/**
 * Zotero Paper Copilot - Summary Module
 *
 * Generates paper abstracts using LLM API
 * Supports streaming output and custom summary length
 */

import { LLMAPI, ChatMessage } from "./llm-api";

export interface PDFBlock {
  id: string;
  type:
    | "title"
    | "heading"
    | "subheading"
    | "paragraph"
    | "figure"
    | "table"
    | "page-number"
    | "other";
  level: number;
  text: string;
  page: number;
}

export type SummaryLength = "short" | "medium" | "long";

export interface SummaryOptions {
  length: SummaryLength;
  language?: "en" | "zh" | "auto";
  includeKeywords?: boolean;
  includeHighlights?: boolean;
}

/**
 * Default summary options
 */
export const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  length: "medium",
  language: "auto",
  includeKeywords: true,
  includeHighlights: true,
};

/**
 * Get summary length configuration
 */
function getLengthConfig(length: SummaryLength): {
  maxTokens: number;
  promptSuffix: string;
} {
  switch (length) {
    case "short":
      return {
        maxTokens: 200,
        promptSuffix: "请用50-100字简洁概括论文主要内容。",
      };
    case "medium":
      return {
        maxTokens: 500,
        promptSuffix: "请用200-300字概括论文的主要内容、研究方法和结论。",
      };
    case "long":
      return {
        maxTokens: 1000,
        promptSuffix:
          "请用500-800字详细概括论文的主要内容、研究背景、方法、实验结果和贡献。",
      };
  }
}

/**
 * Language mapping for prompts
 */
function getLanguagePrompt(language: "en" | "zh" | "auto"): string {
  switch (language) {
    case "en":
      return "请用英文回复。";
    case "zh":
      return "请用中文回复。";
    case "auto":
      return "请使用论文的原始语言回复。";
  }
}

/**
 * Build prompt for summary generation
 */
function buildSummaryPrompt(
  paperContent: string,
  options: SummaryOptions,
): ChatMessage[] {
  const lengthConfig = getLengthConfig(options.length);
  const languagePrompt = getLanguagePrompt(options.language || "auto");

  let prompt = `请阅读以下论文内容，然后生成摘要。\n\n${lengthConfig.promptSuffix}${languagePrompt}\n\n`;

  if (options.includeKeywords) {
    prompt += "请同时列出3-5个关键词。\n";
  }

  if (options.includeHighlights) {
    prompt += "请列出2-3个论文的主要亮点或贡献。\n";
  }

  prompt += `\n论文内容：\n${paperContent}`;

  return [
    {
      role: "system",
      content:
        "你是一个学术论文助手，擅长阅读和总结科研论文。你的摘要应该准确、简洁、客观。",
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

/**
 * Extract relevant text from PDF blocks for summary
 */
export function extractPaperContent(
  blocks: PDFBlock[],
  maxChars: number = 8000,
): string {
  // Get all paragraphs and headings
  const relevantBlocks = blocks.filter(
    (b) =>
      b.type === "paragraph" ||
      b.type === "heading" ||
      b.type === "subheading" ||
      b.type === "title",
  );

  let content = "";
  for (const block of relevantBlocks) {
    if (content.length + block.text.length > maxChars) {
      content += block.text.substring(0, maxChars - content.length);
      break;
    }
    content += block.text + "\n\n";
  }

  return content.trim();
}

/**
 * Generate summary (non-streaming)
 */
export async function generateSummary(
  paperContent: string,
  options: Partial<SummaryOptions> = {},
): Promise<{
  summary: string;
  keywords?: string[];
  highlights?: string[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };
  const messages = buildSummaryPrompt(paperContent, opts);
  const lengthConfig = getLengthConfig(opts.length);

  const response = await LLMAPI.chat(messages, {
    maxTokens: lengthConfig.maxTokens,
  });

  const content = response.content;

  // Parse response to extract keywords and highlights
  const result: {
    summary: string;
    keywords?: string[];
    highlights?: string[];
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  } = {
    summary: content,
  };

  // Extract keywords if requested
  if (opts.includeKeywords) {
    const keywordsMatch = content.match(/关键词[：:]\s*([^\n]+)/);
    if (keywordsMatch) {
      result.keywords = keywordsMatch[1]
        .split(/[,，、]/)
        .map((k) => k.trim())
        .filter(Boolean);
    }

    const keywordsMatchEn = content.match(/Keywords?:\s*([^\n]+)/i);
    if (keywordsMatchEn && !result.keywords) {
      result.keywords = keywordsMatchEn[1]
        .split(/[,，、]/)
        .map((k) => k.trim())
        .filter(Boolean);
    }
  }

  // Extract highlights if requested
  if (opts.includeHighlights) {
    const highlightsMatch = content.match(/主要亮点[：:]\s*([^\n]+)/);
    if (highlightsMatch) {
      result.highlights = highlightsMatch[1]
        .split(/[,，、]/)
        .map((h) => h.trim())
        .filter(Boolean);
    }

    const highlightsMatchEn = content.match(/Highlights?:\s*([^\n]+)/i);
    if (highlightsMatchEn && !result.highlights) {
      result.highlights = highlightsMatchEn[1]
        .split(/[,，、]/)
        .map((h) => h.trim())
        .filter(Boolean);
    }
  }

  if (response.usage) {
    result.usage = {
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
    };
  }

  return result;
}

/**
 * Generate summary with streaming
 */
export async function generateSummaryStream(
  paperContent: string,
  onChunk: (chunk: string, fullContent: string) => void | Promise<void>,
  options: Partial<SummaryOptions> = {},
): Promise<{
  summary: string;
  keywords?: string[];
  highlights?: string[];
}> {
  const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };
  const messages = buildSummaryPrompt(paperContent, opts);
  const lengthConfig = getLengthConfig(opts.length);

  let fullContent = "";

  await LLMAPI.streamChat(
    messages,
    (chunk: string) => {
      fullContent += chunk;
      onChunk(chunk, fullContent);
    },
    {
      maxTokens: lengthConfig.maxTokens,
    },
  );

  // Parse response to extract keywords and highlights
  const result: {
    summary: string;
    keywords?: string[];
    highlights?: string[];
  } = {
    summary: fullContent,
  };

  // Extract keywords if requested
  if (opts.includeKeywords) {
    const keywordsMatch = fullContent.match(/关键词[：:]\s*([^\n]+)/);
    if (keywordsMatch) {
      result.keywords = keywordsMatch[1]
        .split(/[,，、]/)
        .map((k) => k.trim())
        .filter(Boolean);
    }

    const keywordsMatchEn = fullContent.match(/Keywords?:\s*([^\n]+)/i);
    if (keywordsMatchEn && !result.keywords) {
      result.keywords = keywordsMatchEn[1]
        .split(/[,，、]/)
        .map((k) => k.trim())
        .filter(Boolean);
    }
  }

  // Extract highlights if requested
  if (opts.includeHighlights) {
    const highlightsMatch = fullContent.match(/主要亮点[：:]\s*([^\n]+)/);
    if (highlightsMatch) {
      result.highlights = highlightsMatch[1]
        .split(/[,，、]/)
        .map((h) => h.trim())
        .filter(Boolean);
    }

    const highlightsMatchEn = fullContent.match(/Highlights?:\s*([^\n]+)/i);
    if (highlightsMatchEn && !result.highlights) {
      result.highlights = highlightsMatchEn[1]
        .split(/[,，、]/)
        .map((h) => h.trim())
        .filter(Boolean);
    }
  }

  return result;
}

/**
 * Generate summary from PDF blocks
 */
export async function generateSummaryFromBlocks(
  blocks: PDFBlock[],
  options: Partial<SummaryOptions> = {},
  useStream: boolean = false,
  onChunk?: (chunk: string, fullContent: string) => void | Promise<void>,
): Promise<{
  summary: string;
  keywords?: string[];
  highlights?: string[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  const paperContent = extractPaperContent(blocks);

  if (!paperContent) {
    throw new Error("No paper content available for summary");
  }

  if (useStream && onChunk) {
    return generateSummaryStream(paperContent, onChunk, options);
  }

  return generateSummary(paperContent, options);
}

/**
 * Check if LLM is configured
 */
export function isLLMConfigured(): boolean {
  return LLMAPI.isConfigured();
}

/**
 * Summary Generator class for more complex use cases
 */
export class SummaryGenerator {
  private blocks: PDFBlock[];
  private options: SummaryOptions;

  constructor(blocks: PDFBlock[], options: Partial<SummaryOptions> = {}) {
    this.blocks = blocks;
    this.options = { ...DEFAULT_SUMMARY_OPTIONS, ...options };
  }

  /**
   * Generate summary
   */
  async generate(): Promise<{
    summary: string;
    keywords?: string[];
    highlights?: string[];
  }> {
    const paperContent = extractPaperContent(this.blocks);
    return generateSummary(paperContent, this.options);
  }

  /**
   * Generate summary with streaming
   */
  async generateStream(
    onChunk: (chunk: string, fullContent: string) => void | Promise<void>,
  ): Promise<{
    summary: string;
    keywords?: string[];
    highlights?: string[];
  }> {
    const paperContent = extractPaperContent(this.blocks);
    return generateSummaryStream(paperContent, onChunk, this.options);
  }

  /**
   * Update options
   */
  setOptions(options: Partial<SummaryOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): SummaryOptions {
    return this.options;
  }
}
