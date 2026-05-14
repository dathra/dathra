/**
 * Dathra Playground - Runtime API Demo
 *
 * This example demonstrates the runtime API directly without JSX transformation.
 * It showcases:
 * - signal/computed reactivity
 * - fromTree DOM generation
 * - templateEffect reactive updates
 * - event handling
 * - reconcile for list updates
 */
import {
  append,
  computed,
  createRoot,
  event,
  firstChild,
  fromTree,
  nextSibling,
  reconcile,
  setText,
  signal,
  templateEffect,
} from "@dathra/core";

// Create a root scope for cleanup management
createRoot(() => {
  // Reactive state
  const count = signal(0);
  const doubled = computed(() => count.value * 2);
  const items = signal<string[]>(["Apple", "Banana", "Cherry"]);

  // Build DOM from structured array
  // Structure: [tag, attrs, ...children]
  // Placeholder: ['{text}', null] for dynamic text
  const tree = fromTree(
    [
      [
        "div",
        { class: "counter" },
        ["h1", {}, "Dathra Counter (Runtime API)"],
        ["p", {}, "Count: ", ["{text}", null]],
        ["p", {}, "Doubled: ", ["{text}", null]],
        [
          "div",
          { class: "buttons" },
          ["button", { id: "dec" }, "-"],
          ["button", { id: "inc" }, "+"],
        ],
        ["h2", {}, "Items:"],
        ["ul", { id: "list" }],
        ["button", { id: "add" }, "Add Item"],
      ],
    ],
    0,
  );

  // Clone template
  const container = tree();

  // Navigate to find dynamic elements
  const div = firstChild(container);
  const h1 = firstChild(div);
  const p1 = nextSibling(h1);
  const countText = nextSibling(firstChild(p1, true));
  const p2 = nextSibling(p1);
  const doubledText = nextSibling(firstChild(p2, true));
  const buttons = nextSibling(p2);
  const decBtn = firstChild(buttons);
  const incBtn = nextSibling(decBtn);
  const h2 = nextSibling(buttons);
  const ul = nextSibling(h2);
  const addBtn = nextSibling(ul);

  // Bind reactive updates
  templateEffect(() => setText(countText as Text, String(count.value)));
  templateEffect(() => setText(doubledText as Text, String(doubled.value)));

  // Event handlers
  event("click", decBtn as HTMLElement, () => {
    count.update((v) => v - 1);
  });
  event("click", incBtn as HTMLElement, () => {
    count.update((v) => v + 1);
  });
  event("click", addBtn as HTMLElement, () => {
    items.set([...items.value, `Item ${items.value.length + 1}`]);
  });

  // List reconciliation
  templateEffect(() => {
    reconcile(
      ul as HTMLElement,
      items.value,
      (item: string) => item,
      (item: string) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      },
    );
  });

  // Mount to DOM
  append(document.getElementById("app")!, div!);

  console.log("Dathra playground (Runtime API) initialized!");
});
