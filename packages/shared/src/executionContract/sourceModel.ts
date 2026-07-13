import type { ExportExecutionContract } from "./exportModel";
import type { SemanticFact } from "./factModel";
import type { FactId } from "./identity";
import type { ExecutionContractRegistrySources } from "./registrySourceModel";
import type { SemanticRelation } from "./relationModel";

interface ExecutionContractSourceInput {
  readonly schema: "dathra.execution/1";
  readonly id: string;
  readonly version: string;
  readonly facts: readonly SemanticFact[];
  readonly relations: readonly SemanticRelation[];
  readonly exports: Readonly<Record<string, ExportExecutionContract>>;
  readonly registries: ExecutionContractRegistrySources;
  readonly hostAssumptionFactIds: readonly FactId[];
}

type ExecutionContractSource = ExecutionContractSourceInput;

export type { ExecutionContractSourceInput, ExecutionContractSource };
