/**
 * Dathra greeting component for Nuxt SSR.
 */

import { defineComponent } from "@dathra/components";

export const MyGreeting = defineComponent(
  "my-greeting",
  (host, ctx) => {
    const name = ctx.attrs.name?.value ?? "World";

    return (
      <div style={{
        padding: "20px",
        border: "2px solid #00dc82",
        borderRadius: "8px",
        background: "#f0fff4"
      }}>
        <h2 style={{
          margin: "0 0 10px 0",
          color: "#00dc82"
        }}>
          👋 Hello, {name}!
        </h2>
        <p style={{
          margin: "0",
          color: "#666"
        }}>
          This content was rendered with <code>Dathra</code> using Declarative Shadow DOM in Nuxt 4! 🚀
        </p>
      </div>
    );
  },
  {
    attrs: ["name"],
    styles: [`
      :host {
        display: block;
        margin: 20px 0;
      }
      code {
        background: #e0f2f1;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Courier New', monospace;
        font-size: 0.9em;
      }
    `],
  }
);
