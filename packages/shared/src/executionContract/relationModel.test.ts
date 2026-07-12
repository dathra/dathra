import { readFileSync } from "node:fs";

import {
  canHaveModifiers,
  createSourceFile,
  getModifiers,
  isExportAssignment,
  isExportDeclaration,
  isNamedExports,
  isStringLiteral,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  transpileModule,
  type Statement,
} from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  // @ts-expect-error AS01 owns shared-root publication.
  type FactEndpoint as _RootFactEndpointMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticRelation as _RootSemanticRelationMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticRelationKind as _RootSemanticRelationKindMustNotExist,
} from "../index";
import * as executionContractApi from "./implementation";
import {
  type FactEndpoint,
  // @ts-expect-error Individual relation aliases are not facade API.
  type FailsWithRelation as _FailsWithRelationMustNotExist,
  // @ts-expect-error Individual relation aliases are not facade API.
  type InvokesRelation as _InvokesRelationMustNotExist,
  // @ts-expect-error Internal relation helpers are not facade API.
  type NonOrderingRelationBase as _NonOrderingRelationBaseMustNotExist,
  // @ts-expect-error Internal relation helpers are not facade API.
  type NonTransferSemanticFactKind as _NonTransferKindMustNotExist,
  // @ts-expect-error Individual relation aliases are not facade API.
  type OrdersBeforeRelation as _OrdersBeforeRelationMustNotExist,
  // @ts-expect-error Individual relation aliases are not facade API.
  type OwnsRelation as _OwnsRelationMustNotExist,
  // @ts-expect-error Individual relation aliases are not facade API.
  type ReadsRelation as _ReadsRelationMustNotExist,
  // @ts-expect-error Individual relation aliases are not facade API.
  type ReturnsRelation as _ReturnsRelationMustNotExist,
  type SemanticFactKind,
  type SemanticRelation,
  type SemanticRelationKind,
  // @ts-expect-error Individual relation aliases are not facade API.
  type TransfersAsRelation as _TransfersAsRelationMustNotExist,
  // @ts-expect-error Individual relation aliases are not facade API.
  type WritesRelation as _WritesRelationMustNotExist,
  factId,
  type FactId,
} from "./implementation";
import * as relationModelApi from "./relationModel";

type ExecutionContractApi = typeof executionContractApi;

type _DefineExecutionContractMustNotExist =
  // @ts-expect-error Source construction belongs to a later SC02A review unit.
  ExecutionContractApi["defineExecutionContract"];

type _ParseExecutionContractSourceMustNotExist =
  // @ts-expect-error Source-level parsing belongs to SC02A12.
  ExecutionContractApi["parseExecutionContractSource"];

type _ValidateExecutionContractSourceMustNotExist =
  // @ts-expect-error Source validation remains internal to SC02A12.
  ExecutionContractApi["validateExecutionContractSource"];

type ExpectedSemanticRelationKind =
  | "reads"
  | "writes"
  | "invokes"
  | "returns"
  | "owns"
  | "orders-before"
  | "transfers-as"
  | "fails-with";

type ExpectedEndpoint<Kind extends SemanticFactKind> = {
  readonly factId: FactId;
  readonly factKind: Kind;
};

type ExpectedRelationBase = {
  readonly schema: "dathra.relation/1";
};

type ExpectedRelation<
  Kind extends SemanticRelationKind,
  FromKind extends SemanticFactKind,
  ToKind extends SemanticFactKind,
> = ExpectedRelationBase & {
  readonly kind: Kind;
  readonly from: ExpectedEndpoint<FromKind>;
  readonly to: ExpectedEndpoint<ToKind>;
};

type ExpectedReadsRelation = ExpectedRelation<
  "reads",
  "effect" | "invocation",
  "read"
>;
type ExpectedWritesRelation = ExpectedRelation<
  "writes",
  "effect" | "invocation",
  "write"
>;
type ExpectedInvokesRelation = ExpectedRelation<
  "invokes",
  "effect" | "invocation",
  "invocation"
>;
type ExpectedReturnsRelation = ExpectedRelation<
  "returns",
  "invocation",
  SemanticFactKind
>;
type ExpectedOwnsRelation = ExpectedRelation<
  "owns",
  "ownership",
  "identity" | "ownership" | "lifetime"
