/**
 * Web Components test using defineComponent
 */
import { css, defineComponent, signal } from "@dathra/core";

// Create a styled counter Web Component
const counterStyles = css`
  :host {
    display: block;
    padding: 20px;
    border: 2px solid #4a90e2;
    border-radius: 8px;
    margin: 20px 0;
  }

  .counter {
    text-align: center;
  }

  h2 {
    color: #4a90e2;
    margin-top: 0;
  }

  .count {
    font-size: 48px;
    font-weight: bold;
    color: #333;
    margin: 20px 0;
  }

  .buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  button {
    padding: 10px 20px;
    font-size: 16px;
    border: 2px solid #4a90e2;
    background: white;
    color: #4a90e2;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover {
    background: #4a90e2;
    color: white;
  }

  button:active {
    transform: scale(0.95);
  }

  .info {
    margin-top: 20px;
    padding: 10px;
    background: #f0f7ff;
    border-radius: 4px;
    font-size: 14px;
    color: #666;
  }
`;

// Define the Web Component
defineComponent(
  "dathra-counter",
  ({ initial }) => {
    const count = signal(initial.value);

    return (
      <div class="counter">
        <h2>Web Component Counter</h2>
        <div class="count">{count.value}</div>
        <div class="buttons">
          <button onClick={() => count.update((v) => v - 1)}>−</button>
          <button onClick={() => count.set(0)}>Reset</button>
          <button onClick={() => count.update((v) => v + 1)}>+</button>
        </div>
        <div class="info">
          This is a Web Component using Shadow DOM!
          <br />
          Initial value: {initial.value}
        </div>
      </div>
    );
  },
  {
    styles: [counterStyles],
    props: { initial: { type: Number, default: 0 } },
  },
);

// Create a simple greeting Web Component
const greetingStyles = css`
  :host {
    display: block;
    padding: 16px;
    border-radius: 8px;
    color: white;
    margin: 20px 0;
  }

  h3 {
    margin: 0 0 8px 0;
  }

  p {
    margin: 0;
    opacity: 0.9;
  }
`;

defineComponent(
  "dathra-greeting",
  ({ name }) => {
    return (
      <div>
        <h3>Hello, {name.value}!</h3>
        <p>This is a custom Web Component created with Dathra.</p>
      </div>
    );
  },
  {
    styles: [greetingStyles],
    props: { name: { type: String, default: "World" } },
  },
);

console.log("✅ Web Components registered: dathra-counter, dathra-greeting");
