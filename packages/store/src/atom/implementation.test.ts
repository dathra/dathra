import { describe, expect, it } from "vitest";

import { atom, type Getter } from "./implementation";

describe("atom", () => {
  describe("Basic behavior", () => {
    it("creates a primitive atom from an initial value", () => {
      const countAtom = atom("count", 0);

      expect(countAtom).toEqual({
        key: "count",
        kind: "primitive",
        init: 0,
      });
    });

    it("creates a derived atom from a getter", () => {
      const countAtom = atom("count", 1);
      const doubledAtom = atom("doubled", (get: Getter) => get(countAtom) * 2);
      const derivedAtom = doubledAtom;

      expect(derivedAtom.key).toBe("doubled");
      expect(derivedAtom.kind).toBe("derived");
      expect(
        derivedAtom.read((target) => {
          if (target.kind === "primitive") {
            return target.init;
          }
          throw new Error("Unexpected derived dependency");
        }),
      ).toBe(2);
    });
  });

  describe("Type identity", () => {
    it("marks primitive atoms with kind 'primitive'", () => {
      const nameAtom = atom("name", "dathra");

      expect(nameAtom.kind).toBe("primitive");
    });

    it("marks derived atoms with kind 'derived'", () => {
      const countAtom = atom("count", 2);
      const doubledAtom = atom("doubled", (get: Getter) => get(countAtom) * 2);

      expect(doubledAtom.kind).toBe("derived");
    });
  });

  describe("Definition behavior", () => {
    it("keeps atom definitions store-independent", () => {
      const countAtom = atom("count", 0);

      expect("init" in countAtom).toBe(true);
      expect("read" in countAtom).toBe(false);
    });

    it("uses object reference identity rather than key equality", () => {
      const leftAtom = atom("count", 0);
      const rightAtom = atom("count", 0);

      expect(leftAtom).not.toBe(rightAtom);
      expect(leftAtom.key).toBe(rightAtom.key);
    });

    it("allows derived atoms to reference other atoms through get()", () => {
      const countAtom = atom("count", 3);
      const labelAtom = atom(
        "label",
        (get: Getter) => `count:${get(countAtom)}`,
      );
      const derivedAtom = labelAtom;
      const primitiveGetter: Getter = <T>(target: Parameters<Getter>[0]) => {
        if (target.kind === "primitive") {
          return target.init as T;
        }
        throw new Error("Unexpected derived dependency");
      };

      const value = derivedAtom.read(primitiveGetter);

      expect(value).toBe("count:3");
    });

    it("does not expose write APIs on derived atom definitions", () => {
      const doubledAtom = atom("doubled", () => 2);

      expect("set" in doubledAtom).toBe(false);
      expect("init" in doubledAtom).toBe(false);
    });

    it("treats a function second argument as a derived getter", () => {
      const handler = () => 123;
      const handlerAtom = atom("handler", handler);
      const derivedAtom = handlerAtom;
      const getter: Getter = () => {
        throw new Error("No dependencies expected");
      };

      expect(derivedAtom.kind).toBe("derived");
      expect(derivedAtom.read(getter)).toBe(123);
    });
  });

  describe("Immutability", () => {
    it("freezes primitive atom definitions", () => {
      const countAtom = atom("count", 0);

      expect(Object.isFrozen(countAtom)).toBe(true);
    });

    it("freezes derived atom definitions", () => {
      const doubledAtom = atom("doubled", () => 2);

      expect(Object.isFrozen(doubledAtom)).toBe(true);
    });
  });
});
