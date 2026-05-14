import { createRoot } from "@dathra/reactivity";
import { describe, expect, it, vi } from "vitest";

import { event } from "@/index";

describe("event", () => {
  it("should call handler when event is fired", () => {
    const button = document.createElement("button");
    const handler = vi.fn();

    createRoot(() => {
      event("click", button, handler);
    });

    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should call handler multiple times for multiple events", () => {
    const button = document.createElement("button");
    const handler = vi.fn();

    createRoot(() => {
      event("click", button, handler);
    });

    button.click();
    button.click();
    button.click();
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("should remove event listener on dispose", () => {
    const button = document.createElement("button");
    const handler = vi.fn();

    const dispose = createRoot(() => {
      event("click", button, handler);
    });

    button.click();
    expect(handler).toHaveBeenCalledTimes(1);

    dispose();

    button.click();
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it("should not call handler after dispose", () => {
    const button = document.createElement("button");
    const handler = vi.fn();

    const dispose = createRoot(() => {
      event("click", button, handler);
    });

    dispose();
    button.click();
    button.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it("should pass event object to handler", () => {
    const button = document.createElement("button");
    let receivedEvent: Event | null = null;

    createRoot(() => {
      event("click", button, (e: Event) => {
        receivedEvent = e;
      });
    });

    button.click();
    expect(receivedEvent).toBeInstanceOf(MouseEvent);
  });

  it("should handle different event types", () => {
    const input = document.createElement("input");
    const focusHandler = vi.fn();
    const blurHandler = vi.fn();

    createRoot(() => {
      event("focus", input, focusHandler);
      event("blur", input, blurHandler);
    });

    input.dispatchEvent(new FocusEvent("focus"));
    expect(focusHandler).toHaveBeenCalledTimes(1);
    expect(blurHandler).not.toHaveBeenCalled();

    input.dispatchEvent(new FocusEvent("blur"));
    expect(blurHandler).toHaveBeenCalledTimes(1);
  });

  it("should support custom events", () => {
    const div = document.createElement("div");
    const handler = vi.fn();

    createRoot(() => {
      event("custom-event", div, handler);
    });

    const customEvent = new CustomEvent("custom-event", { detail: "test" });
    div.dispatchEvent(customEvent);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should receive custom event detail", () => {
    const div = document.createElement("div");
    let receivedDetail: unknown = null;

    createRoot(() => {
      event("custom-event", div, ((e: CustomEvent) => {
        receivedDetail = e.detail;
      }) as EventListener);
    });

    const customEvent = new CustomEvent("custom-event", {
      detail: { foo: "bar" },
    });
    div.dispatchEvent(customEvent);

    expect(receivedDetail).toEqual({ foo: "bar" });
  });

  it("should handle multiple events on same element", () => {
    const button = document.createElement("button");
    const clickHandler = vi.fn();
    const mousedownHandler = vi.fn();

    createRoot(() => {
      event("click", button, clickHandler);
      event("mousedown", button, mousedownHandler);
    });

    button.dispatchEvent(new MouseEvent("mousedown"));
    expect(mousedownHandler).toHaveBeenCalledTimes(1);
    expect(clickHandler).not.toHaveBeenCalled();

    button.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it("should dispose all events in root", () => {
    const button = document.createElement("button");
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const dispose = createRoot(() => {
      event("click", button, handler1);
      event("mousedown", button, handler2);
    });

    dispose();

    button.click();
    button.dispatchEvent(new MouseEvent("mousedown"));

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it("should handle keyboard events", () => {
    const input = document.createElement("input");
    const handler = vi.fn();

    createRoot(() => {
      event("keydown", input, handler);
    });

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should receive keyboard event key", () => {
    const input = document.createElement("input");
    let receivedKey: string | null = null;

    createRoot(() => {
      event("keydown", input, ((e: KeyboardEvent) => {
        receivedKey = e.key;
      }) as EventListener);
    });

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(receivedKey).toBe("Escape");
  });

  it("should register listener even outside createRoot scope", () => {
    const button = document.createElement("button");
    const handler = vi.fn();

    // Call event() outside createRoot — should still work
    event("click", button, handler);

    button.click();
    expect(handler).toHaveBeenCalledTimes(1);

    button.click();
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
