import { css, defineComponent } from "@dathra/components";

import { DocCodeBlock } from "../DocCodeBlock";
import { decodeReferenceData, encodeReferenceData } from "../../reference/format";
import type { ReferenceApi } from "../../reference/types";
import { ParameterTable } from "./ParameterTable";

const fallbackApi: ReferenceApi = {
  description: "",
  kind: "function",
  name: "API",
  signature: "",
};

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
    const api = decodeReferenceData<ReferenceApi>(props.api.value, fallbackApi);

    return (
      <article>
        <span class="kind">{api.kind}</span>
        <h3>{api.name}</h3>
        <p>{api.description}</p>
        <DocCodeBlock language="ts">{api.signature}</DocCodeBlock>
        {api.parameters !== undefined && api.parameters.length > 0 ? (
          <>
            <h4>Parameters</h4>
            <ParameterTable parameters={encodeReferenceData(api.parameters)} />
          </>
        ) : (
          <></>
        )}
        {api.returns !== undefined ? (
          <p>
            <strong>Returns:</strong> {api.returns}
          </p>
        ) : (
          <></>
        )}
        {api.example !== undefined ? (
          <>
            <h4>Example</h4>
            <DocCodeBlock language="ts">{api.example}</DocCodeBlock>
          </>
        ) : (
          <></>
        )}
        {api.notes !== undefined && api.notes.length > 0 ? (
          <>
            <h4>Notes</h4>
            <ul>
              {api.notes.map((note) => (
                <li>{note}</li>
              ))}
            </ul>
          </>
        ) : (
          <></>
        )}
      </article>
    );
  },
  {
    props: {
      api: { type: String, default: "" },
    },
    styles: [apiEntryStyles],
  },
);

export { ApiEntry };
