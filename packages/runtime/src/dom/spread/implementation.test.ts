import { createRoot } from "@dathra/reactivity";
import { describe, expect, it, vi } from "vitest";

import { spread } from "../../index";

describe("spread", () => {
  it("should apply initial props", () => {
    const div = document.createElement("div");
    spread(div, null, { class: "test", "data-id": "1" });

    expect(div.className).toBe("test");
    expect(div.getAttribute("data-id")).toBe("1");
  });

  it("should add new attributes", () => {
    const div = document.createElement("div");
    const prev = spread(div, null, { class: "test" });
    spread(div, prev, { class: "test", "data-new": "value" });

    expect(div.getAttribute("data-new")).toBe("value");
  });

  it("should update changed props", () => {
    const div = document.createElement("div");
    const prev = spread(div, null, { class: "old" });
    spread(div, prev, { class: "new" });

    expect(div.className).toBe("new");
  });

  it("should remove props that are no longer present", () => {
    const div = document.createElement("div");
    const prev = spread(div, null, { class: "test", "data-id": "1" });
    spread(div, prev, { class: "test" });

    expect(div.hasAttribute("data-id")).toBe(false);
  });

  it("should removeAttribute for deleted props", () => {
    const div = document.createElement("div");
    const removeAttributeSpy = vi.spyOn(div, "removeAttribute");
    const prev = spread(div, null, { "data-foo": "bar" });
    spread(div, prev, {});

    expect(removeAttributeSpy).toHaveBeenCalledWith("data-foo");
  });

  it("should not update unchanged props", () => {
    const div = document.createElement("div");
    const prev = spread(div, null, { class: "test" });

    // Spy on setAttribute to verify it's not called for unchanged props
    const setAttributeSpy = vi.spyOn(div, "setAttribute");
    spread(div, prev, { class: "test" });

    expect(setAttributeSpy).not.toHaveBeenCalled();
  });

  it("should handle event handlers in props", () => {
    const div = document.createElement("div");
    const handler = vi.fn();

    createRoot(() => {
      spread(div, null, { onClick: handler });
    });

    div.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should update event handlers correctly", () => {
    const div = document.createElement("div");
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    createRoot(() => {
      const prev = spread(div, null, { onClick: handler1 });
      spread(div, prev, { onClick: handler2 });
    });

    div.click();
    // Only new handler should be called (old one should be removed)
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("should remove event handlers when deleted from props", () => {
    const div = document.createElement("div");
    const handler = vi.fn();

    createRoot(() => {
      const prev = spread(div, null, { onClick: handler });
      spread(div, prev, {});
    });

    div.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it("should return next props for chaining", () => {
    const div = document.createElement("div");
    const props = { class: "test" };
    const result = spread(div, null, props);

    expect(result).toBe(props);
  });

  it("should handle multiple props at once", () => {
    const div = document.createElement("div");
    spread(div, null, {
      class: "container",
      id: "main",
      "data-value": "42",
      title: "Title text",
    });

    expect(div.className).toBe("container");
    expect(div.id).toBe("main");
    expect(div.getAttribute("data-value")).toBe("42");
    expect(div.title).toBe("Title text");
  });

  it("should handle null props object", () => {
    const div = document.createElement("div");
    div.setAttribute("class", "test");
    const prev = spread(div, null, { class: "test" });

    // Passing empty props should remove all previous props
    spread(div, prev, {});
    expect(div.hasAttribute("class")).toBe(false);
  });

  it("should handle boolean attributes", () => {
    const button = document.createElement("button");
    spread(button, null, { disabled: true });
    expect(button.hasAttribute("disabled")).toBe(true);

    const prev = spread(button, null, { disabled: true });
    spread(button, prev, { disabled: false });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("should handle style attribute", () => {
    const div = document.createElement("div");
    spread(div, null, { style: "color: red" });
    expect(div.getAttribute("style")).toBe("color: red");
  });

  it("should handle aria attributes", () => {
    const button = document.createElement("button");
    spread(button, null, {
      "aria-label": "Close button",
      "aria-pressed": "false",
    });

    expect(button.getAttribute("aria-label")).toBe("Close button");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("should no-op when element is null", () => {
    vi.stubGlobal("__DEV__", true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const next = { class: "test" };

    expect(spread(null as unknown as Element, null, next)).toBe(next);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
