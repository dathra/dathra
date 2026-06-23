import { css, defineComponent } from "@dathra/components";

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

const ExportGroup = defineComponent(
  "dathra-export-group",
  ({ props }) => {
    return (
      <section>
        <h3>{props.label.value}</h3>
        <ul>
          <slot />
        </ul>
      </section>
    );
  },
  {
    props: {
      label: { type: String, default: "Exports" },
    },
    styles: [inventoryStyles],
  },
);

function ExportItem({ name }: { name: string }) {
  return (
    <li>
      <code>{name}</code>
    </li>
  );
}

const ExportInventory = defineComponent(
  "dathra-export-inventory",
  () => {
    return (
      <div class="grid">
        <slot />
      </div>
    );
  },
  {
    styles: [inventoryStyles],
  },
);

export { ExportGroup, ExportInventory, ExportItem };
