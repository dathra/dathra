import {
  ApiEntry,
  ExportGroup,
  ExportInventory,
  ExportItem,
  ReferenceHeader,
} from "../components/reference";
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
      <ExportInventory>
        {reference.exports.map((group) => (
          <ExportGroup label={group.label}>
            {group.items.map((item) => (
              <ExportItem name={item} />
            ))}
          </ExportGroup>
        ))}
      </ExportInventory>

      <h2>API Details</h2>
      {reference.apis.map((api) => (
        <ApiEntry
          description={api.description}
          example={api.example ?? ""}
          kind={api.kind}
          name={api.name}
          returns={api.returns ?? ""}
          signature={api.signature}
        >
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
        </ApiEntry>
      ))}
    </section>
  );
}

export { ReferencePage };
