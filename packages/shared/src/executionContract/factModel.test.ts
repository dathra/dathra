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
  type ExecutionEnvironment,
  type RegistryId,
  registryId,
} from "../executionRegistry/implementation";
import {
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticFact as _RootSemanticFactMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticFactKind as _RootSemanticFactKindMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type TransferBinding as _RootTransferBindingMustNotExist,
} from "../index";
import * as factModelApi from "./factModel";
import {
  type FactId,
  type SemanticFact,
  type SemanticFactKind,
  type SemanticSubject,
  type TransferBinding,
  factId,
} from "./implementation";

type ExpectedSemanticFactKind =
  | "environment"
  | "read"
  | "write"
  | "effect"
  | "invocation"
  | "identity"
  | "ownership"
  | "ordering"
  | "failure"
  | "cancellation"
  | "lifetime"
  | "transfer"
  | "exposure"
  | "integrity"
  | "dependency-epoch"
  | "trust-boundary";

type ExpectedFactBase = {
  readonly schema: "dathra.fact/1";
  readonly id: FactId;
  readonly subject: SemanticSubject;
};

type ExpectedFact<Fields> = ExpectedFactBase & Fields;

type ExpectedEnvironmentFact = ExpectedFact<{
  readonly kind: "environment";
  readonly environments: readonly ExecutionEnvironment[];
  readonly hostProfileIds: readonly RegistryId<"host-profile">[];
}>;

type ExpectedReadFact = ExpectedFact<{
  readonly kind: "read";
  readonly stability: "immutable" | "stable-within-token" | "may-change";
  readonly consistency: "none" | "snapshot-token" | "linearizable-authority";
  readonly replay: {
    readonly duplicate: boolean;
    readonly reorder: boolean;
    readonly recompute: boolean;
  };
  readonly environmentFactId: FactId;
  readonly exposureFactId: FactId;
}>;

type ExpectedWriteFact = ExpectedFact<{
  readonly kind: "write";
  readonly environmentFactId: FactId;
  readonly exposureFactId: FactId;
}>;

type ExpectedEffectFact = ExpectedFact<{
  readonly kind: "effect";
  readonly retainsCallbacks: boolean;
  readonly reentrant: boolean;
  readonly schedulesWork: boolean;
  readonly allocatesResource: boolean;
}>;

type ExpectedInvocationFact = ExpectedFact<{
  readonly kind: "invocation";
  readonly callable: "call" | "construct" | "call-and-construct";
  readonly boundary: "sync" | "async";
  readonly callbackParameterIndexes: readonly number[];
  readonly retainsCallbacks: boolean;
  readonly reentrant: boolean;
  readonly receiverBrandId: RegistryId<"brand"> | null;
}>;

type ExpectedIdentityFact = ExpectedFact<{
  readonly kind: "identity";
  readonly scope: "none" | "realm" | "module" | "instance";
  readonly brandId: RegistryId<"brand"> | null;
}>;

type ExpectedOwnershipFact = ExpectedFact<{
  readonly kind: "ownership";
  readonly retention: "owned" | "leased" | "borrowed" | "environment-permanent";
}>;

type ExpectedOrderingFact = ExpectedFact<{
  readonly kind: "ordering";
  readonly relation: "before" | "serial" | "exclusive" | "commutative";
}>;

type ExpectedFailureFact = ExpectedFact<{
  readonly kind: "failure";
  readonly channel: "typed-result" | "throw" | "reject" | "abort";
  readonly schemaId: RegistryId<"failure-schema">;
}>;

type ExpectedCancellationFact = ExpectedFact<{
  readonly kind: "cancellation";
  readonly point: "before-start" | "before-commit" | "best-effort-after-commit";
  readonly propagation: "owned-descendants" | "explicit-edges";
}>;

type ExpectedLifetimeFact = ExpectedFact<{
  readonly kind: "lifetime";
  readonly domain:
    | "call"
    | "request"
    | "generation"
    | "owner"
    | "realm"
    | "process";
  readonly cleanup: "none" | "sync" | "async";
}>;

type ExpectedTransferFact = ExpectedFact<{
  readonly kind: "transfer";
  readonly binding: TransferBinding;
}>;

