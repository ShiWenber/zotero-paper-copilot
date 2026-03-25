/**
 * Service Layer Type Definitions
 * Core types for ZoteroGateway and PdfService
 */

/**
 * Item metadata extracted from a Zotero item
 */
export interface ItemMetadata {
  title: string;
  authors: string[];
  year?: number;
  abstract?: string;
  doi?: string;
  tags: string[];
  collections: string[];
}

/**
 * PDF document information
 */
export interface PdfInfo {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords: string[];
}

/**
 * Rectangle region on a PDF page
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * PDF annotation types
 */
export type AnnotationType = "highlight" | "note" | "underline";

/**
 * PDF annotation/highlight
 */
export interface Annotation {
  id: string;
  type: AnnotationType;
  page: number;
  text: string;
  position: Rect;
  color?: string;
}

/**
 * Selection context in PDF reader
 */
export interface SelectionContext {
  page: number;
  text: string;
  position?: Rect;
  item?: any;
}

/**
 * Zotero selection change event
 */
export interface SelectionChangeEvent {
  items: any[];
  type: "library" | "collection" | "search" | "reader";
}
