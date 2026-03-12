/**
 * Zotero Paper Copilot - Semantic Scholar API Module
 * 
 * API for fetching related paper recommendations from Semantic Scholar
 * Reference: https://api.semanticscholar.org
 */

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  authors: { name: string; authorId?: string }[];
  venue?: string;
  url?: string;
  arxivId?: string;
  doi?: string;
  fieldsOfStudy?: string[];
  publicationTypes?: string[];
  openAccessPdf?: {
    url: string;
    status: string;
  };
  pdfUrls?: string[];
}

export interface SemanticScholarResponse {
  data: SemanticScholarPaper[];
  total?: number;
  nextOffset?: number;
}

export interface PaperRecommendationOptions {
  limit?: number;
  offset?: number;
  fields?: string[];
}

export class SemanticScholarAPI {
  private static readonly BASE_URL = "https://api.semanticscholar.org/graph/v1";
  private static readonly DEFAULT_FIELDS = [
    "paperId",
    "title",
    "abstract",
    "year",
    "citationCount",
    "influentialCitationCount",
    "authors",
    "venue",
    "url",
    "arxivId",
    "doi",
    "fieldsOfStudy",
    "publicationTypes",
    "openAccessPdf",
  ].join(",");

  /**
   * Search for papers by query
   */
  public static async searchPapers(
    query: string,
    options?: PaperRecommendationOptions
  ): Promise<SemanticScholarResponse> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    const fields = options?.fields?.join(",") || this.DEFAULT_FIELDS;

    const url = new URL(`${this.BASE_URL}/paper/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());
    url.searchParams.set("fields", fields);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Semantic Scholar API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as unknown as SemanticScholarResponse;
    
    return {
      data: data.data || [],
      total: data.total || 0,
      nextOffset: data.nextOffset,
    };
  }

  /**
   * Get related papers for a specific paper
   */
  public static async getRelatedPapers(
    paperId: string,
    options?: PaperRecommendationOptions
  ): Promise<SemanticScholarResponse> {
    const limit = options?.limit || 10;
    const fields = options?.fields?.join(",") || this.DEFAULT_FIELDS;

    const url = new URL(`${this.BASE_URL}/paper/${paperId}/similar`);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("fields", fields);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Semantic Scholar API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as unknown as { data: SemanticScholarPaper[] };
    
    return {
      data: data.data || [],
      total: data.data?.length || 0,
    };
  }

  /**
   * Get paper details by ID
   */
  public static async getPaper(
    paperId: string,
    fields?: string[]
  ): Promise<SemanticScholarPaper | null> {
    const fieldsStr = fields?.join(",") || this.DEFAULT_FIELDS;

    const url = new URL(`${this.BASE_URL}/paper/${paperId}`);
    url.searchParams.set("fields", fieldsStr);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.text();
      throw new Error(`Semantic Scholar API error: ${response.status} - ${error}`);
    }

    return await response.json() as unknown as SemanticScholarPaper;
  }

  /**
   * Get papers by DOI
   */
  public static async getPaperByDOI(
    doi: string,
    fields?: string[]
  ): Promise<SemanticScholarPaper | null> {
    const encodedDOI = encodeURIComponent(doi);
    return this.getPaper(encodedDOI, fields);
  }

  /**
   * Get papers by ArXiv ID
   */
  public static async getPaperByArXiv(
    arxivId: string,
    fields?: string[]
  ): Promise<SemanticScholarPaper | null> {
    return this.getPaper(arxivId, fields);
  }

  /**
   * Get author details
   */
  public static async getAuthor(
    authorId: string,
    options?: { limit?: number; fields?: string[] }
  ): Promise<any> {
    const limit = options?.limit || 10;
    const fields = options?.fields?.join(",") || "name,affiliations,bio,homepage,url,paperCount,citationCount";

    const url = new URL(`${this.BASE_URL}/author/${authorId}`);
    url.searchParams.set("fields", fields);
    if (limit) {
      url.searchParams.set("limit", limit.toString());
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Semantic Scholar API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get papers by author ID
   */
  public static async getPapersByAuthor(
    authorId: string,
    options?: PaperRecommendationOptions
  ): Promise<SemanticScholarResponse> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    const fields = options?.fields?.join(",") || this.DEFAULT_FIELDS;

    const url = new URL(`${this.BASE_URL}/author/${authorId}/papers`);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());
    url.searchParams.set("fields", fields);
    url.searchParams.set("sort", "citedBy");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Semantic Scholar API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as unknown as SemanticScholarResponse;
    
    return {
      data: data.data || [],
      total: data.total || 0,
      nextOffset: data.nextOffset,
    };
  }

  /**
   * Format paper for display
   */
  public static formatPaperForDisplay(paper: SemanticScholarPaper): {
    title: string;
    authors: string;
    year: string;
    citations: string;
    venue: string;
    url: string;
  } {
    const authors = paper.authors.slice(0, 3).map(a => a.name).join(", ");
    const moreAuthors = paper.authors.length > 3 ? ` et al.` : "";
    const year = paper.year?.toString() || "Unknown year";
    const citations = paper.citationCount?.toString() || "0";
    const venue = paper.venue || "Unknown venue";

    return {
      title: paper.title,
      authors: authors + moreAuthors,
      year,
      citations,
      venue,
      url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
    };
  }
}

/**
 * Initialize Semantic Scholar API module
 */
export function initSemanticScholarAPI(): void {
  if (typeof ztoolkit !== "undefined") {
    ztoolkit.log("Paper Copilot: Semantic Scholar API module initialized");
  }
}
