import { css, defineComponent } from "@dathra/components";

const headerStyles = css`
  :host {
    display: block;
    margin-bottom: 28px;
  }

  .meta {
    display: grid;
    gap: 10px;
    margin-top: 24px;
    padding: 16px;
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    background: var(--panel-bg);
  }

  .row {
    display: grid;
    gap: 4px;
  }

  .label {
    color: var(--text);
    font-weight: 700;
    font-size: 0.84rem;
  }

  .badge {
    display: inline-flex;
    width: fit-content;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(33, 71, 60, 0.1);
    color: var(--accent);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
`;

const ReferenceHeader = defineComponent(
  "dathra-reference-header",
  ({ props }) => {
    const level = props.level.value;
    const preferredImport = props.preferredImport.value;

    return (
      <header>
        <span class="badge">{level === "recommended" ? "Recommended API" : level}</span>
        <h1>{props.title.value}</h1>
        <p>{props.description.value}</p>
        <div class="meta">
          <div class="row">
            <span class="label">Package</span>
            <code>{props.packageName.value}</code>
          </div>
          <div class="row">
            <span class="label">Audience</span>
            <span>{props.audience.value}</span>
          </div>
          <div class="row">
            <span class="label">Exported from</span>
            <code>{props.exportPath.value}</code>
          </div>
          <div class="row">
            <span class="label">Import path</span>
            <code>{props.importPath.value}</code>
          </div>
          {preferredImport.length > 0 ? (
            <div class="row">
              <span class="label">Preferred app import</span>
              <code>{preferredImport}</code>
            </div>
          ) : (
            <></>
          )}
          <div class="row">
            <span class="label">Signature source</span>
            <code>{props.declarationFile.value}</code>
          </div>
        </div>
      </header>
    );
  },
  {
    props: {
      audience: { type: String, default: "Framework integrators and Dathra contributors." },
      declarationFile: { type: String, default: "dist/index.d.mts" },
      description: { type: String, default: "" },
      exportPath: { type: String, default: "" },
      importPath: { type: String, default: "" },
      level: { type: String, default: "extension" },
      packageName: { type: String, default: "" },
      preferredImport: { type: String, default: "" },
      title: { type: String, default: "API Reference" },
    },
    styles: [headerStyles],
  },
);

export { ReferenceHeader };
