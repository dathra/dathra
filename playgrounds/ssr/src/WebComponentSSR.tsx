import { css, defineComponent } from "@dathra/components";

import { countAtom } from "./demoStore";

const counterStyles = css`
  :host {
    display: block;
    max-width: 360px;
    margin: 24px 0;
    padding: 20px;
    border: 1px solid #c9d7cf;
    border-radius: 16px;
    background: linear-gradient(180deg, #fbfdfb 0%, #eef4f0 100%);
    color: #183128;
    font-family: "Iowan Old Style", "Palatino Linotype", serif;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 1.25rem;
  }

  p {
    margin: 0 0 12px;
    line-height: 1.5;
  }

  .mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #dce9e2;
    color: #21473c;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .count {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 8px 0 16px;
  }

  .meta {
    margin: 0 0 8px;
    color: #345449;
    font-size: 0.95rem;
  }

  .slot-content {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(33, 71, 60, 0.16);
  }

  section[data-accent="mint"] .mode-badge {
    background: #d5f0e1;
    color: #0f5b3a;
  }

  section[data-accent="amber"] .mode-badge {
    background: #ffe4b8;
    color: #8c4d00;
  }

  section[data-accent="night"] .mode-badge {
    background: #203247;
    color: #dbe9f7;
  }

  button {
    border: none;
    border-radius: 999px;
    padding: 10px 16px;
    background: #21473c;
    color: #f7fbf8;
    cursor: pointer;
  }
`;

export const SSRStoreCounter = defineComponent(
  "dathra-ssr-store-counter",
  ({ props, store }) => {
    const count = store.ref(countAtom);
    const mode = typeof document === "undefined" ? "SSR" : "CSR";

    return (
      <section data-accent={props.accent.value}>
        <div class="mode-badge">{mode}</div>
        <h2>{props.headline.value}</h2>
        <p>{props.note.value}</p>
        <p class="meta">
          Mirrored count prop: <strong>{props.count.value}</strong>
        </p>
        <p class="meta">
          Accent prop: <strong>{props.accent.value}</strong>
        </p>
        <div class="count">{count.value}</div>
        <button onClick={() => count.set((value) => value + 1)}>
          Increment shared store
        </button>
        <div class="slot-content">
          <slot />
        </div>
      </section>
    );
  },
  {
    styles: [counterStyles],
    props: {
      headline: { type: String, default: "SSR Store Counter" },
      note: {
        type: String,
        default: "Server-rendered Web Component using a scoped atom store.",
      },
      count: { type: Number, default: 0 },
      accent: { type: String, default: "light" },
    },
  },
);