type ExpectedExposureFact = ExpectedFact<{
  readonly kind: "exposure";
  readonly audiencePolicyId: RegistryId<"policy">;
  readonly sinkPolicyIds: readonly RegistryId<"policy">[];
  readonly releasePolicyId: RegistryId<"policy"> | null;
}>;

type ExpectedIntegrityFact = ExpectedFact<{
  readonly kind: "integrity";
  readonly source:
    | "compiler"
    | "signed-manifest"
    | "validated-input"
    | "untrusted";
  readonly endorsementPolicyId: RegistryId<"policy"> | null;
}>;

type ExpectedDependencyEpochFact = ExpectedFact<{
  readonly kind: "dependency-epoch";
  readonly epochId: string;
  readonly invalidation: "content-addressed" | "host-supplied" | "explicit";
}>;

type ExpectedTrustBoundaryFact = ExpectedFact<{
  readonly kind: "trust-boundary";
  readonly enforcement: "worker" | "sandbox" | "compartment" | "host-process";
  readonly capabilityPolicyIds: readonly RegistryId<"policy">[];
}>;

type ExpectedSemanticFact =
  | ExpectedEnvironmentFact
  | ExpectedReadFact
  | ExpectedWriteFact
  | ExpectedEffectFact
  | ExpectedInvocationFact
  | ExpectedIdentityFact
  | ExpectedOwnershipFact
  | ExpectedOrderingFact
  | ExpectedFailureFact
  | ExpectedCancellationFact
  | ExpectedLifetimeFact
  | ExpectedTransferFact
  | ExpectedExposureFact
  | ExpectedIntegrityFact
  | ExpectedDependencyEpochFact
  | ExpectedTrustBoundaryFact;

type ExpectedTransferBinding =
  | { readonly kind: "none" }
  | { readonly kind: "snapshot" }
  | {
      readonly kind: "codec";
      readonly codecId: RegistryId<"codec">;
      readonly version: string;
    }
  | {
      readonly kind: "reference";
      readonly resolverId: RegistryId<"resolver">;
      readonly version: string;
      readonly capabilityPolicyId: RegistryId<"policy">;
    }
  | {
      readonly kind: "subscription";
      readonly sourceId: RegistryId<"subscription-source">;
      readonly version: string;
    }
  | {
      readonly kind: "remote";
      readonly operationId: RegistryId<"remote-operation">;
      readonly version: string;
    };

type FactVariant<Kind extends SemanticFactKind> = Extract<
  SemanticFact,
  { readonly kind: Kind }
>;

type TransferVariant<Kind extends TransferBinding["kind"]> = Extract<
  TransferBinding,
  { readonly kind: Kind }
>;

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

const HOST_PROFILE_ID = registryId("host-profile", "default-host");
const BRAND_ID = registryId("brand", "callable-brand");
const FAILURE_SCHEMA_ID = registryId("failure-schema", "failure");
const POLICY_ID = registryId("policy", "capability");
const CODEC_ID = registryId("codec", "json");
const RESOLVER_ID = registryId("resolver", "object-reference");
const SUBSCRIPTION_SOURCE_ID = registryId("subscription-source", "events");
const REMOTE_OPERATION_ID = registryId("remote-operation", "fetch-record");

const TRANSFER_BINDINGS = [
  { kind: "none" },
  { kind: "snapshot" },
  { kind: "codec", codecId: CODEC_ID, version: "1" },
  {
    kind: "reference",
    resolverId: RESOLVER_ID,
    version: "1",
    capabilityPolicyId: POLICY_ID,
  },
  {
    kind: "subscription",
    sourceId: SUBSCRIPTION_SOURCE_ID,
    version: "1",
  },
  { kind: "remote", operationId: REMOTE_OPERATION_ID, version: "1" },
] as const satisfies readonly TransferBinding[];

const CALLBACK_SUBJECT = {
  kind: "callback-invocation",
  exportName: "subscribe",
  parameterIndex: 0,
  path: [{ kind: "property", key: "next" }],
} as const satisfies SemanticSubject;

const ENVIRONMENT_FACT_ID = factId("environment");
const EXPOSURE_FACT_ID = factId("exposure");

