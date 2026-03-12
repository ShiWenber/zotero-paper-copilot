/**
 * Zotero Paper Copilot - Figure Detection Module
 * 
 * Detects figures (images, charts, tables) in PDF and enables click interaction
 * Uses PDF.js for image extraction and Zotero Reader API
 */

import { PDFParsing, PDFBlock } from "./pdf-parsing";

export interface FigureBlock {
  id: string;
  type: "figure" | "table" | "image";
  label: string; // "Figure 1", "Table 2", etc.
  caption: string;
  page: number;
  bbox: { x: number; y: number; width: number; height: number };
  imageData?: string; // Base64 encoded image
  items?: string[]; // Table rows if it's a table
}

export class FigureDetection {
  private static initialized = false;
  
  /**
   * Initialize figure detection
   */
  public static init(win: Window): void {
    if (this.initialized) {
      return;
    }
    
    this.initialized = true;
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Figure detection module initialized");
    }
  }
  
  /**
   * Detect all figures in the PDF
   */
  public static async detectFigures(win: Window): Promise<FigureBlock[]> {
    const figures: FigureBlock[] = [];
    
    try {
      const reader = this.getReader(win);
      if (!reader) {
        return figures;
      }
      
      const numPages = await reader._numPages || 10;
      const pagesToScan = Math.min(numPages, 30); // Limit for performance
      
      for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
        const pageFigures = await this.detectPageFigures(win, pageNum);
        figures.push(...pageFigures);
      }
      
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error detecting figures:", e);
      }
    }
    
    return figures;
  }
  
  /**
   * Get Zotero reader instance
   */
  private static getReader(win: Window): any {
    try {
      if (win.Zotero?.Reader) {
        const readers = win.Zotero.Reader.getAll();
        if (readers && readers.length > 0) {
          return readers[readers.length - 1];
        }
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }
  
  /**
   * Detect figures on a single page
   */
  private static async detectPageFigures(win: Window, pageNum: number): Promise<FigureBlock[]> {
    const figures: FigureBlock[] = [];
    
    try {
      const reader = this.getReader(win);
      if (!reader?._pdfDocument) {
        return figures;
      }
      
      const page = await reader._pdfDocument.getPage(pageNum);
      const ops = await page.getOperatorList();
      
      // Find image operators
      const imageInfos = ops.fnArray || [];
      const imageBBoxs = ops.argsArray || [];
      
      let figureCount = 0;
      let tableCount = 0;
      
      // Look for image/bitmap operations
      for (let i = 0; i < imageInfos.length; i++) {
        const fn = imageInfos[i];
        // PDF.js image operation codes
        if (fn === 85 || fn === 86 || fn === 1115 || fn === 1116) { // paintImageXObject, paintInlineImageXObject
          const bbox = imageBBoxs[i]?.[1] || [0, 0, 100, 100];
          figureCount++;
          
          const figure: FigureBlock = {
            id: `fig-${pageNum}-${figureCount}`,
            type: "image",
            label: `Figure ${figureCount}`,
            caption: "",
            page: pageNum,
            bbox: {
              x: bbox[0] || 0,
              y: bbox[1] || 0,
              width: (bbox[2] || 100) - (bbox[0] || 0),
              height: (bbox[3] || 100) - (bbox[1] || 0),
            },
          };
          
          figures.push(figure);
        }
      }
      
      // Look for table detection via text analysis
      const textContent = await page.getTextContent();
      const pageText = textContent.items?.map((item: any) => item.str).join(" ") || "";
      
      // Detect table captions
      const tableMatches = pageText.match(/(?:Table|表格|表)\s*(\d+[a-z]?)/gi);
      if (tableMatches) {
        for (const match of tableMatches) {
          tableCount++;
          const numMatch = match.match(/(\d+[a-z]?)/i);
          const tableNum = numMatch ? numMatch[1] : tableCount;
          
          figures.push({
            id: `table-${pageNum}-${tableCount}`,
            type: "table",
            label: `Table ${tableNum}`,
            caption: "",
            page: pageNum,
            bbox: { x: 0, y: 0, width: 0, height: 0 },
          });
        }
      }
      
      // Detect figure captions
      const figureMatches = pageText.match(/(?:Figure|图|图片)\s*(\d+[a-z]?)/gi);
      if (figureMatches) {
        for (const match of figureMatches) {
          const numMatch = match.match(/(\d+[a-z]?)/i);
          const figNum = numMatch ? numMatch[1] : figureCount;
          
          figures.push({
            id: `figure-${pageNum}-${figNum}`,
            type: "figure",
            label: `Figure ${figNum}`,
            caption: "",
            page: pageNum,
            bbox: { x: 0, y: 0, width: 0, height: 0 },
          });
        }
      }
      
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error detecting page figures:", e);
      }
    }
    
    return figures;
  }
  
  /**
   * Extract image data for a figure
   */
  public static async extractImage(win: Window, figure: FigureBlock): Promise<string | null> {
    try {
      const reader = this.getReader(win);
      if (!reader?._pdfDocument) {
        return null;
      }
      
      const page = await reader._pdfDocument.getPage(figure.page);
      const canvas = await this.pageToCanvas(page, figure.bbox);
      
      if (canvas) {
        return canvas.toDataURL("image/png");
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error extracting image:", e);
      }
    }
    
    return null;
  }
  
  /**
   * Render PDF page to canvas
   */
  private static async pageToCanvas(page: any, bbox?: { x: number; y: number; width: number; height: number }): Promise<HTMLCanvasElement | null> {
    try {
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      if (!context) {
        return null;
      }
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
      return canvas;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Find figure by label
   */
  public static findByLabel(figures: FigureBlock[], label: string): FigureBlock | undefined {
    return figures.find(f => 
      f.label.toLowerCase() === label.toLowerCase() ||
      f.label.toLowerCase().includes(label.toLowerCase())
    );
  }
  
  /**
   * Get figures on a specific page
   */
  public static getByPage(figures: FigureBlock[], page: number): FigureBlock[] {
    return figures.filter(f => f.page === page);
  }
}

/**
 * Initialize figure detection
 */
export function initFigureDetection(win: Window): void {
  setTimeout(() => {
    FigureDetection.init(win);
  }, 3000);
}
