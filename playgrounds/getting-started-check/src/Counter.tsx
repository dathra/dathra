import { defineComponent, css } from "@dathra/components";
import { signal, computed } from "@dathra/core";

const Counter = defineComponent(
  "my-counter",
  ({ props }) => {
    const count = signal(props.initial.value);
    const doubled = computed(() => count.value * 2);

    return (
      <div>
        <p>
          Count: {count.value} | Doubled: {doubled.value}
        </p>
        <button onClick={() => count.set(count.value + 1)}>+1</button>
      </div>
    );
  },
  {
    styles: [
      css`
        :host {
          display: block;
          padding: 1rem;
          border: 1px solid #ccc;
        }
      `,
    ],
    props: {
      initial: { type: Number, default: 0 },
    },
  },
);

export { Counter };