const FACTS = [
  {
    schema: "dathra.fact/1",
    id: ENVIRONMENT_FACT_ID,
    subject: CALLBACK_SUBJECT,
    kind: "environment",
    environments: ["build", "server-request", "browser"],
    hostProfileIds: [HOST_PROFILE_ID],
  },
  {
    schema: "dathra.fact/1",
    id: factId("read"),
    subject: CALLBACK_SUBJECT,
    kind: "read",
    stability: "stable-within-token",
    consistency: "snapshot-token",
    replay: { duplicate: true, reorder: false, recompute: true },
    environmentFactId: ENVIRONMENT_FACT_ID,
    exposureFactId: EXPOSURE_FACT_ID,
  },
  {
    schema: "dathra.fact/1",
    id: factId("write"),
    subject: CALLBACK_SUBJECT,
    kind: "write",
    environmentFactId: ENVIRONMENT_FACT_ID,
    exposureFactId: EXPOSURE_FACT_ID,
  },
  {
    schema: "dathra.fact/1",
    id: factId("effect"),
    subject: CALLBACK_SUBJECT,
    kind: "effect",
    retainsCallbacks: true,
    reentrant: false,
    schedulesWork: true,
    allocatesResource: false,
  },
  {
    schema: "dathra.fact/1",
    id: factId("invocation"),
    subject: CALLBACK_SUBJECT,
    kind: "invocation",
    callable: "call-and-construct",
    boundary: "async",
    callbackParameterIndexes: [0, 2],
    retainsCallbacks: true,
    reentrant: false,
    receiverBrandId: BRAND_ID,
  },
  {
    schema: "dathra.fact/1",
    id: factId("identity"),
    subject: CALLBACK_SUBJECT,
    kind: "identity",
    scope: "realm",
    brandId: BRAND_ID,
  },
  {
    schema: "dathra.fact/1",
    id: factId("ownership"),
    subject: CALLBACK_SUBJECT,
    kind: "ownership",
    retention: "leased",
  },
  {
    schema: "dathra.fact/1",
    id: factId("ordering"),
    subject: CALLBACK_SUBJECT,
    kind: "ordering",
    relation: "serial",
  },
  {
    schema: "dathra.fact/1",
    id: factId("failure"),
    subject: CALLBACK_SUBJECT,
    kind: "failure",
    channel: "reject",
    schemaId: FAILURE_SCHEMA_ID,
  },
  {
    schema: "dathra.fact/1",
    id: factId("cancellation"),
    subject: CALLBACK_SUBJECT,
    kind: "cancellation",
    point: "before-commit",
    propagation: "owned-descendants",
  },
  {
    schema: "dathra.fact/1",
    id: factId("lifetime"),
    subject: CALLBACK_SUBJECT,
    kind: "lifetime",
    domain: "generation",
    cleanup: "async",
  },
  {
    schema: "dathra.fact/1",
    id: factId("transfer"),
    subject: CALLBACK_SUBJECT,
    kind: "transfer",
    binding: TRANSFER_BINDINGS[2],
  },
  {
    schema: "dathra.fact/1",
    id: EXPOSURE_FACT_ID,
    subject: CALLBACK_SUBJECT,
    kind: "exposure",
    audiencePolicyId: POLICY_ID,
    sinkPolicyIds: [POLICY_ID],
    releasePolicyId: POLICY_ID,
  },
  {
    schema: "dathra.fact/1",
    id: factId("integrity"),
    subject: CALLBACK_SUBJECT,
    kind: "integrity",
    source: "untrusted",
    endorsementPolicyId: null,
  },
  {
    schema: "dathra.fact/1",
    id: factId("dependency-epoch"),
    subject: CALLBACK_SUBJECT,
    kind: "dependency-epoch",
    epochId: "2026-07-12",
    invalidation: "content-addressed",
  },
  {
    schema: "dathra.fact/1",
    id: factId("trust-boundary"),
    subject: CALLBACK_SUBJECT,
    kind: "trust-boundary",
    enforcement: "compartment",
    capabilityPolicyIds: [POLICY_ID],
  },
] as const satisfies readonly SemanticFact[];

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

