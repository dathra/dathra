import { digestCanonicalJson } from "@dathra/shared";

import type { ModuleGraphSnapshotId } from "../moduleGraph/implementation";
import {
  BudgetLedger,
  resolveBudget,
  type ExecutionGraphBudget,
} from "./budget";
import {
  SNAPSHOT_RECORD_FIELDS,
  canonicalEqual,
  chargeCanonicalBytes,
  createExecutionAnalysisProfile,
  createExecutionEdge,
  createExecutionGenerationDomain,
  createExecutionLocationRequirement,
  createExecutionRootDefinition,
  createExecutionRootObligation,
  createExecutionTemplateNode,
  createIdentityRecord,
  createQualifiedExecutionNode,
  createReactiveSupportTemplate,
  createRegistrationSupportTemplate,
  createStaticExecutionOccurrenceTemplate,
  expectDigest,
  expectLiteral,
  expectRecord,
  parseDependencies,
  parseDigestSet,
  parseGraphRecordFields,
  preflightGraphRecordCardinality,
  preflightGraphSnapshotCardinality,
  snapshotClosed,
} from "./canonical";
import { createExecutionGraphIndexFromSnapshot } from "./derivation";
import {
  EXECUTION_GRAPH_DERIVATION_PROFILE,
  ExecutionGraphError,
  deepFreeze,
  fail,
  type ExecutionGraphDependencies,
  type ExecutionGraphIndex,
  type ExecutionGraphSnapshot,
  type ExecutionGraphSnapshotId,
  type ExecutionGraphSnapshotInput,
  type ExecutionGraphSnapshotPreimage,
} from "./model";
import { validateGraphRecords } from "./validation";

/** Creates a canonical immutable execution graph snapshot. */
async function createExecutionGraphSnapshot(
  input: ExecutionGraphSnapshotInput,
  dependencies: ExecutionGraphDependencies,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionGraphSnapshot> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  preflightGraphRecordCardinality(input, [], ledger);
  const value = snapshotClosed(input, [], ledger);
  const record = expectRecord(value, [], SNAPSHOT_RECORD_FIELDS);
  const parsedDependencies = await parseDependencies(dependencies, ledger);
  const records = await parseGraphRecordFields(record, [], true, ledger);
  const validated = validateGraphRecords(records, parsedDependencies, ledger);
  const preimage: ExecutionGraphSnapshotPreimage = {
    schema: "dathra.execution-graph-snapshot/1",
    moduleGraphSnapshotId: parsedDependencies.moduleGraph.id,
    observationContractIds: validated.selectedContractIds,
    ...records,
  };
  return (await createIdentityRecord(
    preimage,
    ledger,
  )) as ExecutionGraphSnapshot;
}

async function parseExecutionGraphSnapshotWithLedger(
  value: unknown,
  dependencies: ExecutionGraphDependencies,
  ledger: BudgetLedger,
): Promise<ExecutionGraphSnapshot> {
  preflightGraphSnapshotCardinality(value, ledger);
  const snapshot = snapshotClosed(value, [], ledger);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  chargeCanonicalBytes(record.preimage, ["preimage"], ledger);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail("digest-mismatch", ["id"], "Snapshot ID does not match preimage");
  }
  const preimageRecord = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "moduleGraphSnapshotId",
      "observationContractIds",
      ...SNAPSHOT_RECORD_FIELDS,
    ],
  );
  expectLiteral(preimageRecord.schema, "dathra.execution-graph-snapshot/1", [
    "preimage",
    "schema",
  ]);
  const moduleGraphSnapshotId = expectDigest(
    preimageRecord.moduleGraphSnapshotId,
    ["preimage", "moduleGraphSnapshotId"],
  ) as ModuleGraphSnapshotId;
  const observationContractIds = parseDigestSet(
    preimageRecord.observationContractIds,
    ["preimage", "observationContractIds"],
    false,
    ledger,
  );
  const parsedDependencies = await parseDependencies(dependencies, ledger);
  if (moduleGraphSnapshotId !== parsedDependencies.moduleGraph.id) {
    fail(
      "dependency-mismatch",
      ["preimage", "moduleGraphSnapshotId"],
      "Module graph dependency does not match snapshot",
    );
  }
  const records = await parseGraphRecordFields(
    preimageRecord,
    ["preimage"],
    false,
    ledger,
  );
  const validated = validateGraphRecords(records, parsedDependencies, ledger);
  if (
    observationContractIds.length !== validated.selectedContractIds.length ||
    observationContractIds.some(
      (contractId, index) =>
        contractId !== validated.selectedContractIds[index],
    )
  ) {
    fail(
      "dependency-mismatch",
      ["preimage", "observationContractIds"],
      "Selected contract set does not match graph references",
    );
  }
  const parsedPreimage: ExecutionGraphSnapshotPreimage = {
    schema: "dathra.execution-graph-snapshot/1",
    moduleGraphSnapshotId,
    observationContractIds,
    ...records,
  };
  if (!canonicalEqual(parsedPreimage, record.preimage, ledger)) {
    fail("digest-mismatch", ["preimage"], "Snapshot preimage is not canonical");
  }
  const result = {
    id: id as ExecutionGraphSnapshotId,
    preimage: parsedPreimage,
  };
  deepFreeze(result);
  return result;
}

