/**
 * Zotero Paper Copilot - Summary Module
 * 
 * Generates paper summaries using LLM API
 * Supports streaming output and customization
 */

import { callLLM, callLLMWithStream, LLMMessage, getLLMConfig } from "./llm-api";

export interface PaperInfo {
  title?: string;
  abstract?: string;
  authors?: string[];
  sections?: { title: string; content: string }[];
  fullText?: string;
}

export interface SummaryOptions {
  length?: "short" | "medium" | "long";
  focus?: string[]; // e.g., ["methods", "results", "conclusions"]
  language?: string;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  language: string;
  model: string;
}

/**
 * Build summary prompt based on paper info
 */
export function buildSummaryPrompt(paperInfo: PaperInfo, options: SummaryOptions = {}): LLMMessage[] {
  const lengthGuide = {
    short: "2-3 sentences",
    medium: "one paragraph",
    long: "2-3 paragraphs"
  };
  
  const length = options.length || "medium";
  const focus = options.focus || ["main contribution", "methods", "results", "conclusions"];
  const language = options.language || "English";
  
  let content = "";
  
  if (paperInfo.title) {
    content += `Title: ${paperInfo.title}\n\n`;
  }
  
  if (paperInfo.abstract) {
    content += `Abstract:\n${paperInfo.abstract}\n\n`;
  }
  
  if (paperInfo.sections && paperInfo.sections.length > 0) {
    content += "Main sections:\n";
    for (const section of paperInfo.sections.slice(0, 10)) {
      content += `\n## ${section.title}\n${section.content.substring(0, 500)}\n`;
    }
  }
  
  if (paperInfo.fullText) {
    content += `\nFull text excerpt:\n${paperInfo.fullText.substring(0, 2000)}`;
  }
  
  const systemPrompt = `You are a helpful academic research assistant. Your task is to provide a clear and comprehensive summary of the given scientific paper.`;
  
  const userPrompt = `Please provide a ${lengthGuide[length]} summary of the following scientific paper.

Focus on: ${focus.join(", ")}

The summary should be in ${language}.

${content}

Please structure your response as follows:
1. Brief overview (1-2 sentences)
2. Key findings/contributions
3. Methods used (if applicable)
4. Conclusions

Then list 3-5 key points in bullet format.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

/**
 * Generate summary (non-streaming)
 */
export async function generateSummary(
  paperInfo: PaperInfo,
  options: SummaryOptions = {}
): Promise<SummaryResult> {
  const messages = buildSummaryPrompt(paperInfo, options);
  const config = getLLMConfig();
  
  try {
    const response = await callLLM(messages);
    const content = response.choices[0]?.message?.content || "";
    
    // Parse key points from response
    const keyPoints = extractKeyPoints(content);
    
    return {
      summary: content,
      keyPoints,
      language: options.language || "English",
      model: response.model,
    };
  } catch (error) {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Summary generation error:", error);
    }
    throw error;
  }
}

/**
 * Generate summary with streaming
 */
export async function generateSummaryStream(
  paperInfo: PaperInfo,
  onChunk: (chunk: string, fullContent: string) => void | Promise<void>,
  options: SummaryOptions = {}
): Promise<SummaryResult> {
  const messages = buildSummaryPrompt(paperInfo, options);
  const config = getLLMConfig();
  
  let fullContent = "";
  
  try {
    await callLLMWithStream(
      messages,
      async (chunk, accumulated) => {
        fullContent = accumulated;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          await onChunk(content, accumulated);
        }
      }
    );
    
    const keyPoints = extractKeyPoints(fullContent);
    
    return {
      summary: fullContent,
      keyPoints,
      language: options.language || "English",
      model: config.model,
    };
  } catch (error) {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Summary streaming error:", error);
    }
    throw error;
  }
}

/**
 * Extract key points from summary text
 */
function extractKeyPoints(text: string): string[] {
  const points: string[] = [];
  
  // Look for bullet points
  const bulletRegex = /^[-•*]\s+(.+)$/gm;
  let match;
  
  while ((match = bulletRegex.exec(text)) !== null) {
    points.push(match[1].trim());
  }
  
  // If no bullets found, try to extract sentences
  if (points.length === 0) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    points.push(...sentences.slice(0, 5).map(s => s.trim()));
  }
  
  return points.slice(0, 5);
}

/**
 * Quick summary - extract from abstract only
 */
export async function quickSummary(abstract: string, language: string = "English"): Promise<string> {
  const messages: LLMMessage[] = [
    {
      role: "system",
      content: "You are a helpful academic assistant. Provide brief summaries."
    },
    {
      role: "user",
      content: `Please summarize the following abstract in 2-3 sentences in ${language}:\n\n${abstract}`
    }
  ];
  
  const response = await callLLM(messages);
  return response.choices[0]?.message?.content || "";
}

/**
 * Get summary suggestions based on paper content
 */
export function getSummarySuggestions(paperInfo: PaperInfo): string[] {
  const suggestions: string[] = [];
  
  if (paperInfo.title) {
    suggestions.push(`Summarize "${paperInfo.title}"`);
  }
  
  if (paperInfo.abstract) {
    suggestions.push("Quick summary from abstract");
  }
  
  suggestions.push("Key findings only");
  suggestions.push("Methods overview");
  suggestions.push("Compare with similar papers");
  
  return suggestions;
}

/**
 * Initialize summary module
 */
export function initSummaryModule(): void {
  if (typeof ztoolkit !== "undefined") {
    ztoolkit.log("Paper Copilot: Summary module initialized");
  }
}
