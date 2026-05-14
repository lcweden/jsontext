import State from "#src/modules/state";
import { assertEquals, assertExists, assertThrows } from "#std/assert";
import { KIND, MAX_NESTING_DEPTH } from "../src/common/constants.ts";

Deno.test("[module] state", async (test) => {
  await test.step("[function] constructor", async (test) => {
    await test.step("should initialize state with default options", () => {
      const state = new State({});

      assertExists(state);
    });

    await test.step("should start at depth 1", () => {
      const state = new State({});

      assertEquals(state.depth(), 1);
    });

    await test.step("should not need object name initially", () => {
      const state = new State({});

      assertEquals(state.needObjectName(), false);
    });

    await test.step("should not need object value initially", () => {
      const state = new State({});

      assertEquals(state.needObjectValue(), false);
    });
  });

  await test.step("[function] appendLiteral", async (test) => {
    await test.step("should not throw in array context", () => {
      const state = new State({});

      state.pushArray();
      state.appendLiteral();
    });

    await test.step("should not throw when appending object value", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.appendLiteral();
    });

    await test.step("should throw when object name is expected", () => {
      const state = new State({});

      state.pushObject();

      assertThrows(() => state.appendLiteral(), SyntaxError);
    });
  });

  await test.step("[function] appendString", async (test) => {
    await test.step("should not throw in array context", () => {
      const state = new State({});

      state.pushArray();
      state.appendString();
    });

    await test.step("should not throw when object name is expected", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();

      assertEquals(state.needObjectValue(), true);
    });

    await test.step("should not throw when object value is expected", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.appendString();

      assertEquals(state.needObjectName(), true);
    });
  });

  await test.step("[function] appendNumber", async (test) => {
    await test.step("should not throw in array context", () => {
      const state = new State({});

      state.pushArray();
      state.appendNumber();
    });

    await test.step("should not throw when appending object value", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.appendNumber();
    });

    await test.step("should throw when object name is expected", () => {
      const state = new State({});

      state.pushObject();

      assertThrows(() => state.appendNumber(), SyntaxError);
    });
  });

  await test.step("[function] depth", async (test) => {
    await test.step("should return 1 initially", () => {
      const state = new State({});

      assertEquals(state.depth(), 1);
    });

    await test.step("should increase by 1 after pushArray", () => {
      const state = new State({});

      state.pushArray();

      assertEquals(state.depth(), 2);
    });

    await test.step("should increase by 1 after pushObject", () => {
      const state = new State({});

      state.pushObject();

      assertEquals(state.depth(), 2);
    });

    await test.step("should decrease by 1 after popArray", () => {
      const state = new State({});

      state.pushArray();
      state.popArray();

      assertEquals(state.depth(), 1);
    });

    await test.step("should decrease by 1 after popObject", () => {
      const state = new State({});

      state.pushObject();
      state.popObject();

      assertEquals(state.depth(), 1);
    });

    await test.step("should track multiple levels of nesting", () => {
      const state = new State({});

      state.pushArray();
      state.pushObject();

      assertEquals(state.depth(), 3);
    });
  });

  await test.step("[function] needDelimiter", async (test) => {
    await test.step("should return null initially", () => {
      const state = new State({});

      assertEquals(state.needDelimiter(KIND.STRING), null);
    });

    await test.step("should return null for empty nested array", () => {
      const state = new State({});

      state.pushArray();

      assertEquals(state.needDelimiter(KIND.STRING), null);
    });

    await test.step("should return comma after first item in nested array", () => {
      const state = new State({});

      state.pushArray();
      state.appendString();

      assertEquals(state.needDelimiter(KIND.STRING), ",");
    });

    await test.step("should return null before array end even with items", () => {
      const state = new State({});

      state.pushArray();
      state.appendString();

      assertEquals(state.needDelimiter(KIND.ARRAY_END), null);
    });

    await test.step("should return colon after object name", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();

      assertEquals(state.needDelimiter(KIND.STRING), ":");
    });

    await test.step("should return comma before second object name", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.appendString();

      assertEquals(state.needDelimiter(KIND.STRING), ",");
    });

    await test.step("should return null before object end even with items", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.appendString();

      assertEquals(state.needDelimiter(KIND.OBJECT_END), null);
    });

    await test.step("should return null at root level even with items", () => {
      const state = new State({});
      state.appendString();

      assertEquals(state.needDelimiter(KIND.STRING), null);
    });
  });

  await test.step("[function] needObjectName", async (test) => {
    await test.step("should return false in array context", () => {
      const state = new State({});

      assertEquals(state.needObjectName(), false);
    });

    await test.step("should return true immediately after pushObject", () => {
      const state = new State({});

      state.pushObject();

      assertEquals(state.needObjectName(), true);
    });

    await test.step("should return false after appending object name", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();

      assertEquals(state.needObjectName(), false);
    });

    await test.step("should return true again after appending object value", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.appendString();

      assertEquals(state.needObjectName(), true);
    });
  });

  await test.step("[function] needObjectValue", async (test) => {
    await test.step("should return false in array context", () => {
      const state = new State({});

      assertEquals(state.needObjectValue(), false);
    });

    await test.step("should return false immediately after pushObject", () => {
      const state = new State({});

      state.pushObject();

      assertEquals(state.needObjectValue(), false);
    });

    await test.step("should return true after appending object name", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();

      assertEquals(state.needObjectValue(), true);
    });

    await test.step("should return false after appending object value", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.appendString();

      assertEquals(state.needObjectValue(), false);
    });
  });

  await test.step("[function] pushArray", async (test) => {
    await test.step("should not throw in array context", () => {
      const state = new State({});

      state.pushArray();
    });

    await test.step("should not throw when object value is expected", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();
      state.pushArray();
    });

    await test.step("should throw when object name is expected", () => {
      const state = new State({});

      state.pushObject();

      assertThrows(() => state.pushArray(), SyntaxError);
    });

    await test.step("should throw when max nesting depth is exceeded", () => {
      const state = new State({});

      for (let i = 0; i < MAX_NESTING_DEPTH; i++) {
        state.pushArray();
      }

      assertThrows(() => state.pushArray(), RangeError);
    });
  });

  await test.step("[function] popArray", async (test) => {
    await test.step("should restore depth after pushArray", () => {
      const state = new State({});

      state.pushArray();
      state.popArray();

      assertEquals(state.depth(), 1);
    });

    await test.step("should throw at root level", () => {
      const state = new State({});

      assertThrows(() => state.popArray(), SyntaxError);
    });

    await test.step("should throw when inside an object", () => {
      const state = new State({});

      state.pushObject();

      assertThrows(() => state.popArray(), SyntaxError);
    });
  });

  await test.step("[function] pushObject", async (test) => {
    await test.step("should not throw in array context", () => {
      const state = new State({});

      state.pushObject();
    });

    await test.step("should not throw when object value is expected", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();

      state.pushObject();
    });

    await test.step("should throw when object name is expected", () => {
      const state = new State({});

      state.pushObject();

      assertThrows(() => state.pushObject(), SyntaxError, "object name must be a string");
    });

    await test.step("should throw when max nesting depth is exceeded", () => {
      const state = new State({});

      for (let i = 0; i < MAX_NESTING_DEPTH; i++) {
        state.pushArray();
      }

      assertThrows(() => state.pushObject(), RangeError, "exceeded max depth");
    });
  });

  await test.step("[function] popObject", async (test) => {
    await test.step("should restore depth after pushObject", () => {
      const state = new State({});

      state.pushObject();
      state.popObject();

      assertEquals(state.depth(), 1);
    });

    await test.step("should throw when inside an array", () => {
      const state = new State({});

      state.pushArray();

      assertThrows(() => state.popObject(), SyntaxError, "mismatching } for object");
    });

    await test.step("should throw at root level", () => {
      const state = new State({});

      assertThrows(() => state.popObject(), SyntaxError, "mismatching } for object");
    });

    await test.step("should throw when object value is pending", () => {
      const state = new State({});

      state.pushObject();
      state.appendString();

      assertThrows(() => state.popObject(), SyntaxError, "missing value after object name");
    });
  });

  await test.step("[function] setLast", async (test) => {
    await test.step("should not throw for a unique name", () => {
      const state = new State({});

      state.pushObject();
      state.setLast("key");
    });

    await test.step("should throw for a duplicate name in the same object", () => {
      const state = new State({});

      state.pushObject();
      state.setLast("key");
      state.appendString();
      state.appendString();

      assertThrows(() => state.setLast("key"), SyntaxError);
    });

    await test.step("should allow duplicate names when allowDuplicateNames is true", () => {
      const state = new State({ allowDuplicateNames: true });

      state.pushObject();
      state.setLast("key");
      state.appendString();
      state.appendString();
      state.setLast("key");
    });

    await test.step("should allow same name in different nested objects", () => {
      const state = new State({});

      state.pushObject();
      state.setLast("key");
      state.appendString();
      state.appendString();
      state.popObject();
      state.pushObject();
      state.setLast("key");
    });
  });

  await test.step("[function] stackPointer", async (test) => {
    await test.step("should return empty pointer at root level", () => {
      const state = new State({});

      assertEquals(state.stackPointer(-1).toString(), "");
      assertEquals(state.stackPointer(0).toString(), "");
      assertEquals(state.stackPointer(1).toString(), "");
    });

    await test.step("should return empty pointer for empty nested array", () => {
      const state = new State({});

      state.pushArray();

      assertEquals(state.stackPointer(-1).toString(), "");
      assertEquals(state.stackPointer(0).toString(), "");
    });

    await test.step("should return next index for empty nested array", () => {
      const state = new State({});

      state.pushArray();

      assertEquals(state.stackPointer(1).toString(), "/0");
    });

    await test.step("should point to last written index in array", () => {
      const state = new State({});

      state.pushArray();
      state.appendString();

      assertEquals(state.stackPointer(-1).toString(), "/0");
      assertEquals(state.stackPointer(1).toString(), "/1");
    });

    await test.step("should point to key when object value is expected", () => {
      const state = new State({});

      state.pushObject();
      state.setLast("key");
      state.appendString();

      assertEquals(state.stackPointer(-1).toString(), "/key");
      assertEquals(state.stackPointer(0).toString(), "/key");
      assertEquals(state.stackPointer(1).toString(), "/key");
    });

    await test.step("should return empty pointer after completing object pair", () => {
      const state = new State({});

      state.pushObject();
      state.setLast("key");
      state.appendString();
      state.appendString();

      assertEquals(state.stackPointer(0).toString(), "");
      assertEquals(state.stackPointer(1).toString(), "");
    });

    await test.step("should escape special characters in key names", () => {
      const state = new State({});

      state.pushObject();
      state.setLast("a/b~c");
      state.appendString();

      assertEquals(state.stackPointer(0).toString(), "/a~1b~0c");
    });

    await test.step("should build pointer across nested structures", () => {
      const state = new State({});

      state.pushObject();
      state.setLast("a");
      state.appendString();
      state.pushArray();
      state.appendString();

      assertEquals(state.stackPointer(-1).toString(), "/a/0");
      assertEquals(state.stackPointer(0).toString(), "/a");
      assertEquals(state.stackPointer(1).toString(), "/a/1");
    });
  });
});