describe("source-local semantic fact schema", () => {
  it("fixes all 16 kinds as one exact closed union in both directions", () => {
    expectTypeOf<SemanticFactKind>().toEqualTypeOf<ExpectedSemanticFactKind>();
    expectTypeOf<ExpectedSemanticFactKind>().toEqualTypeOf<SemanticFactKind>();
    expectTypeOf<SemanticFact["kind"]>().toEqualTypeOf<SemanticFactKind>();
    expectTypeOf<
      (typeof FACT_KINDS)[number]
    >().toEqualTypeOf<SemanticFactKind>();

    expect(FACTS.map((fact) => fact.kind)).toEqual(FACT_KINDS);
  });

  it("fixes every fact variant to its exact keys and property types", () => {
    expectTypeOf<
      FactVariant<"environment">
    >().toEqualTypeOf<ExpectedEnvironmentFact>();
    expectTypeOf<FactVariant<"read">>().toEqualTypeOf<ExpectedReadFact>();
    expectTypeOf<FactVariant<"write">>().toEqualTypeOf<ExpectedWriteFact>();
    expectTypeOf<FactVariant<"effect">>().toEqualTypeOf<ExpectedEffectFact>();
    expectTypeOf<
      FactVariant<"invocation">
    >().toEqualTypeOf<ExpectedInvocationFact>();
    expectTypeOf<
      FactVariant<"identity">
    >().toEqualTypeOf<ExpectedIdentityFact>();
    expectTypeOf<
      FactVariant<"ownership">
    >().toEqualTypeOf<ExpectedOwnershipFact>();
    expectTypeOf<
      FactVariant<"ordering">
    >().toEqualTypeOf<ExpectedOrderingFact>();
    expectTypeOf<FactVariant<"failure">>().toEqualTypeOf<ExpectedFailureFact>();
    expectTypeOf<
      FactVariant<"cancellation">
    >().toEqualTypeOf<ExpectedCancellationFact>();
    expectTypeOf<
      FactVariant<"lifetime">
    >().toEqualTypeOf<ExpectedLifetimeFact>();
    expectTypeOf<
      FactVariant<"transfer">
    >().toEqualTypeOf<ExpectedTransferFact>();
    expectTypeOf<
      FactVariant<"exposure">
    >().toEqualTypeOf<ExpectedExposureFact>();
    expectTypeOf<
      FactVariant<"integrity">
    >().toEqualTypeOf<ExpectedIntegrityFact>();
    expectTypeOf<
      FactVariant<"dependency-epoch">
    >().toEqualTypeOf<ExpectedDependencyEpochFact>();
    expectTypeOf<
      FactVariant<"trust-boundary">
    >().toEqualTypeOf<ExpectedTrustBoundaryFact>();
    expectTypeOf<SemanticFact>().toEqualTypeOf<ExpectedSemanticFact>();
    expectTypeOf<ExpectedSemanticFact>().toEqualTypeOf<SemanticFact>();
  });

  it("reuses the source-local FactId and current semantic subject", () => {
    expectTypeOf<SemanticFact["id"]>().toEqualTypeOf<FactId>();
    expectTypeOf<SemanticFact["subject"]>().toEqualTypeOf<SemanticSubject>();
    expect(CALLBACK_SUBJECT.path).toEqual([{ kind: "property", key: "next" }]);
  });

  it("does not restore behavioral cross-fact or ordering member fields", () => {
    expectTypeOf<
      Extract<keyof FactVariant<"read">, "readEffectFactId">
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof FactVariant<"write">, "writeEffectFactId">
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<
        keyof FactVariant<"effect">,
        "readFactIds" | "writeFactIds" | "invocationFactIds"
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof FactVariant<"ownership">, "ownerFactId" | "lifetimeFactId">
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof FactVariant<"ordering">, "memberFactIds">
    >().toEqualTypeOf<never>();
  });
});