>;
type ExpectedOrdersBeforeRelation = ExpectedRelationBase & {
  readonly kind: "orders-before";
  readonly from: ExpectedEndpoint<"ordering">;
  readonly to: ExpectedEndpoint<SemanticFactKind>;
  readonly ordinal: number | null;
};
type ExpectedTransfersAsRelation = ExpectedRelation<
  "transfers-as",
  Exclude<SemanticFactKind, "transfer">,
  "transfer"
>;
type ExpectedFailsWithRelation = ExpectedRelation<
  "fails-with",
  "effect" | "invocation",
  "failure"
>;

type ExpectedSemanticRelation =
  | ExpectedReadsRelation
  | ExpectedWritesRelation
  | ExpectedInvokesRelation
  | ExpectedReturnsRelation
  | ExpectedOwnsRelation
  | ExpectedOrdersBeforeRelation
  | ExpectedTransfersAsRelation
  | ExpectedFailsWithRelation;

type RelationVariant<Kind extends SemanticRelationKind> = Extract<
  SemanticRelation,
  { readonly kind: Kind }
>;

type ExpectedEndpointMatrix = {
  reads: {
    readonly from: ExpectedEndpoint<"effect" | "invocation">;
    readonly to: ExpectedEndpoint<"read">;
  };
  writes: {
    readonly from: ExpectedEndpoint<"effect" | "invocation">;
    readonly to: ExpectedEndpoint<"write">;
  };
  invokes: {
    readonly from: ExpectedEndpoint<"effect" | "invocation">;
    readonly to: ExpectedEndpoint<"invocation">;
  };
  returns: {
    readonly from: ExpectedEndpoint<"invocation">;
    readonly to: ExpectedEndpoint<SemanticFactKind>;
  };
  owns: {
    readonly from: ExpectedEndpoint<"ownership">;
    readonly to: ExpectedEndpoint<"identity" | "ownership" | "lifetime">;
  };
  "orders-before": {
    readonly from: ExpectedEndpoint<"ordering">;
    readonly to: ExpectedEndpoint<SemanticFactKind>;
  };
  "transfers-as": {
    readonly from: ExpectedEndpoint<Exclude<SemanticFactKind, "transfer">>;
    readonly to: ExpectedEndpoint<"transfer">;
  };
  "fails-with": {
    readonly from: ExpectedEndpoint<"effect" | "invocation">;
    readonly to: ExpectedEndpoint<"failure">;
  };
};

type ActualEndpointMatrix = {
  [Kind in SemanticRelationKind]: Pick<RelationVariant<Kind>, "from" | "to">;
};

type NonOrderingRelationKind = Exclude<SemanticRelationKind, "orders-before">;
type NonOrderingOrdinalKey = {
  [Kind in NonOrderingRelationKind]: Extract<
    keyof RelationVariant<Kind>,
    "ordinal"
  >;
}[NonOrderingRelationKind];

const RELATION_KINDS = [
  "reads",
  "writes",
  "invokes",
  "returns",
  "owns",
  "orders-before",
  "transfers-as",
  "fails-with",
] as const satisfies readonly SemanticRelationKind[];

const FACT_KINDS = [
  "environment",
  "read",
  "write",
  "effect",
  "invocation",
  "identity",
  "ownership",
  "ordering",
  "failure",
  "cancellation",
  "lifetime",
  "transfer",
  "exposure",
  "integrity",
  "dependency-epoch",
  "trust-boundary",
] as const satisfies readonly SemanticFactKind[];

const NON_TRANSFER_FACT_KINDS = [
  "environment",
  "read",
  "write",
  "effect",
  "invocation",
  "identity",
  "ownership",
  "ordering",
  "failure",
  "cancellation",
  "lifetime",
  "exposure",
  "integrity",
  "dependency-epoch",
  "trust-boundary",
] as const satisfies readonly Exclude<SemanticFactKind, "transfer">[];

const LEGAL_ENDPOINT_KINDS = {
  reads: { from: ["effect", "invocation"], to: ["read"] },
  writes: { from: ["effect", "invocation"], to: ["write"] },
  invokes: { from: ["effect", "invocation"], to: ["invocation"] },
  returns: { from: ["invocation"], to: FACT_KINDS },
  owns: {
    from: ["ownership"],
    to: ["identity", "ownership", "lifetime"],
  },
  "orders-before": { from: ["ordering"], to: FACT_KINDS },
  "transfers-as": { from: NON_TRANSFER_FACT_KINDS, to: ["transfer"] },
  "fails-with": { from: ["effect", "invocation"], to: ["failure"] },
} as const satisfies {
  [Kind in SemanticRelationKind]: {
    readonly from: readonly RelationVariant<Kind>["from"]["factKind"][];
    readonly to: readonly RelationVariant<Kind>["to"]["factKind"][];
  };
};

