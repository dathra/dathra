/**
 * Dathra counter component with reactive state.
 */

import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/reactivity";

const MyCounter = defineComponent(
  "my-counter",
  ({ props }) => {
    const count = signal(props.initial.value);

    const increment = () => {
      count.set(count.value + 1);
    };

    const decrement = () => {
      count.set(count.value - 1);
    };

    return (
      <div
        style={{
          padding: "20px",
          border: "2px solid #00dc82",
          borderRadius: "8px",
          background: "#ffffff",
        }}
      >
        <h3 style={{ margin: "0 0 15px 0" }}>Counter Component</h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <button
            onClick={decrement}
            style={{
              padding: "10px 20px",
              fontSize: "18px",
              cursor: "pointer",
              background: "#f0f0f0",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          >
            −
          </button>
          <span
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              minWidth: "50px",
              textAlign: "center",
            }}
          >
            {count.value}
          </span>
          <button
            onClick={increment}
            style={{
              padding: "10px 20px",
              fontSize: "18px",
              cursor: "pointer",
              background: "#00dc82",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            +
          </button>
        </div>
      </div>
    );
  },
  {
    props: { initial: { type: Number, default: 0 } },
    styles: [
      `
      :host {
        display: block;
        margin: 20px 0;
      }
      button:hover {
        opacity: 0.8;
      }
    `,
    ],
  },
);

export { MyCounter };