describe("source-local transfer binding schema", () => {
  it("fixes all six transfer variants to their exact fields", () => {
    expectTypeOf<TransferBinding>().toEqualTypeOf<ExpectedTransferBinding>();
    expectTypeOf<ExpectedTransferBinding>().toEqualTypeOf<TransferBinding>();
    expectTypeOf<TransferVariant<"none">>().toEqualTypeOf<{
      readonly kind: "none";
    }>();
    expectTypeOf<TransferVariant<"snapshot">>().toEqualTypeOf<{
      readonly kind: "snapshot";
    }>();
    expectTypeOf<TransferVariant<"codec">>().toEqualTypeOf<{
      readonly kind: "codec";
      readonly codecId: RegistryId<"codec">;
      readonly version: string;
    }>();
    expectTypeOf<TransferVariant<"reference">>().toEqualTypeOf<{
      readonly kind: "reference";
      readonly resolverId: RegistryId<"resolver">;
      readonly version: string;
      readonly capabilityPolicyId: RegistryId<"policy">;
    }>();
    expectTypeOf<TransferVariant<"subscription">>().toEqualTypeOf<{
      readonly kind: "subscription";
      readonly sourceId: RegistryId<"subscription-source">;
      readonly version: string;
    }>();
    expectTypeOf<TransferVariant<"remote">>().toEqualTypeOf<{
      readonly kind: "remote";
      readonly operationId: RegistryId<"remote-operation">;
      readonly version: string;
    }>();

    expect(TRANSFER_BINDINGS.map((binding) => binding.kind)).toEqual([
      "none",
      "snapshot",
      "codec",
      "reference",
      "subscription",
      "remote",
    ]);
  });

  it("keeps every registry reference in its source-local kind domain", () => {
    expectTypeOf<TransferVariant<"codec">["codecId"]>().toEqualTypeOf<
      RegistryId<"codec">
    >();
    expectTypeOf<TransferVariant<"reference">["resolverId"]>().toEqualTypeOf<
      RegistryId<"resolver">
    >();
    expectTypeOf<
      TransferVariant<"reference">["capabilityPolicyId"]
    >().toEqualTypeOf<RegistryId<"policy">>();
    expectTypeOf<TransferVariant<"subscription">["sourceId"]>().toEqualTypeOf<
      RegistryId<"subscription-source">
    >();
    expectTypeOf<TransferVariant<"remote">["operationId"]>().toEqualTypeOf<
      RegistryId<"remote-operation">
    >();
  });
});

describe("fact model publication boundary", () => {
  it("exports exactly three fact types from the model", () => {
    const { sourceFile } = readTypeScriptModule("./factModel.ts");
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );

    expect(exportStatements).toHaveLength(1);
    expect(readNamedExportSurface("./factModel.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: true,
        names: ["SemanticFactKind", "TransferBinding", "SemanticFact"],
      },
    ]);
  });

  it("adds no runtime value or runtime import edge", () => {
    const factModelSource = readTypeScriptModule("./factModel.ts").source;
    const consumerSource = `
      import type {
        SemanticFact,
        SemanticFactKind,
        TransferBinding,
      } from "./implementation";
      type FactConsumer = readonly [
        SemanticFactKind,
        TransferBinding,
        SemanticFact,
      ];
      export type { FactConsumer };
    `;

    expect(Object.keys(factModelApi)).toEqual([]);
    expect(emitTypeScript(factModelSource, "factModel.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScript(consumerSource, "consumer.ts").trim()).toBe(
      "export {};",
    );
  });
});

// @ts-expect-error Unknown labels are rejected by the closed fact kind union.
const unknownFactKind: SemanticFactKind = "relation";
void unknownFactKind;

// @ts-expect-error Registry identifiers from different kind domains are distinct.
const resolverAsCodecId: RegistryId<"codec"> = RESOLVER_ID;
void resolverAsCodecId;

// @ts-expect-error A versioned codec binding requires its version.
const codecWithoutVersion: TransferBinding = {
  kind: "codec",
  codecId: CODEC_ID,
};
void codecWithoutVersion;

const noneWithVersion: TransferBinding = {
  kind: "none",
  // @ts-expect-error Closed transfer variants reject fields from other variants.
  version: "1",
};
void noneWithVersion;

const referenceWithResolverPolicy: TransferBinding = {
  kind: "reference",
  resolverId: RESOLVER_ID,
  version: "1",
  // @ts-expect-error A capability policy must use the policy registry kind.
  capabilityPolicyId: RESOLVER_ID,
};
void referenceWithResolverPolicy;