type FixtureEndpointKindMatrix = {
  [Kind in SemanticRelationKind]: {
    readonly from: (typeof LEGAL_ENDPOINT_KINDS)[Kind]["from"][number];
    readonly to: (typeof LEGAL_ENDPOINT_KINDS)[Kind]["to"][number];
  };
};

type ActualEndpointKindMatrix = {
  [Kind in SemanticRelationKind]: {
    readonly from: RelationVariant<Kind>["from"]["factKind"];
    readonly to: RelationVariant<Kind>["to"]["factKind"];
  };
};

const FACT_IDS = {
  read: factId("read"),
  write: factId("write"),
  effect: factId("effect"),
  invocation: factId("invocation"),
  ownership: factId("ownership"),
  ordering: factId("ordering"),
  lifetime: factId("lifetime"),
  transfer: factId("transfer"),
  failure: factId("failure"),
  dependencyEpoch: factId("dependency-epoch"),
} as const;

const RELATIONS = [
  {
    schema: "dathra.relation/1",
    kind: "reads",
    from: { factId: FACT_IDS.effect, factKind: "effect" },
    to: { factId: FACT_IDS.read, factKind: "read" },
  },
  {
    schema: "dathra.relation/1",
    kind: "writes",
    from: { factId: FACT_IDS.invocation, factKind: "invocation" },
    to: { factId: FACT_IDS.write, factKind: "write" },
  },
  {
    schema: "dathra.relation/1",
    kind: "invokes",
    from: { factId: FACT_IDS.effect, factKind: "effect" },
    to: { factId: FACT_IDS.invocation, factKind: "invocation" },
  },
  {
    schema: "dathra.relation/1",
    kind: "returns",
    from: { factId: FACT_IDS.invocation, factKind: "invocation" },
    to: {
      factId: FACT_IDS.dependencyEpoch,
      factKind: "dependency-epoch",
    },
  },
  {
    schema: "dathra.relation/1",
    kind: "owns",
    from: { factId: FACT_IDS.ownership, factKind: "ownership" },
    to: { factId: FACT_IDS.lifetime, factKind: "lifetime" },
  },
  {
    schema: "dathra.relation/1",
    kind: "orders-before",
    from: { factId: FACT_IDS.ordering, factKind: "ordering" },
    to: { factId: FACT_IDS.effect, factKind: "effect" },
    ordinal: 0,
  },
  {
    schema: "dathra.relation/1",
    kind: "transfers-as",
    from: { factId: FACT_IDS.read, factKind: "read" },
    to: { factId: FACT_IDS.transfer, factKind: "transfer" },
  },
  {
    schema: "dathra.relation/1",
    kind: "fails-with",
    from: { factId: FACT_IDS.effect, factKind: "effect" },
    to: { factId: FACT_IDS.failure, factKind: "failure" },
  },
] as const satisfies readonly SemanticRelation[];

function readTypeScriptModule(relativePath: string) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const sourceFile = createSourceFile(
    relativePath,
    source,
    ScriptTarget.ES2024,
    true,
    ScriptKind.TS,
  );
  return { source, sourceFile };
}

function hasExportModifier(statement: Statement): boolean {
  return (
    canHaveModifiers(statement) &&
    (getModifiers(statement)?.some(
      (modifier) => modifier.kind === SyntaxKind.ExportKeyword,
    ) ??
      false)
  );
}

function readNamedExportSurface(relativePath: string) {
  const { sourceFile } = readTypeScriptModule(relativePath);

  return sourceFile.statements.flatMap((statement) => {
    if (!isExportDeclaration(statement)) return [];
    if (
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      throw new TypeError(`Expected named exports in ${relativePath}`);
    }

    const moduleSpecifier = statement.moduleSpecifier;
    if (moduleSpecifier !== undefined && !isStringLiteral(moduleSpecifier)) {
      throw new TypeError(
        `Expected a string module specifier in ${relativePath}`,
      );
    }

    return [
      {
        moduleSpecifier: moduleSpecifier?.text ?? null,
        typeOnly: statement.isTypeOnly,
        names: statement.exportClause.elements.map(
          (element) => element.name.text,
        ),
      },
    ];
  });
}

