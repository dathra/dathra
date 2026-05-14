import { onCleanup } from "@dathra/reactivity";

/**
 * Add an event listener to an element.
 * The listener is automatically removed when the current createRoot scope is disposed.
 *
 * @param type The event type (e.g., 'click', 'input').
 * @param element The element to attach the listener to.
 * @param handler The event handler function.
 */
function event(type: string, element: Element, handler: EventListener): void {
  element.addEventListener(type, handler);

  // Register cleanup to remove listener when root is disposed
  onCleanup(() => {
    element.removeEventListener(type, handler);
  });
}

export { event };
