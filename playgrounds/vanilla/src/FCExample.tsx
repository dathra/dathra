/**
 * Example components demonstrating FC and FCWithChildren types.
 */
import { signal, type FC, type FCWithChildren } from "@dathra/core";

type RenderableChildren = Node | Node[];

/**
 * Simple greeting component without children.
 */
export const Greeting: FC<{ name: string }> = ({ name }) => {
  return <h1>Hello, {name}!</h1>;
};

/**
 * Container component with children support.
 */
export const Card: FCWithChildren<{
  title: string;
  highlighted?: boolean;
  children?: RenderableChildren;
}> = ({ title, highlighted = false, children }) => {
  return (
    <div
      class={highlighted ? "card highlighted" : "card"}
      style={{
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        margin: "10px 0",
      }}
    >
      <h2 style={{ marginTop: "0" }}>{title}</h2>
      <div class="card-content">{children}</div>
    </div>
  );
};

/**
 * Interactive component with state.
 */
export const Toggle: FCWithChildren<{
  initialOpen?: boolean;
  children?: RenderableChildren;
}> = ({ initialOpen = false, children }) => {
  const isOpen = signal(initialOpen);

  return (
    <div class="toggle">
      <button onClick={() => isOpen.set((value) => !value)}>
        {isOpen.value ? "▼" : "▶"} {isOpen.value ? "Close" : "Open"}
      </button>
      {isOpen.value && <div class="toggle-content">{children}</div>}
    </div>
  );
};

/**
 * Example usage of FC types.
 */
export const FCExample: FC = () => {
  return (
    <div>
      <Greeting name="World" />

      <Card title="Simple Card">
        <p>This is a card with children.</p>
      </Card>

      <Card title="Highlighted Card" highlighted>
        <p>This card is highlighted!</p>
      </Card>

      <Toggle initialOpen>
        <Card title="Nested Card">
          <p>You can nest components!</p>
          <Greeting name="Nested" />
        </Card>
      </Toggle>
    </div>
  );
};
