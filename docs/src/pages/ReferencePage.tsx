import { DocCodeBlock } from "../components/DocCodeBlock";
import { ReferenceHeader } from "../components/reference";
import { referenceDocuments } from "../reference/data";
import type { ReferenceId } from "../reference/types";

function ReferencePage({ referenceId }: { referenceId: ReferenceId }) {
  const reference = referenceDocuments[referenceId];

  return (
    <section>
      <ReferenceHeader
        audience={reference.audience}
        declarationFile={reference.declarationFile}
        description={reference.description}
        exportPath={reference.exportPath}
        importPath={reference.importPath}
        level={reference.level}
        packageName={reference.packageName}
        preferredImport={reference.preferredImport ?? ""}
        title={reference.title}
      />

      <h2>Public API Inventory</h2>
      <div class="reference-inventory-grid">
        {reference.exports.map((group) => (
          <section class="reference-inventory-card">
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

      <h2>API Details</h2>
      {reference.apis.map((api) => (
        <article class="reference-api-entry">
          <span class="reference-api-kind">{api.kind}</span>
          <h3>{api.name}</h3>
          <p>{api.description}</p>
          <DocCodeBlock language="ts">{api.signature}</DocCodeBlock>
          {api.parameters !== undefined && api.parameters.length > 0 ? (
            <>
              <h4>Parameters</h4>
              <div class="reference-parameter-table-wrap">
                <table class="reference-parameter-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {api.parameters.map((parameter) => (
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
              </div>
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
              <ul class="reference-notes">
                {api.notes.map((note) => (
                  <li>{note}</li>
                ))}
              </ul>
            </>
          ) : (
            <></>
          )}
        </article>
      ))}
    </section>
  );
}

export { ReferencePage };