function emitTypeScript(source: string, fileName: string): string {
  return transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ES2024,
      verbatimModuleSyntax: true,
    },
    fileName,
  }).outputText;
}

describe("source-local semantic relation schema", () => {
  it("fixes all eight relation kinds as one closed union in both directions", () => {
    expectTypeOf<SemanticRelationKind>().toEqualTypeOf<ExpectedSemanticRelationKind>();
    expectTypeOf<ExpectedSemanticRelationKind>().toEqualTypeOf<SemanticRelationKind>();
    expectTypeOf<
      SemanticRelation["kind"]
    >().toEqualTypeOf<SemanticRelationKind>();
    expectTypeOf<
      (typeof RELATION_KINDS)[number]
    >().toEqualTypeOf<SemanticRelationKind>();

    expect(RELATIONS.map((relation) => relation.kind)).toEqual(RELATION_KINDS);
  });

  it("fixes every relation variant to its exact shape in both directions", () => {
    expectTypeOf<SemanticRelation>().toEqualTypeOf<ExpectedSemanticRelation>();
    expectTypeOf<ExpectedSemanticRelation>().toEqualTypeOf<SemanticRelation>();

    expectTypeOf<
      RelationVariant<"reads">
    >().toEqualTypeOf<ExpectedReadsRelation>();
    expectTypeOf<ExpectedReadsRelation>().toEqualTypeOf<
      RelationVariant<"reads">
    >();
    expectTypeOf<
      RelationVariant<"writes">
    >().toEqualTypeOf<ExpectedWritesRelation>();
    expectTypeOf<ExpectedWritesRelation>().toEqualTypeOf<
      RelationVariant<"writes">
    >();
    expectTypeOf<
      RelationVariant<"invokes">
    >().toEqualTypeOf<ExpectedInvokesRelation>();
    expectTypeOf<ExpectedInvokesRelation>().toEqualTypeOf<
      RelationVariant<"invokes">
    >();
    expectTypeOf<
      RelationVariant<"returns">
    >().toEqualTypeOf<ExpectedReturnsRelation>();
    expectTypeOf<ExpectedReturnsRelation>().toEqualTypeOf<
      RelationVariant<"returns">
    >();
    expectTypeOf<
      RelationVariant<"owns">
    >().toEqualTypeOf<ExpectedOwnsRelation>();
    expectTypeOf<ExpectedOwnsRelation>().toEqualTypeOf<
      RelationVariant<"owns">
    >();
    expectTypeOf<
      RelationVariant<"orders-before">
    >().toEqualTypeOf<ExpectedOrdersBeforeRelation>();
    expectTypeOf<ExpectedOrdersBeforeRelation>().toEqualTypeOf<
      RelationVariant<"orders-before">
    >();
    expectTypeOf<
      RelationVariant<"transfers-as">
    >().toEqualTypeOf<ExpectedTransfersAsRelation>();
    expectTypeOf<ExpectedTransfersAsRelation>().toEqualTypeOf<
      RelationVariant<"transfers-as">
    >();
    expectTypeOf<
      RelationVariant<"fails-with">
    >().toEqualTypeOf<ExpectedFailsWithRelation>();
    expectTypeOf<ExpectedFailsWithRelation>().toEqualTypeOf<
      RelationVariant<"fails-with">
    >();
  });

  it("fixes every endpoint tag and FactId shape in both directions", () => {
    expectTypeOf<FactEndpoint<SemanticFactKind>>().toEqualTypeOf<
      ExpectedEndpoint<SemanticFactKind>
    >();
    expectTypeOf<ExpectedEndpoint<SemanticFactKind>>().toEqualTypeOf<
      FactEndpoint<SemanticFactKind>
    >();
    expectTypeOf<ActualEndpointMatrix>().toEqualTypeOf<ExpectedEndpointMatrix>();
    expectTypeOf<ExpectedEndpointMatrix>().toEqualTypeOf<ActualEndpointMatrix>();
    expectTypeOf<FixtureEndpointKindMatrix>().toEqualTypeOf<ActualEndpointKindMatrix>();
    expectTypeOf<ActualEndpointKindMatrix>().toEqualTypeOf<FixtureEndpointKindMatrix>();
    expect(Object.keys(LEGAL_ENDPOINT_KINDS)).toEqual(RELATION_KINDS);
    expect(Object.keys(RELATIONS[0].from)).toEqual(["factId", "factKind"]);
    expect(Object.keys(RELATIONS[0].to)).toEqual(["factId", "factKind"]);
  });

  it("requires ordinal only on orders-before", () => {
    const ordered: RelationVariant<"orders-before"> = RELATIONS[5];
    const unordered = {
      ...ordered,
      ordinal: null,
    } satisfies RelationVariant<"orders-before">;

    expect(
      RELATIONS.slice(0, 5).every((relation) => !("ordinal" in relation)),
    ).toBe(true);
    expect(
      RELATIONS.slice(6).every((relation) => !("ordinal" in relation)),
    ).toBe(true);
    expect(ordered.ordinal).toBe(0);
    expect(unordered.ordinal).toBeNull();
    expectTypeOf(ordered.ordinal).toEqualTypeOf<number | null>();
    expectTypeOf<NonOrderingOrdinalKey>().toEqualTypeOf<never>();
  });
});

