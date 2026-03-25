import { assert } from "chai";
import {
  ItemMetadata,
  PdfInfo,
  Annotation,
  Rect,
  AnnotationType,
  SelectionContext,
  SelectionChangeEvent,
} from "../../src/services/types";

describe("Service Types", function () {
  describe("ItemMetadata", function () {
    it("should create valid item metadata with all fields", function () {
      const metadata: ItemMetadata = {
        title: "Test Paper",
        authors: ["Author 1", "Author 2"],
        year: 2024,
        abstract: "Test abstract",
        doi: "10.1234/test",
        tags: ["tag1", "tag2"],
        collections: ["collection1"],
      };
      assert.equal(metadata.title, "Test Paper");
      assert.lengthOf(metadata.authors, 2);
      assert.equal(metadata.year, 2024);
      assert.equal(metadata.abstract, "Test abstract");
      assert.equal(metadata.doi, "10.1234/test");
      assert.deepEqual(metadata.tags, ["tag1", "tag2"]);
      assert.deepEqual(metadata.collections, ["collection1"]);
    });

    it("should support optional fields being undefined", function () {
      const metadata: ItemMetadata = {
        title: "Minimal Paper",
        authors: [],
        tags: [],
        collections: [],
      };
      assert.equal(metadata.title, "Minimal Paper");
      assert.lengthOf(metadata.authors, 0);
      assert.isUndefined(metadata.year);
      assert.isUndefined(metadata.abstract);
      assert.isUndefined(metadata.doi);
    });

    it("should allow partial optional fields", function () {
      const metadata: ItemMetadata = {
        title: "Partial Paper",
        authors: ["John Doe"],
        year: 2023,
        tags: [],
        collections: [],
      };
      assert.equal(metadata.year, 2023);
      assert.isUndefined(metadata.abstract);
      assert.isUndefined(metadata.doi);
    });
  });

  describe("PdfInfo", function () {
    it("should create valid PDF info with all fields", function () {
      const pdfInfo: PdfInfo = {
        pageCount: 100,
        title: "PDF Title",
        author: "Author Name",
        subject: "Subject",
        keywords: ["keyword1", "keyword2"],
      };
      assert.equal(pdfInfo.pageCount, 100);
      assert.equal(pdfInfo.title, "PDF Title");
      assert.equal(pdfInfo.author, "Author Name");
      assert.equal(pdfInfo.subject, "Subject");
      assert.deepEqual(pdfInfo.keywords, ["keyword1", "keyword2"]);
    });

    it("should support minimal PDF info with only pageCount", function () {
      const pdfInfo: PdfInfo = {
        pageCount: 50,
        keywords: [],
      };
      assert.equal(pdfInfo.pageCount, 50);
      assert.isUndefined(pdfInfo.title);
      assert.isUndefined(pdfInfo.author);
      assert.isUndefined(pdfInfo.subject);
      assert.lengthOf(pdfInfo.keywords, 0);
    });
  });

  describe("Rect", function () {
    it("should create valid rectangle", function () {
      const rect: Rect = { x: 100, y: 200, width: 300, height: 20 };
      assert.equal(rect.x, 100);
      assert.equal(rect.y, 200);
      assert.equal(rect.width, 300);
      assert.equal(rect.height, 20);
    });

    it("should allow zero values", function () {
      const rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
      assert.equal(rect.x, 0);
      assert.equal(rect.y, 0);
      assert.equal(rect.width, 0);
      assert.equal(rect.height, 0);
    });

    it("should allow negative coordinates", function () {
      const rect: Rect = { x: -50, y: -100, width: 200, height: 150 };
      assert.equal(rect.x, -50);
      assert.equal(rect.y, -100);
    });
  });

  describe("AnnotationType", function () {
    it("should be highlight type", function () {
      const type: AnnotationType = "highlight";
      assert.equal(type, "highlight");
    });

    it("should be note type", function () {
      const type: AnnotationType = "note";
      assert.equal(type, "note");
    });

    it("should be underline type", function () {
      const type: AnnotationType = "underline";
      assert.equal(type, "underline");
    });
  });

  describe("Annotation", function () {
    it("should create highlight annotation with all fields", function () {
      const annotation: Annotation = {
        id: "ann_1",
        type: "highlight",
        page: 5,
        text: "Selected text",
        position: { x: 100, y: 200, width: 300, height: 20 },
        color: "#FFFF00",
      };
      assert.equal(annotation.id, "ann_1");
      assert.equal(annotation.type, "highlight");
      assert.equal(annotation.page, 5);
      assert.equal(annotation.text, "Selected text");
      assert.deepEqual(annotation.position, {
        x: 100,
        y: 200,
        width: 300,
        height: 20,
      });
      assert.equal(annotation.color, "#FFFF00");
    });

    it("should create note annotation", function () {
      const annotation: Annotation = {
        id: "ann_2",
        type: "note",
        page: 10,
        text: "Note content",
        position: { x: 0, y: 0, width: 0, height: 0 },
      };
      assert.equal(annotation.type, "note");
      assert.equal(annotation.page, 10);
      assert.equal(annotation.text, "Note content");
    });

    it("should create underline annotation", function () {
      const annotation: Annotation = {
        id: "ann_3",
        type: "underline",
        page: 3,
        text: "Underlined text",
        position: { x: 50, y: 100, width: 200, height: 10 },
        color: "#FF0000",
      };
      assert.equal(annotation.type, "underline");
    });

    it("should support optional color field being undefined", function () {
      const annotation: Annotation = {
        id: "ann_4",
        type: "highlight",
        page: 1,
        text: "No color",
        position: { x: 0, y: 0, width: 100, height: 10 },
      };
      assert.isUndefined(annotation.color);
    });
  });

  describe("SelectionContext", function () {
    it("should create valid selection context", function () {
      const context: SelectionContext = {
        page: 5,
        text: "Selected text content",
        position: { x: 10, y: 20, width: 100, height: 30 },
      };
      assert.equal(context.page, 5);
      assert.equal(context.text, "Selected text content");
      assert.deepEqual(context.position, {
        x: 10,
        y: 20,
        width: 100,
        height: 30,
      });
    });

    it("should support minimal selection context", function () {
      const context: SelectionContext = {
        page: 1,
        text: "",
      };
      assert.equal(context.page, 1);
      assert.equal(context.text, "");
      assert.isUndefined(context.position);
      assert.isUndefined(context.item);
    });
  });

  describe("SelectionChangeEvent", function () {
    it("should create library type event", function () {
      const event: SelectionChangeEvent = {
        items: [],
        type: "library",
      };
      assert.equal(event.type, "library");
      assert.deepEqual(event.items, []);
    });

    it("should create collection type event", function () {
      const event: SelectionChangeEvent = {
        items: [{ id: 1 }, { id: 2 }],
        type: "collection",
      };
      assert.equal(event.type, "collection");
      assert.lengthOf(event.items, 2);
    });

    it("should create search type event", function () {
      const event: SelectionChangeEvent = {
        items: [],
        type: "search",
      };
      assert.equal(event.type, "search");
    });

    it("should create reader type event", function () {
      const event: SelectionChangeEvent = {
        items: [],
        type: "reader",
      };
      assert.equal(event.type, "reader");
    });
  });
});
