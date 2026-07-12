import type { ExportExecutionContract } from "./implementation";

type ExportSummaryConsumer = Readonly<Record<string, ExportExecutionContract>>;

export type { ExportSummaryConsumer };
