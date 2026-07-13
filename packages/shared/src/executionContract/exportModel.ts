import type { RegistryId } from "../executionRegistry/implementation";
import type { TransferBinding } from "./factModel";
import type { FactId } from "./identity";

/** A source-local execution summary for one module export. */
interface ExportExecutionContract {
  readonly factIds: readonly FactId[];
  readonly callable: "none" | "call" | "construct" | "call-and-construct";
  readonly receiverBrandId: RegistryId<"brand"> | null;
  readonly valueDomainId: RegistryId<"value-domain">;
  readonly transfer: TransferBinding;
}

export type { ExportExecutionContract };