/** Parses and strictly verifies a canonical execution graph snapshot. */
async function parseExecutionGraphSnapshot(
  value: unknown,
  dependencies: ExecutionGraphDependencies,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionGraphSnapshot> {
  return await parseExecutionGraphSnapshotWithLedger(
    value,
    dependencies,
    new BudgetLedger(resolveBudget(budget)),
  );
}

/** Creates the deterministic nonserialized execution graph index. */
async function createExecutionGraphIndex(
  value: ExecutionGraphSnapshot,
  dependencies: ExecutionGraphDependencies,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionGraphIndex> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const snapshot = await parseExecutionGraphSnapshotWithLedger(
    value,
    dependencies,
    ledger,
  );
  return createExecutionGraphIndexFromSnapshot(snapshot, ledger);
}

export {
  EXECUTION_GRAPH_DERIVATION_PROFILE,
  ExecutionGraphError,
  createExecutionAnalysisProfile,
  createExecutionEdge,
  createExecutionGenerationDomain,
  createExecutionGraphIndex,
  createExecutionGraphSnapshot,
  createExecutionLocationRequirement,
  createExecutionRootDefinition,
  createExecutionRootObligation,
  createExecutionTemplateNode,
  createQualifiedExecutionNode,
  createReactiveSupportTemplate,
  createRegistrationSupportTemplate,
  createStaticExecutionOccurrenceTemplate,
  parseExecutionGraphSnapshot,
};
export type { ExecutionGraphBudget } from "./budget";
export type {
  ExecutionAnalysisProfile,
  ExecutionAnalysisProfileId,
  ExecutionAnalysisProfileInput,
  ExecutionAnalysisProfilePreimage,
  ExecutionEdge,
  ExecutionEdgeId,
  ExecutionEdgeInput,
  ExecutionEdgeKind,
  ExecutionEdgePreimage,
  ExecutionEpochKind,
  ExecutionGenerationDomain,
  ExecutionGenerationDomainId,
  ExecutionGenerationDomainInput,
  ExecutionGenerationDomainPreimage,
  ExecutionGraphCondensationEdge,
  ExecutionGraphDependencies,
  ExecutionGraphErrorCode,
  ExecutionGraphIndex,
  ExecutionGraphPathSegment,
  ExecutionGraphSnapshot,
  ExecutionGraphSnapshotId,
  ExecutionGraphSnapshotInput,
  ExecutionGraphSnapshotPreimage,
  ExecutionGraphStronglyConnectedComponent,
  ExecutionJustificationPath,
  ExecutionLocationRequirement,
  ExecutionLocationRequirementId,
  ExecutionLocationRequirementInput,
  ExecutionLocationRequirementPreimage,
  ExecutionOccurrenceIdentitySlot,
  ExecutionOperationKind,
  ExecutionRootAdmission,
  ExecutionRootDefinition,
  ExecutionRootDefinitionId,
  ExecutionRootDefinitionInput,
  ExecutionRootDefinitionPreimage,
  ExecutionRootEntryFactKind,
  ExecutionRootKind,
  ExecutionRootObligation,
  ExecutionRootObligationId,
  ExecutionRootObligationInput,
  ExecutionRootObligationPreimage,
  ExecutionRootPhase,
  ExecutionSemanticRole,
  ExecutionSupportChain,
  ExecutionTemplateNode,
  ExecutionTemplateNodeId,
  ExecutionTemplateNodeInput,
  ExecutionTemplateNodePreimage,
  GeneratedExecutionTemplateNodeInput,
  GeneratedExecutionTemplateNodePreimage,
  GeneratedTemplateInputBinding,
  IntraRootFact,
  PotentialRootSupport,
  QualifiedExecutionBinding,
  QualifiedExecutionNode,
  QualifiedExecutionNodeId,
  QualifiedExecutionNodeInput,
  QualifiedExecutionNodePreimage,
  ReactiveSupportTemplate,
  ReactiveSupportTemplateId,
  ReactiveSupportTemplateInput,
  ReactiveSupportTemplatePreimage,
  RegistrationSupportTemplate,
  RegistrationSupportTemplateId,
  RegistrationSupportTemplateInput,
  RegistrationSupportTemplatePreimage,
  SeedReachability,
  SourceExecutionTemplateNodeInput,
  SourceExecutionTemplateNodePreimage,
  StaticExecutionOccurrenceTemplate,
  StaticExecutionOccurrenceTemplateId,
  StaticExecutionOccurrenceTemplateInput,
  StaticExecutionOccurrenceTemplatePreimage,
} from "./model";
