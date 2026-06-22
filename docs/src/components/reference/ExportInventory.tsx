import { css, defineComponent } from "@dathra/components";

import { decodeReferenceData } from "../../reference/format";
import type { ReferenceExportGroup } from "../../reference/types";

const inventoryStyles = css`
  :host {
    display: block;
    margin: 20px 0 32px;
  }

  .grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  section {
    padding: 20px;
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    background: var(--panel-bg);
  }

  h3 {
    margin: 0 0 12px;
    font-size: 1rem;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    color: var(--muted);
  }
`;

const ExportInventory = defineComponent(
  "dathra-export-inventory",
  ({ props }) => {
    const groups = decodeReferenceData<ReferenceExportGroup[]>(props.groups.value, []);

    return (
      <div class="grid">
        {groups.map((group) => (
          <section>
            <h3>{group.label}</h3>
            <ul>
              {group.items.map((item) => (
                <li>
                  <code>{item}</code>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  },
  {
    props: {
      groups: { type: String, default: "[]" },
    },
    styles: [inventoryStyles],
  },
);

export { ExportInventory };
