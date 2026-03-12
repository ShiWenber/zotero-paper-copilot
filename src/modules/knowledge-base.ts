/**
 * Zotero Paper Copilot - Knowledge Base Q&A Module
 * 
 * RAG (Retrieval Augmented Generation) functionality for Zotero collections
 * Allows users to ask questions about their entire Zotero collection
 */

import { LLMAPI, ChatMessage } from "./llm-api";

export interface CollectionDocument {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  tags: string[];
  notes: string;
  year?: number;
  itemType?: string;
}

export interface SearchResult {
  documents: CollectionDocument[];
  totalFound: number;
}

export interface QAResult {
  answer: string;
  sources: { id: number; title: string }[];
  tokensUsed?: number;
}

/**
 * Knowledge Base Manager for Collection Q&A
 */
export class KnowledgeBase {
  private static cache: Map<string, { data: SearchResult; timestamp: number }> = new Map();
  private static CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Get all collections from the current library
   */
  public static async getCollections(): Promise<any[]> {
    try {
      const libraryID = Zotero.Libraries.userLibraryID;
      const collections = Zotero.Collections.getByLibrary(libraryID);
      return collections;
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error getting collections:", e);
      }
      return [];
    }
  }

  /**
   * Get collection by ID with all its items
   */
  public static async getCollectionItems(collectionId: number): Promise<CollectionDocument[]> {
    try {
      const collection = Zotero.Collections.get(collectionId);
      if (!collection) {
        return [];
      }

      const items: any[] = await collection.getChildItems(true);
      const docs: CollectionDocument[] = [];
      
      for (const itemId of items) {
        const item = await Zotero.Items.getAsync(itemId);
        if (item) {
          const doc = this.itemToDocument(item);
          if (doc) docs.push(doc);
        }
      }
      
      return docs;
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error getting collection items:", e);
      }
      return [];
    }
  }

  /**
   * Get all items from all collections in the library
   */
  public static async getAllLibraryItems(): Promise<CollectionDocument[]> {
    try {
      // Get all items from the current library
      const libraryID = Zotero.Libraries.userLibraryID;
      const items = await Zotero.Items.getAll(libraryID, false, false, true);
      
      const docs: CollectionDocument[] = [];
      for (const itemId of items.slice(0, 500)) { // Limit for performance
        const item = await Zotero.Items.getAsync(itemId);
        if (item) {
          const doc = this.itemToDocument(item);
          if (doc) docs.push(doc);
        }
      }
      
      return docs;
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error getting all library items:", e);
      }
      return [];
    }
  }

  /**
   * Convert Zotero item to CollectionDocument (sync version)
   */
  private static itemToDocument(item: any): CollectionDocument | null {
    try {
      // Skip non-paper items
      const validTypes = ["journalArticle", "book", "bookSection", "conferencePaper", "thesis", "report"];
      if (item.itemType && !validTypes.includes(item.itemType)) {
        // Still include but mark the type
      }

      const doc: CollectionDocument = {
        id: item.id,
        title: item.getField("title") || "Untitled",
        authors: item.creators ? item.creators.map((c: any) => c.firstName + " " + c.lastName).filter(Boolean) : [],
        abstract: item.getField("abstractNote") || "",
        tags: item.tags ? item.tags.map((t: any) => typeof t === "string" ? t : t.tag) : [],
        notes: "",
        year: item.getField("year") ? parseInt(item.getField("year")) : undefined,
        itemType: item.itemType,
      };

      return doc;
    } catch (e) {
      return null;
    }
  }

  /**
   * Search documents by query (simple keyword matching)
   */
  public static searchDocuments(documents: CollectionDocument[], query: string, maxResults: number = 10): SearchResult {
    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 2);

    // Score each document
    const scored = documents.map(doc => {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const abstractLower = doc.abstract.toLowerCase();
      const tagsLower = doc.tags.join(" ").toLowerCase();
      const notesLower = doc.notes.toLowerCase();
      const authorsLower = doc.authors.join(" ").toLowerCase();

      for (const term of queryTerms) {
        // Title matches (highest weight)
        if (titleLower.includes(term)) score += 10;
        // Tag matches
        if (tagsLower.includes(term)) score += 5;
        // Abstract matches
        if (abstractLower.includes(term)) score += 3;
        // Notes matches
        if (notesLower.includes(term)) score += 2;
        // Author matches
        if (authorsLower.includes(term)) score += 2;
      }

      return { doc, score };
    });

    // Sort by score and take top results
    scored.sort((a, b) => b.score - a.score);
    const results = scored.filter(s => s.score > 0).slice(0, maxResults);

    return {
      documents: results.map(r => r.doc),
      totalFound: results.length,
    };
  }

  /**
   * Build context from search results for LLM
   */
  private static buildContextFromDocuments(documents: CollectionDocument[]): string {
    let context = "Based on the following papers from your Zotero library:\n\n";

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      context += `--- Paper ${i + 1} ---\n`;
      context += `Title: ${doc.title}\n`;
      if (doc.authors.length > 0) {
        context += `Authors: ${doc.authors.join(", ")}\n`;
      }
      if (doc.year) {
        context += `Year: ${doc.year}\n`;
      }
      if (doc.abstract) {
        context += `Abstract: ${doc.abstract}\n`;
      }
      if (doc.tags.length > 0) {
        context += `Tags: ${doc.tags.join(", ")}\n`;
      }
      if (doc.notes) {
        context += `Notes: ${doc.notes.substring(0, 500)}${doc.notes.length > 500 ? "..." : ""}\n`;
      }
      context += "\n";
    }

    return context;
  }

  /**
   * Ask a question about the collection
   */
  public static async askQuestion(
    question: string,
    collectionId?: number,
    options?: { maxDocuments?: number; stream?: (chunk: string) => void }
  ): Promise<QAResult> {
    // Check if LLM is configured
    if (!LLMAPI.isConfigured()) {
      throw new Error("LLM API not configured. Please set up API key in preferences.");
    }

    // Get documents from collection or entire library
    let documents: CollectionDocument[];
    
    if (collectionId) {
      documents = await this.getCollectionItems(collectionId);
    } else {
      // Check cache first
      const cacheKey = "all-library";
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        documents = cached.data.documents;
      } else {
        documents = await this.getAllLibraryItems();
        this.cache.set(cacheKey, { data: { documents, totalFound: documents.length }, timestamp: Date.now() });
      }
    }

    if (documents.length === 0) {
      throw new Error("No papers found in the collection/library.");
    }

    // Search for relevant documents
    const maxDocs = options?.maxDocuments || 5;
    const searchResults = this.searchDocuments(documents, question, maxDocs);

    if (searchResults.documents.length === 0) {
      // No relevant documents found, but still try to answer
      return {
        answer: "I couldn't find any papers in your library that match your query. You may want to try a different question or add more papers to your library.",
        sources: [],
      };
    }

    // Build context from search results
    const context = this.buildContextFromDocuments(searchResults.documents);

    // Build prompt
    const systemPrompt = `You are a helpful academic research assistant. 
Based on the user's Zotero library papers provided in the context, answer their question thoroughly and accurately.
If the context doesn't contain enough information to answer the question fully, please say so.
Cite specific papers when possible.
Keep your answer clear and well-structured.`;

    const userPrompt = `${context}

User Question: ${question}

Please provide a helpful answer based on the papers above:`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Call LLM API
    try {
      let answer: string;
      
      if (options?.stream) {
        const response = await LLMAPI.streamChat(messages, options.stream);
        answer = response.content;
      } else {
        const response = await LLMAPI.chat(messages);
        answer = response.content;
      }

      return {
        answer,
        sources: searchResults.documents.map(d => ({ id: d.id, title: d.title })),
        tokensUsed: searchResults.documents.length, // Approximate
      };
    } catch (e: any) {
      throw new Error(`Failed to get answer: ${e.message}`);
    }
  }

  /**
   * Get collection statistics
   */
  public static async getCollectionStats(collectionId?: number): Promise<{
    totalPapers: number;
    byYear: { [year: number]: number };
    byType: { [type: string]: number };
    topTags: { tag: string; count: number }[];
  }> {
    let documents: CollectionDocument[];

    if (collectionId) {
      documents = await this.getCollectionItems(collectionId);
    } else {
      documents = await this.getAllLibraryItems();
    }

    const stats = {
      totalPapers: documents.length,
      byYear: {} as { [year: number]: number },
      byType: {} as { [type: string]: number },
      topTags: [] as { tag: string; count: number }[],
    };

    const tagCounts = new Map<string, number>();

    for (const doc of documents) {
      // Count by year
      if (doc.year) {
        stats.byYear[doc.year] = (stats.byYear[doc.year] || 0) + 1;
      }

      // Count by type
      const type = doc.itemType || "unknown";
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count tags
      for (const tag of doc.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Sort tags by count
    stats.topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Clear cache
   */
  public static clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Initialize knowledge base module
 */
export function initKnowledgeBase(): void {
  if (typeof ztoolkit !== "undefined") {
    ztoolkit.log("Paper Copilot: Knowledge Base module initialized");
  }
}
