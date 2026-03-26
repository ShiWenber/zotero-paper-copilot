/**
 * Formatting Utilities for AI Response Display
 * Handles markdown-like formatting and page reference parsing
 */

/**
 * Page reference patterns - matches various formats:
 * - "page X", "page X-Y"
 * - "第 X 页", "第X页"
 * - "on page X", "pages X-Y"
 * - "[X]" footnote references
 * - "Fig. X", "Figure X"
 */
const PAGE_PATTERNS = [
  // "page 5", "pages 5-10", "page 5-10"
  /(?:pages?)\s*(\d+)(?:\s*[-–]\s*(\d+))?/gi,
  // "第 5 页", "第5页"
  /第\s*(\d+)\s*页/gi,
  // "on page 5", "at page 5"
  /(?:on|at|in)\s+(?:page\s+)?(\d+)/gi,
  // "Fig. 5", "Figure 5", "fig. 5"
  /(?:Fig\.?|Figure)\s*(\d+[a-z]?)/gi,
];

const CITATION_PATTERN = /\[\s*(\d+)\s*\]/g;

/**
 * A parsed segment of text with optional page reference
 */
export interface TextSegment {
  text: string;
  page?: number;
  type: "text" | "page-jump" | "citation";
  label?: string;
}

/**
 * Parse text and extract page references
 * Returns segments with page numbers for clickable navigation
 */
export function parsePageReferences(text: string): TextSegment[] {
  if (!text) return [{ text, type: "text" }];

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  const references: Array<{
    start: number;
    end: number;
    page: number;
    label: string;
  }> = [];

  // Find all page number references
  for (const pattern of PAGE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const page = parseInt(match[1], 10);
      if (page > 0) {
        references.push({
          start: match.index,
          end: match.index + match[0].length,
          page,
          label: match[0],
        });
      }
    }
  }

  // Find citation references like [1], [2]
  CITATION_PATTERN.lastIndex = 0;
  let match;
  while ((match = CITATION_PATTERN.exec(text)) !== null) {
    const page = parseInt(match[1], 10);
    if (page > 0) {
      // Avoid overlapping with page patterns
      const overlapping = references.some(
        (r) =>
          !(
            match!.index >= r.end || match!.index + match![0].length <= r.start
          ),
      );
      if (!overlapping) {
        references.push({
          start: match.index,
          end: match.index + match[0].length,
          page,
          label: match[0],
        });
      }
    }
  }

  // Sort references by start index
  references.sort((a, b) => a.start - b.start);

  // Build segments
  for (const ref of references) {
    if (ref.start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, ref.start), type: "text" });
    }
    segments.push({
      text: ref.label,
      page: ref.page,
      type: "page-jump",
      label: `Go to page ${ref.page}`,
    });
    lastIndex = ref.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), type: "text" });
  }

  return segments.length > 0 ? segments : [{ text, type: "text" }];
}

/**
 * Format markdown-like text to HTML
 * Supports: **bold**, *italic*, `code`, __underline__
 */
export function formatMarkdown(text: string): string {
  if (!text) return "";

  let html = escapeHtml(text);

  // Code blocks (```code```)
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Underline
  html = html.replace(/<u>([^<]+)<\/u>/g, "<u>$1</u>");

  // Headers (# Header)
  html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");

  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");

  // Wrap in paragraph if not already wrapped
  if (!html.startsWith("<")) {
    html = `<p>${html}</p>`;
  }

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Format AI response with markdown + page reference links
 * Returns HTML string with clickable page references
 */
export function formatResponse(text: string): string {
  if (!text) return "";

  // First format markdown
  const html = formatMarkdown(text);

  // Parse page references and make them clickable
  const segments = parsePageReferences(text);
  let result = "";
  let buffer = "";

  for (const segment of segments) {
    if (segment.type === "page-jump" && segment.page) {
      // Flush any buffered text
      if (buffer) {
        result += buffer;
        buffer = "";
      }
      // Add clickable page reference
      const escapedLabel = escapeHtml(segment.label || "");
      result += `<a class="page-jump" data-page="${segment.page}" title="${escapedLabel}" href="javascript:void(0)">${escapedLabel}</a>`;
    } else if (segment.type === "text") {
      // For text segments, we need to preserve already-formatted HTML
      // and not double-escape. We format the raw text and merge.
      buffer += segment.text;
    }
  }

  // Flush remaining buffer with markdown formatting
  if (buffer) {
    result += formatMarkdown(buffer);
  }

  return result;
}

/**
 * Strip HTML tags and return plain text
 * Useful for generating summaries or notes
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Format chat messages for display in sidebar
 * Returns sanitized HTML with clickable references
 */
export function formatChatMessage(
  content: string,
  role: "user" | "assistant",
): string {
  if (role === "user") {
    // User messages: simple text, escape HTML
    return escapeHtml(content).replace(/\n/g, "<br>");
  } else {
    // Assistant messages: full formatting with references
    return formatResponse(content);
  }
}
