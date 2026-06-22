import { css, defineComponent } from "@dathra/components";

import { decodeReferenceData } from "../../reference/format";
import type { ReferenceParameter } from "../../reference/types";

const tableStyles = css`
  :host {
    display: block;
    margin: 12px 0 20px;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    color: var(--muted);
    font-size: 0.92rem;
  }

  th,
  td {
    border: 1px solid var(--panel-border);
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
  }

  th {
    color: var(--text);
    background: var(--panel-bg);
    font-weight: 600;
  }
`;

const ParameterTable = defineComponent(
  "dathra-parameter-table",
  ({ props }) => {
    const parameters = decodeReferenceData<ReferenceParameter[]>(props.parameters.value, []);

    return (
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter) => (
            <tr>
              <td>
                <code>{parameter.name}</code>
              </td>
              <td>
                <code>{parameter.type}</code>
              </td>
              <td>{parameter.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  {
    props: {
      parameters: { type: String, default: "[]" },
    },
    styles: [tableStyles],
  },
);

export { ParameterTable };
