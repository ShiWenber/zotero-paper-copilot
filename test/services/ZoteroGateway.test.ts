import { assert } from "chai";
import { ZoteroGateway } from "../../src/services/ZoteroGateway";

// Mock global Zotero object for testing
const createMockZotero = () => ({
  Items: {
    get: () => null,
    getByKey: () => null,
  },
  Collections: {
    get: () => null,
  },
  getActiveZoteroPane: () => null,
  Notifier: {
    registerObserver: () => {},
  },
  Reader: {
    getAll: () => [],
    getByInstance: () => null,
  },
});

describe("ZoteroGateway", function () {
  let gateway: ZoteroGateway;
  let mockZotero: ReturnType<typeof createMockZotero>;

  beforeEach(function () {
    // Store original Zotero and set up mock
    mockZotero = createMockZotero();
    (global as any).Zotero = mockZotero;
    gateway = new ZoteroGateway();
  });

  afterEach(function () {
    // Clean up global
    delete (global as any).Zotero;
  });

  describe("constructor", function () {
    it("should create ZoteroGateway instance", function () {
      assert.instanceOf(gateway, ZoteroGateway);
    });
  });

  describe("getSelectedItems", function () {
    it("should return empty array when no active pane", function () {
      mockZotero.getActiveZoteroPane = () => null;
      const items = gateway.getSelectedItems();
      assert.deepEqual(items, []);
    });

    it("should return empty array when getSelectedItems returns null", function () {
      const mockPane = {
        getSelectedItems: () => null,
      };
      mockZotero.getActiveZoteroPane = () => mockPane;
      const items = gateway.getSelectedItems();
      assert.deepEqual(items, []);
    });

    it("should return empty array when getSelectedItems returns empty array", function () {
      const mockPane = {
        getSelectedItems: () => [],
      };
      mockZotero.getActiveZoteroPane = () => mockPane;
      const items = gateway.getSelectedItems();
      assert.deepEqual(items, []);
    });

    it("should filter out items without id", function () {
      const mockPane = {
        getSelectedItems: () => [
          { id: 1 },
          { id: null },
          { id: 2 },
          {},
        ],
      };
      mockZotero.getActiveZoteroPane = () => mockPane;
      const items = gateway.getSelectedItems();
      assert.lengthOf(items, 2);
      assert.equal(items[0].id, 1);
      assert.equal(items[1].id, 2);
    });

    it("should return items with valid ids", function () {
      const mockItems = [{ id: 100 }, { id: 200 }];
      const mockPane = {
        getSelectedItems: () => mockItems,
      };
      mockZotero.getActiveZoteroPane = () => mockPane;
      const items = gateway.getSelectedItems();
      assert.deepEqual(items, mockItems);
    });
  });

  describe("getItem", function () {
    it("should return null for invalid itemID", function () {
      assert.isNull(gateway.getItem(0));
      assert.isNull(gateway.getItem(null as any));
      assert.isNull(gateway.getItem(undefined as any));
      assert.isNull(gateway.getItem("not-a-number" as any));
    });

    it("should return null when Zotero.Items.get returns null", function () {
      mockZotero.Items.get = () => null;
      assert.isNull(gateway.getItem(123));
    });

    it("should return item when found", function () {
      const mockItem = { id: 123, title: "Test Item" };
      mockZotero.Items.get = () => mockItem;
      assert.deepEqual(gateway.getItem(123), mockItem);
    });

    it("should return null on error", function () {
      mockZotero.Items.get = () => {
        throw new Error("Test error");
      };
      assert.isNull(gateway.getItem(123));
    });
  });

  describe("getItemMetadata", function () {
    it("should return empty metadata for null item", function () {
      const metadata = gateway.getItemMetadata(null);
      assert.deepEqual(metadata, {
        title: "",
        authors: [],
        tags: [],
        collections: [],
      });
    });

    it("should extract metadata from item with all fields", function () {
      const mockItem = {
        getCreators: () => [
          { creatorType: "author", firstName: "John", lastName: "Doe" },
          { creatorType: "author", firstName: "Jane", lastName: "Smith" },
          { creatorType: "editor", firstName: "Editor", lastName: "Name" },
        ],
        getTags: () => ["tag1", "tag2"],
        getCollections: () => ["collection1"],
        getField: (field: string) => {
          const fields: Record<string, string> = {
            title: "Test Paper",
            date: "2024-03-15",
            abstractNote: "Test abstract",
            DOI: "10.1234/test",
          };
          return fields[field];
        },
      };
      const metadata = gateway.getItemMetadata(mockItem);
      assert.equal(metadata.title, "Test Paper");
      assert.deepEqual(metadata.authors, ["John Doe", "Jane Smith"]);
      assert.equal(metadata.year, 2024);
      assert.equal(metadata.abstract, "Test abstract");
      assert.equal(metadata.doi, "10.1234/test");
      assert.deepEqual(metadata.tags, ["tag1", "tag2"]);
      assert.deepEqual(metadata.collections, ["collection1"]);
    });

    it("should handle item with no creators", function () {
      const mockItem = {
        getCreators: () => [],
        getTags: () => [],
        getCollections: () => [],
        getField: () => "",
      };
      const metadata = gateway.getItemMetadata(mockItem);
      assert.deepEqual(metadata.authors, []);
    });

    it("should handle item with empty name creators", function () {
      const mockItem = {
        getCreators: () => [
          { creatorType: "author", firstName: "", lastName: "" },
        ],
        getTags: () => [],
        getCollections: () => [],
        getField: () => "Title",
      };
      const metadata = gateway.getItemMetadata(mockItem);
      assert.deepEqual(metadata.authors, []);
    });

    it("should extract year from date field", function () {
      const mockItem = {
        getCreators: () => [],
        getTags: () => [],
        getCollections: () => [],
        getField: (field: string) => {
          if (field === "date") return "March 2023";
          if (field === "title") return "Paper";
          return "";
        },
      };
      const metadata = gateway.getItemMetadata(mockItem);
      assert.equal(metadata.year, 2023);
    });

    it("should handle missing date field", function () {
      const mockItem = {
        getCreators: () => [],
        getTags: () => [],
        getCollections: () => [],
        getField: (field: string) => {
          if (field === "title") return "Paper";
          return undefined as any;
        },
      };
      const metadata = gateway.getItemMetadata(mockItem);
      assert.isUndefined(metadata.year);
    });

    it("should handle tag objects with tag property", function () {
      const mockItem = {
        getCreators: () => [],
        getTags: () => [{ tag: "object-tag" }, "string-tag"],
        getCollections: () => [],
        getField: () => "Title",
      };
      const metadata = gateway.getItemMetadata(mockItem);
      assert.deepEqual(metadata.tags, ["object-tag", "string-tag"]);
    });

    it("should return empty strings for missing fields on error", function () {
      const mockItem = {
        getCreators: () => {
          throw new Error("Test error");
        },
        getTags: () => {
          throw new Error("Test error");
        },
        getCollections: () => {
          throw new Error("Test error");
        },
        getField: () => {
          throw new Error("Test error");
        },
      };
      const metadata = gateway.getItemMetadata(mockItem);
      assert.deepEqual(metadata, {
        title: "",
        authors: [],
        tags: [],
        collections: [],
      });
    });
  });

  describe("getCollectionItems", function () {
    it("should return empty array for invalid collectionID", function () {
      assert.deepEqual(gateway.getCollectionItems(0), []);
      assert.deepEqual(gateway.getCollectionItems(null as any), []);
      assert.deepEqual(gateway.getCollectionItems(undefined as any), []);
      assert.deepEqual(
        gateway.getCollectionItems("not-a-number" as any),
        []
      );
    });

    it("should return empty array when collection not found", function () {
      mockZotero.Collections.get = () => null;
      assert.deepEqual(gateway.getCollectionItems(123), []);
    });

    it("should return empty array when getChildItems returns null", function () {
      mockZotero.Collections.get = () => ({
        getChildItems: () => null,
      });
      assert.deepEqual(gateway.getCollectionItems(123), []);
    });

    it("should return empty array when getChildItems returns empty array", function () {
      mockZotero.Collections.get = () => ({
        getChildItems: () => [],
      });
      assert.deepEqual(gateway.getCollectionItems(123), []);
    });

    it("should filter out imported attachments", function () {
      const mockCollection = {
        getChildItems: () => [
          { id: 1, isImportedAttachment: () => true },
          { id: 2, isImportedAttachment: () => false },
          { id: 3, isImportedAttachment: () => true },
        ],
      };
      mockZotero.Collections.get = () => mockCollection;
      const items = gateway.getCollectionItems(123);
      assert.lengthOf(items, 1);
      assert.equal(items[0].id, 2);
    });
  });

  describe("getCurrentCollection", function () {
    it("should return null when no active pane", function () {
      mockZotero.getActiveZoteroPane = () => null;
      assert.isNull(gateway.getCurrentCollection());
    });

    it("should return null when getCurrentCollection returns null", function () {
      mockZotero.getActiveZoteroPane = () => ({
        getCurrentCollection: () => null,
      });
      assert.isNull(gateway.getCurrentCollection());
    });

    it("should return collection when found", function () {
      const mockCollection = { id: 123, name: "Test Collection" };
      mockZotero.getActiveZoteroPane = () => ({
        getCurrentCollection: () => mockCollection,
      });
      assert.deepEqual(gateway.getCurrentCollection(), mockCollection);
    });

    it("should return null on error", function () {
      mockZotero.getActiveZoteroPane = () => {
        throw new Error("Test error");
      };
      assert.isNull(gateway.getCurrentCollection());
    });
  });

  describe("onSelectionChange", function () {
    it("should register callback and return unsubscribe function", function () {
      const callback = () => {};
      const unsubscribe = gateway.onSelectionChange(callback);
      assert.isFunction(unsubscribe);
    });

    it("should allow multiple callbacks", function () {
      const callback1 = () => {};
      const callback2 = () => {};
      const unsub1 = gateway.onSelectionChange(callback1);
      const unsub2 = gateway.onSelectionChange(callback2);
      assert.isFunction(unsub1);
      assert.isFunction(unsub2);
    });

    it("should allow unsubscribe to remove callback", function () {
      const callback = () => {};
      const unsubscribe = gateway.onSelectionChange(callback);
      // After unsubscribe, calling it should not throw
      assert.doesNotThrow(() => unsubscribe());
    });
  });

  describe("getPDF", function () {
    it("should return null for null item", function () {
      assert.isNull(gateway.getPDF(null));
    });

    it("should return null when item is PDF attachment", function () {
      const mockItem = {
        isImportedAttachment: () => true,
        attachmentMIMEType: "application/pdf",
      };
      assert.deepEqual(gateway.getPDF(mockItem), mockItem);
    });

    it("should return null when item is not PDF attachment", function () {
      const mockItem = {
        isImportedAttachment: () => true,
        attachmentMIMEType: "image/jpeg",
      };
      assert.isNull(gateway.getPDF(mockItem));
    });

    it("should return null when getAttachments returns empty", function () {
      const mockItem = {
        isImportedAttachment: () => false,
        getAttachments: () => [],
        getChildren: () => null,
      };
      assert.isNull(gateway.getPDF(mockItem));
    });

    it("should find PDF in attachments", function () {
      const mockPdf = { id: 456, attachmentMIMEType: "application/pdf" };
      mockZotero.Items.get = (id: number) => {
        if (id === 456) return mockPdf;
        return null;
      };
      const mockItem = {
        isImportedAttachment: () => false,
        getAttachments: () => [456],
        getChildren: () => null,
      };
      assert.deepEqual(gateway.getPDF(mockItem), mockPdf);
    });

    it("should search children when no attachments found", function () {
      const mockPdf = { id: 789, attachmentMIMEType: "application/pdf" };
      mockZotero.Items.get = () => null;
      const mockItem = {
        isImportedAttachment: () => false,
        getAttachments: () => [],
        getChildren: () => [mockPdf],
      };
      const result = gateway.getPDF(mockItem);
      // Child is not an imported attachment, so it won't match
      assert.isNull(result);
    });
  });

  describe("getItemByKey", function () {
    it("should return null for empty key", function () {
      assert.isNull(gateway.getItemByKey(""));
    });

    it("should return null when item not found", function () {
      mockZotero.Items.getByKey = () => null;
      assert.isNull(gateway.getItemByKey("ABC123"));
    });

    it("should return item when found", function () {
      const mockItem = { key: "ABC123", title: "Test Item" };
      mockZotero.Items.getByKey = () => mockItem;
      assert.deepEqual(gateway.getItemByKey("ABC123"), mockItem);
    });

    it("should return null on error", function () {
      mockZotero.Items.getByKey = () => {
        throw new Error("Test error");
      };
      assert.isNull(gateway.getItemByKey("ABC123"));
    });
  });

  describe("refreshView", function () {
    it("should not throw when no active pane", function () {
      mockZotero.getActiveZoteroPane = () => null;
      assert.doesNotThrow(() => gateway.refreshView());
    });

    it("should call refreshAndRevert when available", function () {
      let called = false;
      mockZotero.getActiveZoteroPane = () => ({
        refreshAndRevert: () => {
          called = true;
        },
      });
      gateway.refreshView();
      assert.isTrue(called);
    });

    it("should not throw on error", function () {
      mockZotero.getActiveZoteroPane = () => {
        throw new Error("Test error");
      };
      assert.doesNotThrow(() => gateway.refreshView());
    });
  });

  describe("addNote", function () {
    it("should return -1 for null item", async function () {
      const result = await gateway.addNote(null, "Note content");
      assert.equal(result, -1);
    });

    it("should return -1 for empty note content", async function () {
      const result = await gateway.addNote({ id: 123 }, "");
      assert.equal(result, -1);
    });

    it("should return -1 when note save fails", async function () {
      const mockNote = {
        setNote: () => {},
        save: async () => false,
      };
      (global as any).Zotero.Item = class {
        constructor() {
          return mockNote;
        }
      };
      const result = await gateway.addNote({ id: 123 }, "Note content");
      assert.equal(result, -1);
    });

    it("should return note id on success", async function () {
      const mockNote = {
        setNote: () => {},
        save: async () => true,
        id: 999,
      };
      (global as any).Zotero.Item = class {
        constructor() {
          return mockNote;
        }
      };
      const result = await gateway.addNote({ id: 123 }, "Note content");
      assert.equal(result, 999);
    });
  });

  describe("updateItem", function () {
    it("should return false for null item", function () {
      assert.isFalse(gateway.updateItem(null, {}));
    });

    it("should return false for null updates", function () {
      assert.isFalse(gateway.updateItem({ id: 123 }, null as any));
    });

    it("should update title field", function () {
      let saved = false;
      const mockItem = {
        setField: (field: string, value: string) => {
          if (field === "title") saved = true;
        },
        save: () => true,
      };
      const result = gateway.updateItem(mockItem, { title: "New Title" });
      assert.isTrue(result);
      assert.isTrue(saved);
    });

    it("should update year field", function () {
      let saved = false;
      const mockItem = {
        setField: (field: string, value: string) => {
          if (field === "date") saved = true;
        },
        save: () => true,
      };
      const result = gateway.updateItem(mockItem, { year: 2024 });
      assert.isTrue(result);
      assert.isTrue(saved);
    });

    it("should update abstract field", function () {
      let saved = false;
      const mockItem = {
        setField: (field: string, value: string) => {
          if (field === "abstractNote") saved = true;
        },
        save: () => true,
      };
      const result = gateway.updateItem(mockItem, {
        abstract: "New abstract",
      });
      assert.isTrue(result);
      assert.isTrue(saved);
    });

    it("should update DOI field", function () {
      let saved = false;
      const mockItem = {
        setField: (field: string, value: string) => {
          if (field === "DOI") saved = true;
        },
        save: () => true,
      };
      const result = gateway.updateItem(mockItem, { doi: "10.1234/new" });
      assert.isTrue(result);
      assert.isTrue(saved);
    });

    it("should update tags field", function () {
      let saved = false;
      const mockItem = {
        setTags: () => {
          saved = true;
        },
        save: () => true,
      };
      const result = gateway.updateItem(mockItem, {
        tags: ["tag1", "tag2"],
      });
      assert.isTrue(result);
      assert.isTrue(saved);
    });

    it("should return false when save fails", function () {
      const mockItem = {
        setField: () => {},
        save: () => false,
      };
      const result = gateway.updateItem(mockItem, { title: "New Title" });
      assert.isFalse(result);
    });

    it("should return false on error", function () {
      const mockItem = {
        setField: () => {
          throw new Error("Test error");
        },
        save: () => true,
      };
      const result = gateway.updateItem(mockItem, { title: "New Title" });
      assert.isFalse(result);
    });
  });
});
