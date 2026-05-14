import { adoptGlobalStyles, css, defineComponent } from "@dathra/components";

const sharedTypographySheet = css`
  :host {
    --global-card-bg: linear-gradient(180deg, #fffdf7 0%, #f5efe2 100%);
    --global-card-border: rgba(74, 54, 31, 0.16);
    --global-copy: #3d2d1d;
    font-family: "Iowan Old Style", "Palatino Linotype", serif;
    color: var(--global-copy);
  }

  article {
    padding: 18px;
    border: 1px solid var(--global-card-border);
    border-radius: 18px;
    background: var(--global-card-bg);
    box-shadow: 0 12px 30px rgba(61, 45, 29, 0.08);
  }

  h3 {
    margin: 0 0 8px;
    font-size: 1.2rem;
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    line-height: 1.6;
  }
`;

const accentSheet = css`
  article[data-tone="sage"] {
    border-color: rgba(34, 86, 59, 0.24);
  }

  article[data-tone="clay"] {
    border-color: rgba(138, 75, 39, 0.24);
  }
`;

const GlobalStyleCard = defineComponent(
  "playground-global-style-card",
  ({ props }) => {
    return (
      <article data-tone={props.tone.value}>
        <h3>{props.title.value}</h3>
        <p>{props.body.value}</p>
      </article>
    );
  },
  {
    styles: [accentSheet],
    props: {
      title: { type: String, default: "Shared typography card" },
      body: { type: String, default: "Global style active." },
      tone: { type: String, default: "sage" },
    },
  },
);

function GlobalStylesPage() {
  adoptGlobalStyles(sharedTypographySheet);

  return (
    <>
      <section>
        <h2>Shared Shadow DOM styles</h2>
        <p>
          This page calls <code>adoptGlobalStyles()</code> once and lets
          multiple custom elements pick up the same typography and card chrome
          through shared
          <code>adoptedStyleSheets</code>.
        </p>
      </section>

      <section>
        <h2>Cards using the shared global sheet</h2>
        <div class="route-grid">
          <GlobalStyleCard
            title="Editorial intro"
            body="This card gets its font, spacing, and surface treatment from the global stylesheet registry."
            tone="sage"
          />
          <GlobalStyleCard
            title="Secondary panel"
            body="The local component stylesheet only changes the tone-specific border. The rest is shared."
            tone="clay"
          />
        </div>
      </section>

      <section>
        <h2>What to verify</h2>
        <p>
          Both cards should share typography and layout even though the
          component only defines the tone-specific border locally.
        </p>
        <p>
          On SSR, the same shared CSS is emitted once into the DSD template
          before the component-local style.
        </p>
      </section>
    </>
  );
}

export { GlobalStylesPage };
