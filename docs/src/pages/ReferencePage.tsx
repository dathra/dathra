import { ApiEntry, ExportInventory, ReferenceHeader } from "../components/reference";
import { encodeReferenceData } from "../reference/format";
import { referenceDocuments } from "../reference/data";
import type { ReferenceId } from "../reference/types";

function ReferencePage({ referenceId }: { referenceId: ReferenceId }) {
  const reference = referenceDocuments[referenceId];

  return (
    <section>
      <ReferenceHeader
        data={encodeReferenceData({
          audience: reference.audience,
          declarationFile: reference.declarationFile,
          description: reference.description,
          exportPath: reference.exportPath,
          importPath: reference.importPath,
          level: reference.level,
          packageName: reference.packageName,
          preferredImport: reference.preferredImport,
          title: reference.title,
        })}
      />

      <h2>Public API Inventory</h2>
      <ExportInventory groups={encodeReferenceData(reference.exports)} />

      <h2>API Details</h2>
      {reference.apis.map((api) => (
        <ApiEntry api={encodeReferenceData(api)} />
      ))}
    </section>
  );
}

export { ReferencePage };