describe("relation model publication boundary", () => {
  it("exports exactly three relation types within the cumulative facade", () => {
    const { sourceFile } = readTypeScriptModule("./relationModel.ts");
    const { sourceFile: facadeSourceFile } = readTypeScriptModule(
      "./implementation.ts",
    );
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );

    expect(exportStatements).toHaveLength(1);
    expect(facadeSourceFile.statements).toHaveLength(6);
    expect(facadeSourceFile.statements.every(isExportDeclaration)).toBe(true);
    expect(readNamedExportSurface("./relationModel.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: true,
        names: ["SemanticRelationKind", "FactEndpoint", "SemanticRelation"],
      },
    ]);
    expect(readNamedExportSurface("./implementation.ts")).toEqual([
      {
        moduleSpecifier: "./identity",
        typeOnly: false,
        names: ["ExecutionContractError", "factId"],
      },
      {
        moduleSpecifier: "./identity",
        typeOnly: true,
        names: ["ExecutionContractErrorCode", "FactId"],
      },
      {
        moduleSpecifier: "./model",
        typeOnly: true,
        names: ["SemanticPathSegment", "SemanticSubject"],
      },
      {
        moduleSpecifier: "./factModel",
        typeOnly: true,
        names: ["SemanticFactKind", "TransferBinding", "SemanticFact"],
      },
      {
        moduleSpecifier: "./relationModel",
        typeOnly: true,
        names: ["SemanticRelationKind", "FactEndpoint", "SemanticRelation"],
      },
      {
        moduleSpecifier: "./exportModel",
        typeOnly: true,
        names: ["ExportExecutionContract"],
      },
    ]);
  });

  it("adds no runtime value or runtime import edge", () => {
    const relationModelSource =
      readTypeScriptModule("./relationModel.ts").source;
    const facadeSource = readTypeScriptModule("./implementation.ts").source;
    const consumerSource = readTypeScriptModule(
      "./relationModel.typeOnlyConsumer.fixture.ts",
    ).source;

    expect(Object.keys(relationModelApi)).toEqual([]);
    expect(Object.keys(executionContractApi).sort()).toEqual([
      "ExecutionContractError",
      "factId",
    ]);
    expect("defineExecutionContract" in executionContractApi).toBe(false);
    expect("parseExecutionContractSource" in executionContractApi).toBe(false);
    expect("validateExecutionContractSource" in executionContractApi).toBe(
      false,
    );
    expect(emitTypeScript(relationModelSource, "relationModel.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScript(facadeSource, "implementation.ts").trim()).toBe(
      'export { ExecutionContractError, factId } from "./identity";',
    );
    expect(emitTypeScript(consumerSource, "consumer.ts").trim()).toBe(
      "export {};",
    );
  });
});

// @ts-expect-error Unknown labels are rejected by the closed relation kind union.
const unknownRelationKind: SemanticRelationKind = "depends-on";
void unknownRelationKind;

const readsToWrite: RelationVariant<"reads"> = {
  ...RELATIONS[0],
  to: {
    factId: FACT_IDS.write,
    // @ts-expect-error Reads targets only read facts.
    factKind: "write",
  },
};
void readsToWrite;

