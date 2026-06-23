import { css, defineComponent } from "@dathra/components";

import { DocCodeBlock } from "../DocCodeBlock";

const apiEntryStyles = css`
  :host {
    display: block;
    margin: 16px 0;
    padding: 20px;
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    background: var(--panel-bg);
  }

  h3 {
    margin: 0 0 8px;
    font-size: 1.2rem;
  }

  h4 {
    margin: 20px 0 8px;
    font-size: 1rem;
  }

  .kind {
    display: inline-flex;
    margin-bottom: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(33, 71, 60, 0.1);
    color: var(--accent);
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  ul {
    color: var(--muted);
    margin: 0 0 16px;
    padding-left: 22px;
  }
`;

const ApiEntry = defineComponent(
  "dathra-api-entry",
  ({ props }) => {
    const example = props.example.value;
    const returns = props.returns.value;

    return (
      <article>
        <span class="kind">{props.kind.value}</span>
        <h3>{props.name.value}</h3>
        <p>{props.description.value}</p>
        <DocCodeBlock language="ts">{props.signature.value}</DocCodeBlock>
        <slot />
        {returns.length > 0 ? (
          <p>
            <strong>Returns:</strong> {returns}
          </p>
        ) : (
          <></>
        )}
        {example.length > 0 ? (
          <>
            <h4>Example</h4>
            <DocCodeBlock language="ts">{example}</DocCodeBlock>
          </>
        ) : (
          <></>
        )}
      </article>
    );
  },
  {
    props: {
      description: { type: String, default: "" },
      example: { type: String, default: "" },
      kind: { type: String, default: "function" },
      name: { type: String, default: "API" },
      returns: { type: String, default: "" },
      signature: { type: String, default: "" },
    },
    styles: [apiEntryStyles],
  },
);

export { ApiEntry };
