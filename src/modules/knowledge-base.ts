/**
 * Zotero Paper Copilot - Knowledge Base Q&A Module
 *
 * RAG (Retrieval Augmented Generation) functionality for Zotero collections
 * Allows users to ask questions about their entire Zotero collection
 * Supports both keyword search and vector embedding search
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
  // Vector embedding for semantic search
  embedding?: number[];
  embeddingUpdatedAt?: number;
}

export interface SearchResult {
  documents: CollectionDocument[];
  totalFound: number;
  searchMode: "keyword" | "vector" | "hybrid";
}

export interface QAResult {
  answer: string;
  sources: { id: number; title: string }[];
  tokensUsed?: number;
}

/**
 * Vector embedding configuration
 */
export interface EmbeddingConfig {
  provider: "ollama" | "local" | "disabled";
  ollamaUrl?: string;
  model?: string;
  dimension?: number;
}

// ============== Vector Embedding Utilities ==============

/**
 * Generate a simple local embedding using TF-IDF-like approach
 * This is a lightweight fallback when Ollama is not available
 */
function generateLocalEmbedding(text: string, dimension: number = 384): number[] {
  // Tokenize and normalize
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  // Count term frequencies
  const termFreq: Map<string, number> = new Map();
  for (const token of tokens) {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  }

  // Simple hash-based pseudo-embedding for demonstration
  // In production, use proper embedding models via Ollama
  const embedding = new Array(dimension).fill(0);
  const uniqueTerms = Array.from(termFreq.keys());
  
  for (let i = 0; i < uniqueTerms.length; i++) {
    const term = uniqueTerms[i];
    const hash1 = hashString(term);
    const hash2 = hashString(term + "_v2");
    const tf = termFreq.get(term) || 0;
    const weight = Math.log(1 + tf);
    
    // Distribute term weight across multiple dimensions based on hash
    for (let d = 0; d < Math.min(8, dimension); d++) {
      const idx = (hash1 + d * hash2) % dimension;
      embedding[idx] += weight * (d % 2 === 0 ? 1 : -1) * 0.1;
    }
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============== Smart Cache ==============

interface SmartCacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  itemModifiedAt?: number;
}

interface SmartCacheOptions {
  ttl: number;
  maxSize: number;
  enableLRU: boolean;
  trackAccess: boolean;
}

/**
 * Knowledge Base Manager for Collection Q&A
 */
export class KnowledgeBase {
  private static cache: Map<string, SmartCacheEntry<SearchResult>> =
    new Map();
  private static documentEmbeddings: Map<number, number[]> = new Map();
  private static embeddingConfig: EmbeddingConfig = {
    provider: "local", // Default to local embedding
    dimension: 384,
  };
  private static smartCacheOptions: SmartCacheOptions = {
    ttl: 30 * 60 * 1000, // 30 minutes default
    maxSize: 500,
    enableLRU: true,
    trackAccess: true,
  };
  private static documentAccessLog: Map<number, { count: number; lastAccess: number }> = new Map();

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
  public static async getCollectionItems(
    collectionId: number,
  ): Promise<CollectionDocument[]> {
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
   * Supports pagination for large libraries
   */
  public static async getAllLibraryItems(
    options?: {
      offset?: number;
      limit?: number;
      forceRefresh?: boolean;
    },
  ): Promise<{ documents: CollectionDocument[]; total: number; hasMore: boolean }> {
    try {
      const libraryID = Zotero.Libraries.userLibraryID;
      const items = await Zotero.Items.getAll(libraryID, false, false, true);

      const offset = options?.offset || 0;
      const limit = options?.limit || 500;
      const total = items.length;
      
      // Paginate
      const paginatedItems = items.slice(offset, offset + limit);
      const docs: CollectionDocument[] = [];

      for (const itemId of paginatedItems) {
        const item = await Zotero.Items.getAsync(itemId);
        if (item) {
          const doc = this.itemToDocument(item);
          if (doc) {
            docs.push(doc);
            // Restore cached embedding if available
            const cachedEmbedding = this.documentEmbeddings.get(doc.id);
            if (cachedEmbedding) {
              doc.embedding = cachedEmbedding;
            }
          }
        }
      }

      // Track access
      for (const doc of docs) {
        this.trackDocumentAccess(doc.id);
      }

      return {
        documents: docs,
        total,
        hasMore: offset + limit < total,
      };
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error getting all library items:", e);
      }
      return { documents: [], total: 0, hasMore: false };
    }
  }

  /**
   * Track document access for smart caching
   */
  private static trackDocumentAccess(docId: number): void {
    const existing = this.documentAccessLog.get(docId);
    if (existing) {
      existing.count++;
      existing.lastAccess = Date.now();
    } else {
      this.documentAccessLog.set(docId, {
        count: 1,
        lastAccess: Date.now(),
      });
    }
  }

  /**
   * Get frequently accessed documents
   */
  public static getFrequentlyAccessedDocuments(
    documents: CollectionDocument[],
    minAccessCount: number = 3,
  ): CollectionDocument[] {
    return documents.filter((doc) => {
      const accessInfo = this.documentAccessLog.get(doc.id);
      return accessInfo && accessInfo.count >= minAccessCount;
    });
  }

  /**
   * Configure smart cache options
   */
  public static setSmartCacheOptions(options: Partial<SmartCacheOptions>): void {
    this.smartCacheOptions = { ...this.smartCacheOptions, ...options };
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Smart cache options updated:", this.smartCacheOptions);
    }
  }

  /**
   * Convert Zotero item to CollectionDocument (sync version)
   */
  private static itemToDocument(item: any): CollectionDocument | null {
    try {
      // Skip non-paper items
      const validTypes = [
        "journalArticle",
        "book",
        "bookSection",
        "conferencePaper",
        "thesis",
        "report",
      ];
      if (item.itemType && !validTypes.includes(item.itemType)) {
        // Still include but mark the type
      }

      const doc: CollectionDocument = {
        id: item.id,
        title: item.getField("title") || "Untitled",
        authors: item.creators
          ? item.creators
              .map((c: any) => c.firstName + " " + c.lastName)
              .filter(Boolean)
          : [],
        abstract: item.getField("abstractNote") || "",
        tags: item.tags
          ? item.tags.map((t: any) => (typeof t === "string" ? t : t.tag))
          : [],
        notes: "",
        year: item.getField("year")
          ? parseInt(item.getField("year"))
          : undefined,
        itemType: item.itemType,
      };

      return doc;
    } catch (e) {
      return null;
    }
  }

  /**
   * Configure vector embedding settings
   */
  public static setEmbeddingConfig(config: Partial<EmbeddingConfig>): void {
    this.embeddingConfig = { ...this.embeddingConfig, ...config };
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Embedding config updated:", this.embeddingConfig);
    }
  }

  /**
   * Get current embedding configuration
   */
  public static getEmbeddingConfig(): EmbeddingConfig {
    return { ...this.embeddingConfig };
  }

  /**
   * Generate embedding for text using configured provider
   */
  public static async generateEmbedding(text: string): Promise<number[]> {
    if (this.embeddingConfig.provider === "disabled") {
      // Return empty embedding to fallback to keyword search
      return [];
    }

    if (this.embeddingConfig.provider === "ollama" && this.embeddingConfig.ollamaUrl) {
      try {
        return await this.generateOllamaEmbedding(text);
      } catch (e) {
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log("Paper Copilot: Ollama embedding failed, falling back to local:", e);
        }
        return generateLocalEmbedding(text, this.embeddingConfig.dimension || 384);
      }
    }

    // Default: use local embedding
    return generateLocalEmbedding(text, this.embeddingConfig.dimension || 384);
  }

  /**
   * Generate embedding using Ollama API
   */
  private static async generateOllamaEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.embeddingConfig.ollamaUrl || "http://localhost:11434";
    const model = this.embeddingConfig.model || "nomic-embed-text";

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json() as unknown as { embedding: number[] };
    return data.embedding;
  }

  /**
   * Generate and cache embeddings for documents
   */
  public static async generateDocumentEmbeddings(
    documents: CollectionDocument[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    const dimension = this.embeddingConfig.dimension || 384;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      
      // Skip if already has embedding and it's recent
      if (doc.embedding && doc.embeddingUpdatedAt) {
        const age = Date.now() - doc.embeddingUpdatedAt;
        if (age < 7 * 24 * 60 * 60 * 1000) { // 7 days
          continue;
        }
      }

      // Generate embedding from document text
      const textToEmbed = [
        doc.title,
        doc.abstract,
        doc.tags.join(" "),
        doc.authors.join(" "),
        doc.notes,
      ].join(" ");

      const embedding = await this.generateEmbedding(textToEmbed);
      
      // Store in document and cache
      doc.embedding = embedding;
      doc.embeddingUpdatedAt = Date.now();
      this.documentEmbeddings.set(doc.id, embedding);

      if (onProgress) {
        onProgress(i + 1, documents.length);
      }

      // Rate limit for Ollama
      if (this.embeddingConfig.provider === "ollama") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Search documents using vector similarity
   */
  public static async vectorSearchDocuments(
    documents: CollectionDocument[],
    query: string,
    maxResults: number = 10,
  ): Promise<SearchResult> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    if (queryEmbedding.length === 0) {
      return {
        documents: [],
        totalFound: 0,
        searchMode: "vector",
      };
    }

    // Score documents by cosine similarity
    const scored: { doc: CollectionDocument; score: number }[] = [];

    for (const doc of documents) {
      // Get cached embedding or generate
      let embedding = this.documentEmbeddings.get(doc.id);
      
      if (!embedding && doc.embedding) {
        embedding = doc.embedding;
        this.documentEmbeddings.set(doc.id, embedding);
      }

      if (!embedding) {
        // Generate embedding on-the-fly
        const textToEmbed = [
          doc.title,
          doc.abstract,
          doc.tags.join(" "),
        ].join(" ");
        embedding = await this.generateEmbedding(textToEmbed);
        this.documentEmbeddings.set(doc.id, embedding);
        doc.embedding = embedding;
        doc.embeddingUpdatedAt = Date.now();
      }

      const similarity = cosineSimilarity(queryEmbedding, embedding);
      
      if (similarity > 0.1) { // Threshold for relevance
        scored.push({ doc, score: similarity });
      }
    }

    // Sort by similarity score
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, maxResults);

    return {
      documents: results.map((r) => r.doc),
      totalFound: results.length,
      searchMode: "vector",
    };
  }

  /**
   * Hybrid search combining keyword and vector
   */
  public static async hybridSearchDocuments(
    documents: CollectionDocument[],
    query: string,
    maxResults: number = 10,
    keywordWeight: number = 0.4,
    vectorWeight: number = 0.6,
  ): Promise<SearchResult> {
    // Get keyword search scores
    const keywordResults = this.searchDocumentsKeyword(documents, query, maxResults * 2);
    const keywordScores = new Map<number, number>();
    keywordResults.forEach((result, index) => {
      // Normalize scores: higher index = lower score
      const normalizedScore = 1 - index / keywordResults.length;
      keywordScores.set(result.id, normalizedScore);
    });

    // Get vector search scores
    const vectorResults = await this.vectorSearchDocuments(documents, query, maxResults * 2);
    const vectorScores = new Map<number, number>();
    vectorResults.documents.forEach((doc, index) => {
      const normalizedScore = 1 - index / vectorResults.documents.length;
      vectorScores.set(doc.id, normalizedScore);
    });

    // Combine scores
    const combinedScores: { doc: CollectionDocument; combinedScore: number }[] = [];
    const allDocs = new Map<number, CollectionDocument>();
    
    [...keywordResults, ...vectorResults.documents].forEach((doc) => {
      allDocs.set(doc.id, doc);
    });

    for (const [docId, doc] of allDocs) {
      const kwScore = keywordScores.get(docId) || 0;
      const vecScore = vectorScores.get(docId) || 0;
      
      const combinedScore = kwScore * keywordWeight + vecScore * vectorWeight;
      combinedScores.push({ doc, combinedScore });
    }

    // Sort and take top results
    combinedScores.sort((a, b) => b.combinedScore - a.combinedScore);
    const results = combinedScores.slice(0, maxResults);

    return {
      documents: results.map((r) => r.doc),
      totalFound: results.length,
      searchMode: "hybrid",
    };
  }

  /**
   * Original keyword-only search (extracted for reuse)
   */
  private static searchDocumentsKeyword(
    documents: CollectionDocument[],
    query: string,
    maxResults: number = 10,
  ): CollectionDocument[] {
    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter((t) => t.length > 2);

    // Score each document
    const scored = documents.map((doc) => {
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
    const results = scored.filter((s) => s.score > 0).slice(0, maxResults);

    return results.map((r) => r.doc);
  }

  /**
   * Search documents by query (supports keyword, vector, and hybrid modes)
   */
  public static searchDocuments(
    documents: CollectionDocument[],
    query: string,
    maxResults: number = 10,
    options?: {
      mode?: "keyword" | "vector" | "hybrid";
      keywordWeight?: number;
      vectorWeight?: number;
    },
  ): SearchResult {
    const mode = options?.mode || "hybrid";

    if (mode === "keyword") {
      const docs = this.searchDocumentsKeyword(documents, query, maxResults);
      return { documents: docs, totalFound: docs.length, searchMode: "keyword" };
    }

    if (mode === "vector") {
      // Vector search is async, so we return a promise-based interface
      // For synchronous use, we'll fall back to keyword
      const docs = this.searchDocumentsKeyword(documents, query, maxResults);
      return { documents: docs, totalFound: docs.length, searchMode: "vector" };
    }

    // Hybrid mode - for backward compatibility, use keyword
    const docs = this.searchDocumentsKeyword(documents, query, maxResults);
    return { documents: docs, totalFound: docs.length, searchMode: "hybrid" };
  }

  /**
   * Async search with full vector support
   */
  public static async asyncSearchDocuments(
    documents: CollectionDocument[],
    query: string,
    maxResults: number = 10,
    options?: {
      mode?: "keyword" | "vector" | "hybrid";
      keywordWeight?: number;
      vectorWeight?: number;
    },
  ): Promise<SearchResult> {
    const mode = options?.mode || "hybrid";

    if (mode === "keyword") {
      const docs = this.searchDocumentsKeyword(documents, query, maxResults);
      return { documents: docs, totalFound: docs.length, searchMode: "keyword" };
    }

    if (mode === "vector") {
      return this.vectorSearchDocuments(documents, query, maxResults);
    }

    // Hybrid mode
    return this.hybridSearchDocuments(
      documents,
      query,
      maxResults,
      options?.keywordWeight || 0.4,
      options?.vectorWeight || 0.6,
    );
  }

  /**
   * Build context from search results for LLM
   */
  private static buildContextFromDocuments(
    documents: CollectionDocument[],
  ): string {
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
    options?: {
      maxDocuments?: number;
      stream?: (chunk: string) => void;
      searchMode?: "keyword" | "vector" | "hybrid";
    },
  ): Promise<QAResult> {
    // Check if LLM is configured
    if (!LLMAPI.isConfigured()) {
      throw new Error(
        "LLM API not configured. Please set up API key in preferences.",
      );
    }

    // Get documents from collection or entire library
    let documents: CollectionDocument[];
    const searchMode = options?.searchMode || "hybrid";

    if (collectionId) {
      documents = await this.getCollectionItems(collectionId);
    } else {
      // Check smart cache first
      const cacheKey = "all-library";
      const cached = this.smartCacheGet(cacheKey);
      
      if (cached) {
        documents = cached.documents;
      } else {
        const result = await this.getAllLibraryItems({ limit: 500 });
        documents = result.documents;
        
        // Store in smart cache with access tracking
        this.smartCacheSet(cacheKey, {
          documents,
          totalFound: documents.length,
          searchMode: "keyword",
        });
        
        // Pre-generate embeddings for frequently accessed docs in background
        if (searchMode !== "keyword") {
          this.generateDocumentEmbeddings(documents.slice(0, 50)).catch((e) => {
            if (typeof ztoolkit !== "undefined") {
              ztoolkit.log("Paper Copilot: Background embedding generation failed:", e);
            }
          });
        }
      }
    }

    if (documents.length === 0) {
      throw new Error("No papers found in the collection/library.");
    }

    // Search for relevant documents using configured mode
    const maxDocs = options?.maxDocuments || 5;
    let searchResults: SearchResult;

    if (searchMode === "vector") {
      searchResults = await this.vectorSearchDocuments(documents, question, maxDocs);
    } else if (searchMode === "hybrid") {
      searchResults = await this.hybridSearchDocuments(documents, question, maxDocs);
    } else {
      searchResults = this.searchDocuments(documents, question, maxDocs);
    }

    if (searchResults.documents.length === 0) {
      // No relevant documents found, but still try to answer
      return {
        answer:
          "I couldn't find any papers in your library that match your query. You may want to try a different question or add more papers to your library.",
        sources: [],
      };
    }

    // Track which documents were used
    for (const doc of searchResults.documents) {
      this.trackDocumentAccess(doc.id);
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
        sources: searchResults.documents.map((d) => ({
          id: d.id,
          title: d.title,
        })),
        tokensUsed: searchResults.documents.length, // Approximate
      };
    } catch (e: any) {
      throw new Error(`Failed to get answer: ${e.message}`, { cause: e });
    }
  }

  // ============== Smart Cache Methods ==============

  /**
   * Smart cache get with LRU and access tracking
   */
  private static smartCacheGet(key: string): SearchResult | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > this.smartCacheOptions.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access stats
    if (this.smartCacheOptions.trackAccess) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }

    return entry.data;
  }

  /**
   * Smart cache set with LRU eviction
   */
  private static smartCacheSet(key: string, data: SearchResult): void {
    // Evict if at capacity
    if (this.cache.size >= this.smartCacheOptions.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Check if cache entry is still valid based on item modification
   */
  private static isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > this.smartCacheOptions.ttl) {
      return false;
    }

    return true;
  }

  /**
   * Evict least recently used entry
   */
  private static evictLRU(): void {
    if (!this.smartCacheOptions.enableLRU) {
      // Just remove oldest by timestamp
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
      return;
    }

    // LRU: find least recently accessed
    let lruKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < oldestAccess) {
        oldestAccess = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Invalidate cache for specific document updates
   */
  public static invalidateCacheForDocument(docId: number): void {
    // If a document was modified, invalidate library cache
    const cacheKey = "all-library";
    const entry = this.cache.get(cacheKey);
    
    if (entry && entry.data.documents.some((d) => d.id === docId)) {
      // Check if document was modified after cache time
      const docModifiedAt = this.documentAccessLog.get(docId);
      if (docModifiedAt) {
        const cacheAge = Date.now() - entry.timestamp;
        // Invalidate if cache is older than 1 hour
        if (cacheAge > 60 * 60 * 1000) {
          this.cache.delete(cacheKey);
          // Also remove cached embedding
          this.documentEmbeddings.delete(docId);
        }
      }
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
      const result = await this.getAllLibraryItems();
      documents = result.documents;
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
    this.documentEmbeddings.clear();
    this.documentAccessLog.clear();
  }

  /**
   * Clear only embeddings (useful for regeneration)
   */
  public static clearEmbeddings(): void {
    this.documentEmbeddings.clear();
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