const writesFromRead: RelationVariant<"writes"> = {
  ...RELATIONS[1],
  from: {
    factId: FACT_IDS.read,
    // @ts-expect-error Writes starts only from effect or invocation facts.
    factKind: "read",
  },
};
void writesFromRead;

const invokesToEffect: RelationVariant<"invokes"> = {
  ...RELATIONS[2],
  to: {
    factId: FACT_IDS.effect,
    // @ts-expect-error Invokes targets only invocation facts.
    factKind: "effect",
  },
};
void invokesToEffect;

const returnsFromEffect: RelationVariant<"returns"> = {
  ...RELATIONS[3],
  from: {
    factId: FACT_IDS.effect,
    // @ts-expect-error Returns starts only from invocation facts.
    factKind: "effect",
  },
};
void returnsFromEffect;

const ownsRead: RelationVariant<"owns"> = {
  ...RELATIONS[4],
  to: {
    factId: FACT_IDS.read,
    // @ts-expect-error Owns targets only identity, ownership, or lifetime facts.
    factKind: "read",
  },
};
void ownsRead;

const ordersFromEffect: RelationVariant<"orders-before"> = {
  ...RELATIONS[5],
  from: {
    factId: FACT_IDS.effect,
    // @ts-expect-error Orders-before starts only from ordering facts.
    factKind: "effect",
  },
};
void ordersFromEffect;

const transferFromTransfer: RelationVariant<"transfers-as"> = {
  ...RELATIONS[6],
  from: {
    factId: FACT_IDS.transfer,
    // @ts-expect-error A transfer fact cannot be a transfers-as source.
    factKind: "transfer",
  },
};
void transferFromTransfer;

const failsWithCancellation: RelationVariant<"fails-with"> = {
  ...RELATIONS[7],
  to: {
    factId: factId("cancellation"),
    // @ts-expect-error Fails-with targets only failure facts.
    factKind: "cancellation",
  },
};
void failsWithCancellation;

const readsWithRawFactId: RelationVariant<"reads"> = {
  ...RELATIONS[0],
  from: {
    // @ts-expect-error Endpoints retain a validated source-local FactId.
    factId: "effect",
    factKind: "effect",
  },
};
void readsWithRawFactId;

const readsWithSubjectCopy: RelationVariant<"reads"> = {
  ...RELATIONS[0],
  to: {
    factId: FACT_IDS.read,
    factKind: "read",
    // @ts-expect-error Endpoints do not duplicate the referenced fact subject.
    subject: { kind: "module-evaluation" },
  },
};
void readsWithSubjectCopy;

const readsWithUndefinedOrdinal: RelationVariant<"reads"> = {
  ...RELATIONS[0],
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void readsWithUndefinedOrdinal;

const writesWithUndefinedOrdinal: RelationVariant<"writes"> = {
  ...RELATIONS[1],
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void writesWithUndefinedOrdinal;

const invokesWithUndefinedOrdinal: RelationVariant<"invokes"> = {
  ...RELATIONS[2],
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void invokesWithUndefinedOrdinal;

const returnsWithUndefinedOrdinal: RelationVariant<"returns"> = {
  ...RELATIONS[3],
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void returnsWithUndefinedOrdinal;

const ownsWithUndefinedOrdinal: RelationVariant<"owns"> = {
  ...RELATIONS[4],
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void ownsWithUndefinedOrdinal;

const transfersWithUndefinedOrdinal: RelationVariant<"transfers-as"> = {
  ...RELATIONS[6],
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void transfersWithUndefinedOrdinal;

const failsWithUndefinedOrdinal: RelationVariant<"fails-with"> = {
  ...RELATIONS[7],
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void failsWithUndefinedOrdinal;

// @ts-expect-error Orders-before requires an explicit number or null ordinal.
const ordersWithoutOrdinal: RelationVariant<"orders-before"> = {
  schema: "dathra.relation/1",
  kind: "orders-before",
  from: { factId: FACT_IDS.ordering, factKind: "ordering" },
  to: { factId: FACT_IDS.effect, factKind: "effect" },
};
void ordersWithoutOrdinal;

const ordersWithStringOrdinal: RelationVariant<"orders-before"> = {
  ...RELATIONS[5],
  // @ts-expect-error An ordinal is a number or null.
  ordinal: "0",
};
void ordersWithStringOrdinal;
