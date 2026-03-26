/**
 * Tool Registry System - Screenshot OCR Tool
 * Capture a region of the PDF and extract text using OCR
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export class ScreenshotTool extends BaseTool {
  name = "screenshot_ocr";
  description = "Take a screenshot of a PDF region and extract text using OCR";
  category = "read";

  parameters = [
    {
      name: "region",
      description:
        "Region to capture: {x, y, width, height} in screen coordinates. If not provided, user will be prompted to select a region.",
      type: "object",
      required: false,
      properties: {
        x: { description: "X coordinate of top-left corner", type: "number" },
        y: { description: "Y coordinate of top-left corner", type: "number" },
        width: { description: "Width of region", type: "number" },
        height: { description: "Height of region", type: "number" },
      },
    },
  ];

  async doExecute(
    args: {
      region?: { x: number; y: number; width: number; height: number };
    },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { region } = args;
      const { window: win } = context;

      // Check if tesseract.js is available
      const hasTesseract = await this.checkTesseractAvailable();
      if (!hasTesseract) {
        return {
          result: null,
          error:
            "OCR feature requires tesseract.js integration. Install with: npm install tesseract.js. " +
            "For now, you can use the built-in screenshot tool to capture regions manually.",
        };
      }

      if (!region) {
        // No region provided - trigger interactive screenshot mode
        // The UI should handle showing a selection overlay
        return {
          result: {
            status: "awaiting_selection",
            message:
              "Screenshot mode activated. Please select a region on the PDF to capture.",
          },
        };
      }

      // Capture the specified region
      const capturedImage = await this.captureScreenRegion(region, win);
      if (!capturedImage) {
        return {
          result: null,
          error: "Failed to capture screen region",
        };
      }

      // Run OCR on the captured image
      const extractedText = await this.runOCR(capturedImage);

      return {
        result: {
          extractedText,
          region,
          message: "Text extracted from screenshot",
        },
      };
    } catch (err: any) {
      this.log("execute error:", err);
      return {
        result: null,
        error: err?.message ?? String(err),
      };
    }
  }

  /**
   * Check if tesseract.js is available
   */
  private async checkTesseractAvailable(): Promise<boolean> {
    try {
      // Check if Tesseract is available globally or as a module
      if (typeof Tesseract !== "undefined") {
        return true;
      }
      // Try dynamic import
      try {
        await import("tesseract.js");
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Capture a screen region from the window
   * Returns base64 encoded image data
   */
  private async captureScreenRegion(
    region: { x: number; y: number; width: number; height: number },
    win: Window,
  ): Promise<string | null> {
    try {
      // Use the window's canvas to capture
      // For Zotero PDF reader, we may need to capture the PDF view element
      const pdfView = win.document.querySelector(
        "#pdf-viewer, #reader, .pdf-viewer, .reader-pane",
      );
      if (!pdfView) {
        this.log("PDF viewer element not found");
        return null;
      }

      // Create a canvas to draw the region
      const canvas = win.document.createElement("canvas");
      canvas.width = region.width;
      canvas.height = region.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Create an image from the element
      const svgData = new XMLSerializer().serializeToString(pdfView as Element);
      const img = new win.Image();
      const svgBlob = new win.Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      return await new Promise((resolve) => {
        img.onload = () => {
          ctx.drawImage(
            img,
            region.x,
            region.y,
            region.width,
            region.height,
            0,
            0,
            region.width,
            region.height,
          );
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    } catch (e) {
      this.log("captureScreenRegion error:", e);
      return null;
    }
  }

  /**
   * Run OCR on an image using tesseract.js
   */
  private async runOCR(imageData: string): Promise<string> {
    try {
      const tesseract = await import("tesseract.js");
      const { createWorker } = tesseract;
      const worker = await createWorker("eng");

      const {
        data: { text },
      } = await worker.recognize(imageData);

      await worker.terminate();

      return text.trim();
    } catch (e) {
      this.log("runOCR error:", e);
      throw new Error("OCR processing failed. Please try again.", { cause: e });
    }
  }
}
