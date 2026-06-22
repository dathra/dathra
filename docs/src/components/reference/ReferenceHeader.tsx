import { css, defineComponent } from "@dathra/components";

import { decodeReferenceData } from "../../reference/format";
import type { ReferenceDocument } from "../../reference/types";

type HeaderData = Pick<
  ReferenceDocument,
  | "audience"
  | "declarationFile"
  | "description"
  | "exportPath"
  | "importPath"
  | "level"
  | "packageName"
  | "preferredImport"
  | "title"
>;

const fallbackHeader: HeaderData = {
  audience: "Framework integrators and Dathra contributors.",
  declarationFile: "dist/index.d.mts",
  description: "",
  exportPath: "",
  importPath: "",
  level: "extension",
  packageName: "",
  title: "API Reference",
};

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
    const data = decodeReferenceData<HeaderData>(props.data.value, fallbackHeader);

    return (
      <header>
        <span class="badge">{data.level === "recommended" ? "Recommended API" : data.level}</span>
        <h1>{data.title}</h1>
        <p>{data.description}</p>
        <div class="meta">
          <div class="row">
            <span class="label">Package</span>
            <code>{data.packageName}</code>
          </div>
          <div class="row">
            <span class="label">Audience</span>
            <span>{data.audience}</span>
          </div>
          <div class="row">
            <span class="label">Exported from</span>
            <code>{data.exportPath}</code>
          </div>
          <div class="row">
            <span class="label">Import path</span>
            <code>{data.importPath}</code>
          </div>
          {data.preferredImport !== undefined ? (
            <div class="row">
              <span class="label">Preferred app import</span>
              <code>{data.preferredImport}</code>
            </div>
          ) : (
            <></>
          )}
          <div class="row">
            <span class="label">Signature source</span>
            <code>{data.declarationFile}</code>
          </div>
        </div>
      </header>
    );
  },
  {
    props: {
      data: { type: String, default: "" },
    },
    styles: [headerStyles],
  },
);

export { ReferenceHeader };
