import { assert } from "chai";
import { PdfService } from "../../src/services/PdfService";
import { ZoteroGateway } from "../../src/services/ZoteroGateway";
import { Rect } from "../../src/services/types";

// Mock global Zotero object for testing
const createMockZotero = () => ({
  Reader: {
    getAll: () => [],
    getByInstance: () => null,
  },
  Items: {
    get: () => null,
  },
  Item: class {
    id: number = 0;
    setField = () => {};
    save = () => true;
    setNote = () => {};
    constructor(type?: string) {
      if (type === "note") {
        this.id = 999;
      }
    }
  },
});

// Mock ZoteroGateway for testing
const createMockGateway = (): ZoteroGateway => {
  return {
    getSelectedItems: () => [],
    getItem: () => null,
    getPDF: () => null,
    getItemMetadata: () => ({
      title: "",
      authors: [],
      tags: [],
      collections: [],
    }),
    getCollectionItems: () => [],
    getCurrentCollection: () => null,
    onSelectionChange: () => () => {},
    getItemByKey: () => null,
    refreshView: () => {},
    addNote: async () => -1,
    updateItem: () => false,
  } as unknown as ZoteroGateway;
};

describe("PdfService", function () {
  let pdfService: PdfService;
  let mockGateway: ZoteroGateway;
  let mockZotero: ReturnType<typeof createMockZotero>;

  beforeEach(function () {
    mockZotero = createMockZotero();
    (global as any).Zotero = mockZotero;
    mockGateway = createMockGateway();
    pdfService = new PdfService(mockGateway);
  });

  describe("constructor", function () {
    it("should create PdfService with ZoteroGateway", function () {
      assert.instanceOf(pdfService, PdfService);
    });

    it("should store gateway reference", function () {
      assert.equal((pdfService as any).gateway, mockGateway);
    });
  });

  describe("getCurrentReader", function () {
    it("should return null when no readers exist", function () {
      mockZotero.Reader.getAll = () => [];
      const reader = pdfService.getCurrentReader();
      assert.isNull(reader);
    });

    it("should return null when Zotero.Reader is undefined", function () {
      delete (global as any).Zotero.Reader;
      const reader = pdfService.getCurrentReader();
      assert.isNull(reader);
    });

    it("should return last reader when multiple exist", function () {
      const reader1 = { id: 1 };
      const reader2 = { id: 2 };
      const reader3 = { id: 3 };
      mockZotero.Reader.getAll = () => [reader1, reader2, reader3];
      const reader = pdfService.getCurrentReader();
      assert.equal(reader, reader3);
    });

    it("should return null on error", function () {
      mockZotero.Reader.getAll = () => {
        throw new Error("Test error");
      };
      const reader = pdfService.getCurrentReader();
      assert.isNull(reader);
    });
  });

  describe("getPdfText", function () {
    it("should return empty string for null attachment", async function () {
      const text = await pdfService.getPdfText(null);
      assert.equal(text, "");
    });

    it("should return empty string when no reader found", async function () {
      mockZotero.Reader.getAll = () => [];
      const text = await pdfService.getPdfText({ key: "test" });
      assert.equal(text, "");
    });
  });

  describe("getPageText", function () {
    it("should return empty string for null attachment", async function () {
      const text = await pdfService.getPageText(null, 1);
      assert.equal(text, "");
    });

    it("should return empty string for invalid page number", async function () {
      const text = await pdfService.getPageText({}, 0);
      assert.equal(text, "");
      const text2 = await pdfService.getPageText({}, -1);
      assert.equal(text2, "");
    });

    it("should return empty string when no reader found", async function () {
      mockZotero.Reader.getAll = () => [];
      const text = await pdfService.getPageText({ key: "test" }, 1);
      assert.equal(text, "");
    });
  });

  describe("getSelectedText", function () {
    it("should return empty string for null window", function () {
      const text = pdfService.getSelectedText(null as any);
      assert.equal(text, "");
    });

    it("should return empty string when no selection", function () {
      const mockSelection = { toString: () => "", trim: () => "" };
      const mockWindow = { getSelection: () => mockSelection };
      const text = pdfService.getSelectedText(mockWindow as any);
      assert.equal(text, "");
    });

    it("should return trimmed selected text", function () {
      const mockSelection = {
        toString: () => "  selected text  ",
        trim: () => "selected text",
      };
      const mockWindow = { getSelection: () => mockSelection };
      const text = pdfService.getSelectedText(mockWindow as any);
      assert.equal(text, "selected text");
    });

    it("should return empty string on error", function () {
      const mockWindow = {
        getSelection: () => {
          throw new Error("Test error");
        },
      };
      const text = pdfService.getSelectedText(mockWindow as any);
      assert.equal(text, "");
    });
  });

  describe("getSelectionContext", function () {
    it("should return default context for null window", async function () {
      const context = await pdfService.getSelectionContext(null as any);
      assert.equal(context.page, 1);
      assert.equal(context.text, "");
      assert.isUndefined(context.item);
    });
  });

  describe("getPdfInfo", function () {
    it("should return default info for null attachment", async function () {
      const info = await pdfService.getPdfInfo(null);
      assert.equal(info.pageCount, 0);
      assert.deepEqual(info.keywords, []);
    });

    it("should return default info when reader not found", async function () {
      mockZotero.Reader.getAll = () => [];
      const info = await pdfService.getPdfInfo({ key: "test" });
      assert.equal(info.pageCount, 0);
    });

    it("should get page count from reader", async function () {
      const mockReader = {
        item: { key: "test" },
        numPages: 50,
        getPageInfo: () => true,
      };
      mockZotero.Reader.getAll = () => [mockReader];
      const info = await pdfService.getPdfInfo({
        key: "test",
        getField: () => "Title",
      });
      assert.equal(info.pageCount, 50);
    });
  });

  describe("goToPage", function () {
    it("should return false for null window", function () {
      const result = pdfService.goToPage(null as any, 1);
      assert.isFalse(result);
    });

    it("should return false for invalid page number", function () {
      const mockWindow = {};
      assert.isFalse(pdfService.goToPage(mockWindow as any, 0));
      assert.isFalse(pdfService.goToPage(mockWindow as any, -1));
    });

    it("should return false when no reader available", function () {
      mockZotero.Reader.getAll = () => [];
      const mockWindow = {};
      const result = pdfService.goToPage(mockWindow as any, 1);
      assert.isFalse(result);
    });

    it("should return true when navigateToPage is available", function () {
      let called = false;
      const mockReader = {
        navigateToPage: () => {
          called = true;
        },
      };
      mockZotero.Reader.getAll = () => [mockReader];
      const mockWindow = { document: { dispatchEvent: () => {} } };
      const result = pdfService.goToPage(mockWindow as any, 5);
      assert.isTrue(result);
      assert.isTrue(called);
    });

    it("should return true when goToPage is available", function () {
      let called = false;
      const mockReader = {
        goToPage: () => {
          called = true;
        },
      };
      mockZotero.Reader.getAll = () => [mockReader];
      const mockWindow = { document: { dispatchEvent: () => {} } };
      const result = pdfService.goToPage(mockWindow as any, 5);
      assert.isTrue(result);
      assert.isTrue(called);
    });

    it("should return true when dispatching custom event", function () {
      let eventDispatched = false;
      const mockReader = {};
      mockZotero.Reader.getAll = () => [mockReader];
      const mockWindow = {
        CustomEvent: class {
          detail: any;
          constructor(type: string, options: any) {
            if (type === "pdf-go-to-page") {
              eventDispatched = true;
            }
          }
        },
        document: {
          dispatchEvent: () => {
            eventDispatched = true;
          },
        },
      };
      const result = pdfService.goToPage(mockWindow as any, 5);
      assert.isTrue(result);
    });
  });

  describe("getAnnotations", function () {
    it("should return empty array for null attachment", function () {
      const annotations = pdfService.getAnnotations(null);
      assert.deepEqual(annotations, []);
    });

    it("should return empty array when getAnnotations returns null", function () {
      const mockAttachment = {
        getAnnotations: () => null,
      };
      const annotations = pdfService.getAnnotations(mockAttachment as any);
      assert.deepEqual(annotations, []);
    });

    it("should return empty array when getAnnotations returns empty array", function () {
      const mockAttachment = {
        getAnnotations: () => [],
      };
      const annotations = pdfService.getAnnotations(mockAttachment as any);
      assert.deepEqual(annotations, []);
    });

    it("should convert valid annotations", function () {
      const mockAnnot = {
        id: 123,
        annotationType: "highlight",
        annotationPageNumber: "5",
        annotationText: "Test text",
        annotationPosition:
          '{"x":100,"y":200,"width":300,"height":20}',
        annotationColor: "#FFFF00",
      };
      const mockAttachment = {
        getAnnotations: () => [mockAnnot],
      };
      const annotations = pdfService.getAnnotations(mockAttachment as any);
      assert.lengthOf(annotations, 1);
      assert.deepEqual(annotations[0], {
        id: "123",
        type: "highlight",
        page: 5,
        text: "Test text",
        position: { x: 100, y: 200, width: 300, height: 20 },
        color: "#FFFF00",
      });
    });

    it("should skip file type annotations", function () {
      const mockAnnot = {
        id: 123,
        annotationType: "file",
      };
      const mockAttachment = {
        getAnnotations: () => [mockAnnot],
      };
      const annotations = pdfService.getAnnotations(mockAttachment as any);
      assert.deepEqual(annotations, []);
    });

    it("should skip image type annotations", function () {
      const mockAnnot = {
        id: 123,
        annotationType: "image",
      };
      const mockAttachment = {
        getAnnotations: () => [mockAnnot],
      };
      const annotations = pdfService.getAnnotations(mockAttachment as any);
      assert.deepEqual(annotations, []);
    });

    it("should use default position when annotationPosition is object", function () {
      const mockAnnot = {
        id: 123,
        annotationType: "note",
        annotationPageNumber: "1",
        annotationText: "Note text",
        annotationPosition: { x: 10, y: 20, width: 100, height: 50 },
      };
      const mockAttachment = {
        getAnnotations: () => [mockAnnot],
      };
      const annotations = pdfService.getAnnotations(mockAttachment as any);
      assert.lengthOf(annotations, 1);
      assert.deepEqual(annotations[0].position, {
        x: 10,
        y: 20,
        width: 100,
        height: 50,
      });
    });

    it("should return empty array on error", function () {
      const mockAttachment = {
        getAnnotations: () => {
          throw new Error("Test error");
        },
      };
      const annotations = pdfService.getAnnotations(mockAttachment as any);
      assert.deepEqual(annotations, []);
    });
  });

  describe("createHighlight", function () {
    const validPosition: Rect = { x: 100, y: 200, width: 300, height: 20 };

    it("should return null for null attachment", function () {
      const result = pdfService.createHighlight(
        null as any,
        1,
        "text",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return null for invalid page", function () {
      const result = pdfService.createHighlight(
        { id: 1 },
        0,
        "text",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return null for empty text", function () {
      const result = pdfService.createHighlight(
        { id: 1 },
        1,
        "",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return null for null position", function () {
      const result = pdfService.createHighlight(
        { id: 1 },
        1,
        "text",
        null as any
      );
      assert.isNull(result);
    });

    it("should return null when save fails", function () {
      (global as any).Zotero.Item = class {
        setField = () => {};
        save = () => false;
      };
      const result = pdfService.createHighlight(
        { id: 1 },
        1,
        "text",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return annotation on success", function () {
      (global as any).Zotero.Item = class {
        id: number = 123;
        setField = () => {};
        save = () => true;
      };
      const result = pdfService.createHighlight(
        { id: 1 },
        5,
        "Test text",
        validPosition
      );
      assert.isNotNull(result);
      assert.equal(result?.type, "highlight");
      assert.equal(result?.page, 5);
      assert.equal(result?.text, "Test text");
      assert.deepEqual(result?.position, validPosition);
    });
  });

  describe("createNoteAnnotation", function () {
    const validPosition: Rect = { x: 0, y: 0, width: 100, height: 100 };

    it("should return null for null attachment", function () {
      const result = pdfService.createNoteAnnotation(
        null as any,
        1,
        "text",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return null for invalid page", function () {
      const result = pdfService.createNoteAnnotation(
        { id: 1 },
        0,
        "text",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return null for empty text", function () {
      const result = pdfService.createNoteAnnotation(
        { id: 1 },
        1,
        "",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return null for null position", function () {
      const result = pdfService.createNoteAnnotation(
        { id: 1 },
        1,
        "text",
        null as any
      );
      assert.isNull(result);
    });

    it("should return null when save fails", function () {
      (global as any).Zotero.Item = class {
        setField = () => {};
        save = () => false;
      };
      const result = pdfService.createNoteAnnotation(
        { id: 1 },
        1,
        "Note",
        validPosition
      );
      assert.isNull(result);
    });

    it("should return annotation on success", function () {
      (global as any).Zotero.Item = class {
        id: number = 456;
        setField = () => {};
        save = () => true;
      };
      const result = pdfService.createNoteAnnotation(
        { id: 1 },
        10,
        "Note content",
        validPosition
      );
      assert.isNotNull(result);
      assert.equal(result?.type, "note");
      assert.equal(result?.page, 10);
      assert.equal(result?.text, "Note content");
    });
  });

  describe("deleteAnnotation", function () {
    it("should return false for invalid annotationId", async function () {
      assert.isFalse(await pdfService.deleteAnnotation(0));
      assert.isFalse(await pdfService.deleteAnnotation(null as any));
    });

    it("should return false when annotation not found", async function () {
      mockZotero.Items.get = () => null;
      const result = pdfService.deleteAnnotation(123);
      // Using eventually pattern for promise return
      assert.isFalse(await result);
    });

    it("should return false when erase fails", async function () {
      mockZotero.Items.get = () => ({
        erase: async () => false,
      });
      const result = await pdfService.deleteAnnotation(123);
      assert.isFalse(result);
    });

    it("should return true when erase succeeds", async function () {
      mockZotero.Items.get = () => ({
        erase: async () => true,
      });
      const result = await pdfService.deleteAnnotation(123);
      assert.isTrue(result);
    });
  });
});
