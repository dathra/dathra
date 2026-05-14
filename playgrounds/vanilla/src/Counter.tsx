/**
 * Dathra Counter Component - JSX Example
 *
 * This demonstrates JSX usage with automatic reactive binding.
 * {count.value} is automatically tracked via the transformer.
 */
import { computed, signal, type FC } from "@dathra/core";

export const Counter: FC = () => {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);

  const increment = () => {
    count.update((v) => v + 1);
  };

  const decrement = () => {
    count.update((v) => v - 1);
  };

  return (
    <div class="counter">
      <h1>Dathra Counter</h1>
      <p>Count: {count.value}</p>
      <p>Doubled: {doubled.value}</p>
      <div class="buttons">
        <button onClick={decrement}>-</button>
        <button onClick={increment}>+</button>
      </div>
    </div>
  );
};
