import { digestCanonicalJson, type Sha256Digest } from "@dathra/shared";
import { describe, expect, it } from "vitest";

import * as publicApi from "../index";
import {
  ModuleCoordinatorError,
  createModuleCoordinator,
  type DescribeDomainResult,
  type ExtractModuleInput,
  type ExtractModuleResult,
  type LoadModuleInput,
  type LoadModuleResult,
  type ModuleCoordinatorAdapter,
  type ModuleCoordinatorAdapterTransaction,
  type ModuleCoordinatorBuildInput,
  type ModuleCoordinatorCacheDisposition,
  type ModuleCoordinatorCommitInput,
  type ModuleCoordinatorCommitResult,
  type ModuleCoordinatorErrorCode,
  type ModuleCoordinatorObservation,
  type ModuleCoordinatorOptions,
  type ModuleCoordinatorPipelineProfile,
  type ModuleCoordinatorResolutionRequest,
  type ModuleCoordinatorStageKind,
  type ResolveModuleInput,
  type ResolveModuleResult,
  type TransformModuleInput,
  type TransformModuleResult,
} from "./implementation";

interface TestSite {
  readonly kind:
    | "static-import"
    | "dynamic-import"
    | "commonjs-require"
    | "wasm-import"
    | "css-import";
  readonly phase: "source" | "evaluation" | null;
  readonly candidates: readonly ModuleCoordinatorResolutionRequest[];
}

interface TestModule {
  readonly key: string;
  readonly definitionKey?: string;
  readonly runtimeKey?: string;
  readonly sites?: readonly TestSite[];
  readonly external?: boolean;
}

interface HarnessOptions {
  readonly cacheKindByStage?: Partial<
    Record<
      ModuleCoordinatorStageKind,
      ModuleCoordinatorCacheDisposition["kind"]
    >
  >;
  readonly commit?: (
    input: ModuleCoordinatorCommitInput,
    attempt: number,
  ) => Promise<ModuleCoordinatorCommitResult> | ModuleCoordinatorCommitResult;
  readonly failStage?: ModuleCoordinatorStageKind;
  readonly profileByAttempt?: boolean;
  readonly omitObservationKind?: {
    readonly stage: ModuleCoordinatorStageKind;
    readonly kind: "present" | "absent";
  };
  readonly resolveResultAccessor?: boolean;
  readonly resolveDelayBySubject?: Readonly<Record<string, number>>;
  readonly mutateLoadBytesDuringTransform?: boolean;
  readonly onTryCommit?: (
    input: ModuleCoordinatorCommitInput,
    attempt: number,
  ) => void;
}

interface Harness {
  readonly adapter: ModuleCoordinatorAdapter;
  readonly calls: Map<string, number>;
  readonly commits: number[];
  readonly rollbacks: number[];
  readonly replayedStages: string[];
  buildInput(...entryKeys: string[]): Promise<ModuleCoordinatorBuildInput>;
  buildInputForDomains(
    domains: readonly string[],
    entries: Readonly<Record<string, readonly string[]>>,
  ): Promise<ModuleCoordinatorBuildInput>;
  observationKey(
    stage: ModuleCoordinatorStageKind | "pipeline",
    subject: string,
    kind: "present" | "absent",
  ): string;
}

const textEncoder = new TextEncoder();

async function digest(label: string): Promise<Sha256Digest> {
  return await digestCanonicalJson({ label });
}

function nativeRequest(
  specifier: string,
  phase: "source" | "evaluation" = "evaluation",
): ModuleCoordinatorResolutionRequest {
  return {
    kind: "native",
    phase,
    specifier,
    resolutionOriginUrl: "https://example.test/root.js",
    sourceAttributes: [],
  };
}

function commonJsRequest(
  specifier: string,
): ModuleCoordinatorResolutionRequest {
  return {
    kind: "commonjs",
    specifier,
    resolutionOriginUrl: "https://example.test/root.cjs",
  };
}

function stageSubject(
  stage: ModuleCoordinatorStageKind | "pipeline",
  input:
    | ResolveModuleInput
    | LoadModuleInput
    | TransformModuleInput
    | ExtractModuleInput
    | { readonly stableDomainKey: string }
    | null,
): string {
  if (stage === "pipeline") return "build";
  if (stage === "describe-domain") {
    if (input === null || !("stableDomainKey" in input)) return "unknown";
    return input.stableDomainKey;
  }
  if (input === null) return "unknown";
  if (stage === "resolve" && "request" in input) return input.request.specifier;
  if (stage === "load" && "target" in input) {
    return new URL(input.target.moduleMapUrl).pathname.split("/").at(-1) ?? "";
  }
  if (
    (stage === "transform" || stage === "extract") &&
    "canonicalSourceUrl" in input
  ) {
    return new URL(input.canonicalSourceUrl).pathname.split("/").at(-1) ?? "";
  }
  return "unknown";
}

async function expectCoordinatorError(
  operation: Promise<unknown>,
  code: ModuleCoordinatorErrorCode,
  resource?: string,
): Promise<ModuleCoordinatorError> {
  try {
    await operation;
  } catch (error) {
    if (!(error instanceof ModuleCoordinatorError)) throw error;
    if (error.code !== code) {
      throw new Error(`Expected ${code}, received ${error.code}`);
    }
    if (resource !== undefined && error.resource !== resource) {
      throw new Error(
        `Expected resource ${resource}, received ${error.resource}`,
      );
    }
    return error;
  }

  throw new Error("Expected ModuleCoordinatorError");
}

async function createHarness(
  moduleInputs: readonly TestModule[],
  options: HarnessOptions = {},
): Promise<Harness> {
  const modules = new Map(moduleInputs.map((module) => [module.key, module]));
  const harnessConfigurationDigest = await digest(
    `harness:${[...modules.keys()].sort().join(",")}`,
  );
  const calls = new Map<string, number>();
  const commits: number[] = [];
  const rollbacks: number[] = [];
  const replayedStages: string[] = [];
  let attempt = 0;
  let returnedLoadBytes: Uint8Array | null = null;

  function count(stage: string, subject: string): void {
    const key = `${stage}:${subject}`;
    calls.set(key, (calls.get(key) ?? 0) + 1);
  }

  function observationKey(
    stage: ModuleCoordinatorStageKind | "pipeline",
    subject: string,
    kind: "present" | "absent",
  ): string {
    return `${stage}:${subject}:${kind}`;
  }

  async function observations(
    stage: ModuleCoordinatorStageKind | "pipeline",
    subject: string,
  ): Promise<readonly ModuleCoordinatorObservation[]> {
    const values: ModuleCoordinatorObservation[] = [];
    for (const kind of ["present", "absent"] as const) {
      if (
        options.omitObservationKind?.stage === stage &&
        options.omitObservationKind.kind === kind
      ) {
        continue;
      }
      values.push({
        kind,
        key: observationKey(stage, subject, kind),
        digest: await digest(`${stage}:${subject}:${kind}`),
      });
    }
    return values;
  }

  function cache(
    stage: ModuleCoordinatorStageKind,
  ): ModuleCoordinatorCacheDisposition {
    const kind = options.cacheKindByStage?.[stage] ?? "pure";
    if (kind === "replayable") {
      return { kind, replayToken: { stage } };
    }
    return { kind };
  }

  function moduleFromSpecifier(specifier: string): TestModule {
    const module = modules.get(specifier);
    if (module === undefined) {
      throw new Error(`Unknown fixture module: ${specifier}`);
    }
    return module;
  }

  function moduleFromMapUrl(moduleMapUrl: string): TestModule {
    const filename = new URL(moduleMapUrl).pathname.split("/").at(-1) ?? "";
    return moduleFromSpecifier(filename);
  }

  function moduleFromSourceUrl(sourceUrl: string): TestModule {
    const definitionKey = new URL(sourceUrl).pathname.split("/").at(-1) ?? "";
    const module = moduleInputs.find(
      (candidate) =>
        (candidate.definitionKey ?? candidate.key) === definitionKey,
    );
    if (module === undefined) {
      throw new Error(`Unknown fixture definition: ${definitionKey}`);
    }
    return module;
  }

  function maybeFail(stage: ModuleCoordinatorStageKind): void {
    if (options.failStage === stage) {
      throw new Error(`fixture ${stage} failure`);
    }
  }

  const adapter: ModuleCoordinatorAdapter = {
    async beginTransaction(): Promise<ModuleCoordinatorAdapterTransaction> {
      await Promise.all([]);
      const currentAttempt = attempt;
      attempt += 1;

      return {
        async describePipeline(input) {
          expect(Object.isFrozen(input)).toBe(true);
          count("pipeline", "build");
          const profileSuffix =
            options.profileByAttempt === true ? `:${currentAttempt}` : "";
          const profile: ModuleCoordinatorPipelineProfile = {
            aggregateAdapterProfileDigest:
              options.profileByAttempt === true
                ? await digest(`adapter${profileSuffix}`)
                : harnessConfigurationDigest,
            resolverProfileDigest: await digest(`resolver${profileSuffix}`),
            loadProfileDigest: await digest(`load${profileSuffix}`),
            transformPipelineDigest: await digest(`transform${profileSuffix}`),
            loaderSemanticsDigest: await digest(`loader${profileSuffix}`),
            importMetaSemanticsDigest: await digest(
              `import-meta${profileSuffix}`,
            ),
            extractorProfileDigest: await digest(`extractor${profileSuffix}`),
          };
          return {
            profile,
            observations: await observations("pipeline", "build"),
          };
        },

        async describeDomain(input): Promise<DescribeDomainResult> {
          maybeFail("describe-domain");
          const subject = stageSubject("describe-domain", input);
          count("describe-domain", subject);
          const profileSuffix =
            options.profileByAttempt === true ? `:${currentAttempt}` : "";
          return {
            resolverInputTranscriptDigest: await digest(
              `transcript:${subject}${profileSuffix}`,
            ),
            moduleMapSemanticsDigest: await digest(
              `module-map:${subject}${profileSuffix}`,
            ),
            esmConditions: {
              activeSet: ["browser", "import"],
              observableSequence: ["browser", "import"],
            },
            commonJsConditions: {
              activeSet: ["browser", "require"],
              observableSequence: ["browser", "require"],
            },
            observations: await observations("describe-domain", subject),
            cache: cache("describe-domain"),
          };
        },

        async resolve(input): Promise<ResolveModuleResult> {
          maybeFail("resolve");
          const subject = stageSubject("resolve", input);
          count("resolve", subject);
          const delay = options.resolveDelayBySubject?.[subject];
          if (delay !== undefined && delay > 0) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, delay);
            });
          }
          moduleFromSpecifier(input.request.specifier);
          const namespaceKind = input.request.kind;
          const result: ResolveModuleResult = {
            target: {
              namespaceKind: namespaceKind === "native" ? "native" : "commonjs",
              moduleMapUrl: `https://example.test/module-map/${subject}`,
              moduleMapType:
                namespaceKind === "native" ? "javascript-or-wasm" : "commonjs",
              effectiveAttributes:
                input.request.kind === "native"
                  ? input.request.sourceAttributes
                  : [],
              cacheKeyDigest: await digest(`cache-key:${subject}`),
              loaderContextDigest: await digest(`loader-context:${subject}`),
            },
            evidence: {
              observedConditionSequence:
                input.request.kind === "native"
                  ? input.domain.preimage.esmConditions.observableSequence
                  : input.domain.preimage.commonJsConditions.observableSequence,
              redirectEvidenceDigest: await digest(`redirect:${subject}`),
              resolverTraceDigest: await digest(`resolver-trace:${subject}`),
            },
            observations: await observations("resolve", subject),
            cache: cache("resolve"),
          };
          if (options.resolveResultAccessor !== true) return result;
          let getterExecuted = false;
          Object.defineProperty(result, "target", {
            enumerable: true,
            get() {
              getterExecuted = true;
              throw new Error("resolve target getter executed");
            },
          });
          Object.defineProperty(result, "getterExecuted", {
            enumerable: false,
            get() {
              return getterExecuted;
            },
          });
          return result;
        },

        async load(input): Promise<LoadModuleResult> {
          maybeFail("load");
          const subject = stageSubject("load", input);
          count("load", subject);
          const module = moduleFromMapUrl(input.target.moduleMapUrl);
          const definitionKey = module.definitionKey ?? module.key;
          const runtimeKey = module.runtimeKey ?? definitionKey;
          const base = {
            canonicalSourceUrl: `https://example.test/source/${definitionKey}`,
            moduleBaseUrl: `https://example.test/runtime/${definitionKey}`,
            runtimeModuleIdentityDigest: await digest(`runtime:${runtimeKey}`),
            responseMetadata: { definitionKey },
            observations: await observations("load", subject),
            cache: cache("load"),
          };
          if (module.external === true) {
            return {
              ...base,
              kind: "external",
              definitionAttestation: {
                externalDefinitionKind: "fixture-external",
                definitionSemanticsDigest: await digest(
                  `external-definition:${definitionKey}`,
                ),
                moduleSourceSemanticsDigest: await digest(
                  `external-source:${definitionKey}`,
                ),
                transitiveDependencyOwnershipDigest: await digest(
                  `external-ownership:${definitionKey}`,
                ),
                moduleBytesCorrespondenceDigest: await digest(
                  `external-bytes:${definitionKey}`,
                ),
              },
              runtimeAttestation: {
                runtimeSemanticsDigest: await digest(
                  `external-runtime:${runtimeKey}`,
                ),
                phaseCoherenceEvidenceDigest: await digest(
                  `external-phase:${runtimeKey}`,
                ),
              },
            };
          }
          const sourceBytes = textEncoder.encode(`module:${definitionKey}`);
          returnedLoadBytes = sourceBytes;
          return { ...base, kind: "content", sourceBytes };
        },

        async transform(input): Promise<TransformModuleResult> {
          maybeFail("transform");
          expect(Object.isFrozen(input.sourceBytes)).toBe(true);
          const subject = stageSubject("transform", input);
          count("transform", subject);
          if (
            options.mutateLoadBytesDuringTransform === true &&
            returnedLoadBytes !== null
          ) {
            returnedLoadBytes.fill(0);
          }
          return {
            transformedBytes: new Uint8Array(input.sourceBytes),
            definitionKind: "ecmascript-module",
            parseGoal: "module",
            transformMetadataDigest: await digest(
              `transform-metadata:${subject}`,
            ),
            observations: await observations("transform", subject),
            cache: cache("transform"),
          };
        },

        async extract(input): Promise<ExtractModuleResult> {
          maybeFail("extract");
          expect(Object.isFrozen(input.transformedBytes)).toBe(true);
          const subject = stageSubject("extract", input);
          count("extract", subject);
          const module = moduleFromSourceUrl(input.canonicalSourceUrl);
          return {
            sites: await Promise.all(
              (module.sites ?? []).map(async (site, inventoryOrdinal) => ({
                kind: site.kind,
                phase: site.phase,
                normalizedSyntaxDigest: await digest(
                  `syntax:${module.definitionKey ?? module.key}:${inventoryOrdinal}`,
                ),
                candidates: site.candidates.map((candidate) => ({
                  ...candidate,
                  resolutionOriginUrl: input.moduleBaseUrl,
                })),
                candidateCoverageProofDigest: await digest(
                  `coverage:${module.definitionKey ?? module.key}:${inventoryOrdinal}`,
                ),
              })),
            ),
            observations: await observations("extract", subject),
            cache: cache("extract"),
          };
        },

        async replayCachedStage(input) {
          await Promise.all([]);
          replayedStages.push(input.stageKey);
        },

        async tryCommit(input) {
          commits.push(currentAttempt);
          options.onTryCommit?.(input, currentAttempt);
          if (options.commit !== undefined) {
            return await options.commit(input, currentAttempt);
          }
          return {
            kind: "committed",
            transactionId: input.transactionId,
            snapshotId: input.snapshotId,
            adapterProfileDigest: input.adapterProfileDigest,
            observationSetDigest: input.observationSetDigest,
          };
        },

        async rollback() {
          await Promise.all([]);
          rollbacks.push(currentAttempt);
        },
      };
    },
  };

  async function buildInputForDomains(
    domainKeys: readonly string[],
    entryKeysByDomain: Readonly<Record<string, readonly string[]>>,
  ): Promise<ModuleCoordinatorBuildInput> {
    return {
      domains: await Promise.all(
        domainKeys.map(async (stableDomainKey) => ({
          stableDomainKey,
          domainConfigurationDigest: await digest(
            `domain-configuration:${stableDomainKey}`,
          ),
          targetEnvironmentId: `target:${stableDomainKey}`,
          nativeModuleMapNamespaceDigest: await digest(
            `native-map:${stableDomainKey}`,
          ),
          commonJsLoaderCacheNamespaceDigest: await digest(
            `commonjs-cache:${stableDomainKey}`,
          ),
        })),
      ),
      entries: (
        await Promise.all(
          domainKeys.map(
            async (stableDomainKey) =>
              await Promise.all(
                (entryKeysByDomain[stableDomainKey] ?? []).map(
                  async (entryKey, entryOrdinal) => ({
                    stableDomainKey,
                    entryOrdinal,
                    entryKind: "application",
                    entryContextDigest: await digest(
                      `entry-context:${stableDomainKey}:${entryOrdinal}`,
                    ),
                    request: nativeRequest(entryKey),
                  }),
                ),
              ),
          ),
        )
      ).flat(),
    };
  }

  return {
    adapter,
    calls,
    commits,
    rollbacks,
    replayedStages,
    async buildInput(...entryKeys) {
      return await buildInputForDomains(["web"], { web: entryKeys });
    },
    buildInputForDomains,
    observationKey,
  };
}

describe("ModuleCoordinator", () => {
  it("builds and publishes one immutable graph only after the completeness barrier", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      mutateLoadBytesDuringTransform: true,
    });
    let coordinatorSnapshotDuringCommit: unknown = "not-observed";
    const coordinator = createModuleCoordinator(
      {
        async beginTransaction(input) {
          const transaction = await harness.adapter.beginTransaction(input);
          return {
            ...transaction,
            async tryCommit(commitInput) {
              coordinatorSnapshotDuringCommit = coordinator.committedSnapshot;
              return await transaction.tryCommit(commitInput);
            },
          };
        },
      },
      { maxCacheBytes: 1_000_000 },
    );

    const result = await coordinator.build(await harness.buildInput("entry"));

    expect(coordinatorSnapshotDuringCommit).toBeNull();
    expect(result.snapshot).toBe(coordinator.committedSnapshot);
    expect(result.snapshot.preimage.entries).toHaveLength(1);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.snapshot.preimage)).toBe(true);
    expect(Object.isFrozen(coordinator.status)).toBe(true);
    expect(coordinator.status.generation).toBe(1);
  });

  it("is exported from the transformer root", () => {
    expect(publicApi.createModuleCoordinator).toBe(createModuleCoordinator);
    expect(publicApi.ModuleCoordinator).toBeDefined();
    expect(publicApi.ModuleCoordinatorError).toBe(ModuleCoordinatorError);
  });

  it("rejects malformed constructor arguments at the JavaScript boundary", async () => {
    const harness = await createHarness([{ key: "entry" }]);

    expect(() => {
      Reflect.apply(createModuleCoordinator, undefined, [null, {}]);
    }).toThrow(ModuleCoordinatorError);
    expect(() => {
      Reflect.apply(createModuleCoordinator, undefined, [
        harness.adapter,
        null,
      ]);
    }).toThrow(ModuleCoordinatorError);
  });

  it("rejects non-dense entry ordinals before opening a transaction", async () => {
    const harness = await createHarness([{ key: "entry" }]);
    const input = await harness.buildInput("entry");
    const invalid = {
      ...input,
      entries: [{ ...input.entries[0], entryOrdinal: 1 }],
    };
    const coordinator = createModuleCoordinator(harness.adapter);

    await expectCoordinatorError(
      coordinator.build(invalid),
      "invalid-input",
      "entryOrdinal",
    );
    expect(harness.calls.get("pipeline:build")).toBeUndefined();
  });

  it("rejects different stable keys that collapse to the same final domain", async () => {
    const harness = await createHarness([{ key: "first" }, { key: "second" }]);
    const input = await harness.buildInputForDomains(["one", "two"], {
      one: ["first"],
      two: ["second"],
    });
    const sharedDomainFields = input.domains[0];
    const collision = {
      domains: [
        sharedDomainFields,
        { ...sharedDomainFields, stableDomainKey: "two" },
      ],
      entries: input.entries,
    };
    const resolverInputTranscriptDigest = await digest("shared-transcript");
    const moduleMapSemanticsDigest = await digest("shared-module-map");
    const adapter: ModuleCoordinatorAdapter = {
      async beginTransaction(beginInput) {
        const transaction = await harness.adapter.beginTransaction(beginInput);
        return {
          ...transaction,
          async describeDomain(domainInput) {
            const result = await transaction.describeDomain(domainInput);
            return {
              ...result,
              resolverInputTranscriptDigest,
              moduleMapSemanticsDigest,
            };
          },
        };
      },
    };

    await expectCoordinatorError(
      createModuleCoordinator(adapter).build(collision),
      "domain-collision",
      "resolutionDomains",
    );
  });

  it("rejects accessors without executing them", async () => {
    const harness = await createHarness([{ key: "entry" }]);
    const input = await harness.buildInput("entry");
    let getterExecuted = false;
    Object.defineProperty(input, "entries", {
      enumerable: true,
      get() {
        getterExecuted = true;
        return [];
      },
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(input),
      "invalid-input",
    );
    expect(getterExecuted).toBe(false);
  });

  it("rejects build option accessors without executing them", async () => {
    const harness = await createHarness([{ key: "entry" }]);
    const input = await harness.buildInput("entry");
    let getterExecuted = false;
    const options = Object.defineProperty({}, "signal", {
      enumerable: true,
      get() {
        getterExecuted = true;
        return undefined;
      },
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(input, options),
      "invalid-input",
    );
    expect(getterExecuted).toBe(false);
  });

  it("rejects adapter result accessors without executing them", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      resolveResultAccessor: true,
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      ),
      "adapter-contract",
    );
  });

  it("closes evaluation import cycles deterministically", async () => {
    const harness = await createHarness([
      {
        key: "a",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("b")],
          },
        ],
      },
      {
        key: "b",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("a")],
          },
        ],
      },
    ]);

    const snapshot = (
      await createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("a"),
      )
    ).snapshot;

    expect(snapshot.preimage.runtimeBindings).toHaveLength(2);
    expect(snapshot.preimage.requestSites).toHaveLength(2);
    expect(harness.calls.get("resolve:a")).toBe(2);
    expect(harness.calls.get("resolve:b")).toBe(1);
  });

  it("extracts a source-only target without resolving its outgoing sites", async () => {
    const harness = await createHarness([
      {
        key: "a",
        sites: [
          {
            kind: "static-import",
            phase: "source",
            candidates: [nativeRequest("b", "source")],
          },
        ],
      },
      {
        key: "b",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("c")],
          },
        ],
      },
      { key: "c" },
    ]);

    const snapshot = (
      await createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("a"),
      )
    ).snapshot;

    expect(harness.calls.get("extract:b")).toBe(1);
    expect(harness.calls.get("resolve:c")).toBeUndefined();
    expect(snapshot.preimage.runtimeBindings).toHaveLength(2);
    expect(snapshot.preimage.requestSites).toHaveLength(1);
  });

  it("promotes merged source/evaluation aliases and enqueues sites once", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "static-import",
            phase: "source",
            candidates: [nativeRequest("source-alias", "source")],
          },
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("evaluation-alias")],
          },
        ],
      },
      {
        key: "source-alias",
        definitionKey: "shared",
        runtimeKey: "shared",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("leaf")],
          },
        ],
      },
      {
        key: "evaluation-alias",
        definitionKey: "shared",
        runtimeKey: "shared",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("leaf")],
          },
        ],
      },
      { key: "leaf" },
    ]);

    const snapshot = (
      await createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      )
    ).snapshot;

    expect(harness.calls.get("resolve:leaf")).toBe(1);
    expect(snapshot.preimage.runtimeBindings).toHaveLength(3);
    expect(
      snapshot.preimage.loaderEntries.filter(
        (entry) =>
          entry.preimage.runtimeBindingId ===
          snapshot.preimage.runtimeBindings.find((binding) =>
            binding.preimage.moduleBaseUrl.endsWith("/shared"),
          )?.id,
      ),
    ).toHaveLength(2);
  });

  it("creates external evidence from the final loader alias set", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "dynamic-import",
            phase: "evaluation",
            candidates: [
              nativeRequest("external-a"),
              nativeRequest("external-b"),
            ],
          },
        ],
      },
      {
        key: "external-a",
        definitionKey: "external-shared",
        runtimeKey: "external-shared",
        external: true,
      },
      {
        key: "external-b",
        definitionKey: "external-shared",
        runtimeKey: "external-shared",
        external: true,
      },
    ]);

    const snapshot = (
      await createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      )
    ).snapshot;
    const evidence = snapshot.preimage.externalRuntimeEvidence[0];

    expect(snapshot.preimage.externalRuntimeEvidence).toHaveLength(1);
    expect(evidence.preimage.loaderEntryIds).toHaveLength(2);
    expect([...evidence.preimage.loaderEntryIds]).toEqual(
      [...evidence.preimage.loaderEntryIds].sort(),
    );
  });

  it("produces the same snapshot for different adapter delays", async () => {
    const modules: readonly TestModule[] = [
      {
        key: "entry",
        sites: [
          {
            kind: "dynamic-import",
            phase: "evaluation",
            candidates: [nativeRequest("b"), nativeRequest("a")],
          },
        ],
      },
      { key: "a" },
      { key: "b" },
    ];
    const first = await createHarness(modules, {
      resolveDelayBySubject: { a: 2 },
    });
    const second = await createHarness([...modules].reverse(), {
      resolveDelayBySubject: { b: 2 },
    });

    const firstResult = await createModuleCoordinator(first.adapter).build(
      await first.buildInput("entry"),
    );
    const secondResult = await createModuleCoordinator(second.adapter).build(
      await second.buildInput("entry"),
    );

    expect(firstResult.snapshot.id).toBe(secondResult.snapshot.id);
  });

  it("rejects duplicate semantic candidates in one site", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "dynamic-import",
            phase: "evaluation",
            candidates: [nativeRequest("leaf"), nativeRequest("leaf")],
          },
        ],
      },
      { key: "leaf" },
    ]);

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      ),
      "duplicate-candidate",
      "candidates",
    );
  });

  it("rejects duplicate candidates extracted from a source-only target", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "static-import",
            phase: "source",
            candidates: [nativeRequest("source-only", "source")],
          },
        ],
      },
      {
        key: "source-only",
        sites: [
          {
            kind: "dynamic-import",
            phase: "evaluation",
            candidates: [nativeRequest("leaf"), nativeRequest("leaf")],
          },
        ],
      },
      { key: "leaf" },
    ]);

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      ),
      "duplicate-candidate",
      "candidates",
    );
    expect(harness.calls.get("resolve:leaf")).toBeUndefined();
  });

  it("rejects conflicting definitions merged into one runtime identity", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "dynamic-import",
            phase: "evaluation",
            candidates: [nativeRequest("left"), nativeRequest("right")],
          },
        ],
      },
      { key: "left", runtimeKey: "shared" },
      { key: "right", runtimeKey: "shared" },
    ]);

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      ),
      "runtime-conflict",
      "runtimeModuleIdentityDigest",
    );
  });

  it("reuses pure stage results across transactions", async () => {
    const harness = await createHarness([{ key: "entry" }]);
    const coordinator = createModuleCoordinator(harness.adapter);
    const input = await harness.buildInput("entry");

    await coordinator.build(input);
    const before = new Map(harness.calls);
    await coordinator.build(input);

    expect(harness.calls.get("pipeline:build")).toBe(2);
    for (const key of [
      "describe-domain:web",
      "resolve:entry",
      "load:entry",
      "transform:entry",
      "extract:entry",
    ]) {
      expect(harness.calls.get(key)).toBe(before.get(key));
    }
  });

  it("replays replayable cache hits without rerunning their stage", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      cacheKindByStage: { resolve: "replayable" },
    });
    const coordinator = createModuleCoordinator(harness.adapter);
    const input = await harness.buildInput("entry");

    await coordinator.build(input);
    await coordinator.build(input);

    expect(harness.calls.get("resolve:entry")).toBe(1);
    expect(harness.replayedStages).toHaveLength(1);
  });

  it("does not persist transaction-local stage results", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      cacheKindByStage: { resolve: "transaction-local" },
    });
    const coordinator = createModuleCoordinator(harness.adapter);
    const input = await harness.buildInput("entry");

    await coordinator.build(input);
    await coordinator.build(input);

    expect(harness.calls.get("resolve:entry")).toBe(2);
  });

  it("rejects an observation key reported with conflicting digests", async () => {
    const harness = await createHarness([{ key: "entry" }]);
    const adapter: ModuleCoordinatorAdapter = {
      async beginTransaction(input) {
        const transaction = await harness.adapter.beginTransaction(input);
        return {
          ...transaction,
          async resolve(resolveInput) {
            const result = await transaction.resolve(resolveInput);
            return {
              ...result,
              observations: [
                ...result.observations,
                {
                  ...result.observations[0],
                  digest: await digest("conflicting-observation"),
                },
              ],
            };
          },
        };
      },
    };

    await expectCoordinatorError(
      createModuleCoordinator(adapter).build(await harness.buildInput("entry")),
      "observation-conflict",
      "observations",
    );
  });

  it("requires positive and negative observations from every stage", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      omitObservationKind: { stage: "resolve", kind: "absent" },
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      ),
      "adapter-contract",
      "observations",
    );
  });

  it("invalidates a changed target and its importer while retaining unrelated cache", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("target")],
          },
        ],
      },
      { key: "target" },
      { key: "unrelated" },
    ]);
    const coordinator = createModuleCoordinator(harness.adapter);
    const input = await harness.buildInput("entry", "unrelated");
    await coordinator.build(input);
    const unrelatedCalls = harness.calls.get("load:unrelated");

    await coordinator.build(input, {
      changedObservationKeys: [
        harness.observationKey("load", "target", "present"),
      ],
    });

    expect(harness.calls.get("load:target")).toBe(2);
    expect(harness.calls.get("transform:entry")).toBe(2);
    expect(harness.calls.get("load:unrelated")).toBe(unrelatedCalls);
  });

  it("clears all persistent cache for a changed global observation", async () => {
    const harness = await createHarness([{ key: "entry" }]);
    const coordinator = createModuleCoordinator(harness.adapter);
    const input = await harness.buildInput("entry");
    await coordinator.build(input);

    await coordinator.build(input, {
      changedObservationKeys: [
        harness.observationKey("pipeline", "build", "present"),
      ],
    });

    expect(harness.calls.get("resolve:entry")).toBe(2);
    expect(harness.calls.get("extract:entry")).toBe(2);
  });

  it("discards a failed attempt and preserves the previous snapshot and cache", async () => {
    const healthy = await createHarness([{ key: "entry" }]);
    let fail = false;
    const adapter: ModuleCoordinatorAdapter = {
      async beginTransaction(input) {
        const transaction = await healthy.adapter.beginTransaction(input);
        return {
          ...transaction,
          async transform(transformInput) {
            if (fail) throw new Error("transform failed");
            return await transaction.transform(transformInput);
          },
        };
      },
    };
    const coordinator = createModuleCoordinator(adapter);
    const input = await healthy.buildInput("entry");
    const first = await coordinator.build(input);
    fail = true;

    await expect(
      coordinator.build(input, {
        changedObservationKeys: [
          healthy.observationKey("transform", "entry", "present"),
        ],
      }),
    ).rejects.toThrow("transform failed");
    expect(coordinator.committedSnapshot).toBe(first.snapshot);
    expect(coordinator.status.generation).toBe(1);

    fail = false;
    await coordinator.build(input);
    expect(healthy.calls.get("transform:entry")).toBe(2);
    expect(coordinator.status.generation).toBe(2);
  });

  it("retries invalidated commits with freshly observed profile and domain", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      profileByAttempt: true,
      commit(input, attempt) {
        if (attempt === 0) {
          return {
            kind: "invalidated",
            changedObservationKeys: [input.exactObservations[0].key],
          };
        }
        return {
          kind: "committed",
          transactionId: input.transactionId,
          snapshotId: input.snapshotId,
          adapterProfileDigest: input.adapterProfileDigest,
          observationSetDigest: input.observationSetDigest,
        };
      },
    });

    const result = await createModuleCoordinator(harness.adapter).build(
      await harness.buildInput("entry"),
    );

    expect(result.attempts).toBe(2);
    expect(harness.commits).toEqual([0, 1]);
    expect(harness.rollbacks).toEqual([0]);
    expect(
      result.snapshot.preimage.resolutionDomains[0].preimage
        .resolverInputTranscriptDigest,
    ).toBe(await digest("transcript:web:1"));
  });

  it("rolls back an abort observed before tryCommit", async () => {
    const harness = await createHarness([{ key: "entry" }]);
    const controller = new AbortController();
    controller.abort();

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
        { signal: controller.signal },
      ),
      "cancelled",
      "signal",
    );
    expect(harness.commits).toHaveLength(0);
  });

  it("publishes a committed receipt even when abort fires during tryCommit", async () => {
    const controller = new AbortController();
    const harness = await createHarness([{ key: "entry" }], {
      onTryCommit() {
        controller.abort();
      },
    });
    const coordinator = createModuleCoordinator(harness.adapter);

    const result = await coordinator.build(await harness.buildInput("entry"), {
      signal: controller.signal,
    });

    expect(result.snapshot).toBe(coordinator.committedSnapshot);
    expect(controller.signal.aborted).toBe(true);
  });

  it("cancels after an invalidated result when abort fires during tryCommit", async () => {
    const controller = new AbortController();
    const harness = await createHarness([{ key: "entry" }], {
      onTryCommit() {
        controller.abort();
      },
      commit(input) {
        return {
          kind: "invalidated",
          changedObservationKeys: [input.exactObservations[0].key],
        };
      },
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
        { signal: controller.signal },
      ),
      "cancelled",
      "signal",
    );
    expect(harness.rollbacks).toEqual([0]);
  });

  it("rejects a commit receipt that does not exactly match its request", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      commit(input) {
        return {
          kind: "committed",
          transactionId: `${input.transactionId}:wrong`,
          snapshotId: input.snapshotId,
          adapterProfileDigest: input.adapterProfileDigest,
          observationSetDigest: input.observationSetDigest,
        };
      },
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      ),
      "commit-mismatch",
      "tryCommit",
    );
  });

  it("rolls back a thrown commit and preserves the previous state", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      commit(input, attempt) {
        if (attempt === 1) throw new Error("commit failure");
        return {
          kind: "committed",
          transactionId: input.transactionId,
          snapshotId: input.snapshotId,
          adapterProfileDigest: input.adapterProfileDigest,
          observationSetDigest: input.observationSetDigest,
        };
      },
    });
    const coordinator = createModuleCoordinator(harness.adapter);
    const input = await harness.buildInput("entry");
    const first = await coordinator.build(input);

    await expect(
      coordinator.build(input, {
        changedObservationKeys: [
          harness.observationKey("load", "entry", "present"),
        ],
      }),
    ).rejects.toThrow("commit failure");
    expect(coordinator.committedSnapshot).toBe(first.snapshot);
    expect(coordinator.status.generation).toBe(1);
    expect(harness.rollbacks).toEqual([1]);
  });

  it("serializes concurrent builds in invocation order", async () => {
    const harness = await createHarness([{ key: "first" }, { key: "second" }]);
    const coordinator = createModuleCoordinator(harness.adapter);

    const first = coordinator.build(await harness.buildInput("first"));
    const second = coordinator.build(await harness.buildInput("second"));
    await Promise.all([first, second]);

    expect(harness.commits).toEqual([0, 1]);
    expect(coordinator.status.generation).toBe(2);
  });

  it("snapshots queued build input at invocation time", async () => {
    let markFirstCommitEntered: () => void = () => {};
    let releaseFirstCommit: () => void = () => {};
    const firstCommitEntered = new Promise<void>((resolve) => {
      markFirstCommitEntered = resolve;
    });
    const firstCommitRelease = new Promise<void>((resolve) => {
      releaseFirstCommit = resolve;
    });
    const harness = await createHarness(
      [{ key: "first" }, { key: "before" }, { key: "after" }],
      {
        async commit(input, attempt) {
          if (attempt === 0) {
            markFirstCommitEntered();
            await firstCommitRelease;
          }
          return {
            kind: "committed",
            transactionId: input.transactionId,
            snapshotId: input.snapshotId,
            adapterProfileDigest: input.adapterProfileDigest,
            observationSetDigest: input.observationSetDigest,
          };
        },
      },
    );
    const coordinator = createModuleCoordinator(harness.adapter);
    const first = coordinator.build(await harness.buildInput("first"));
    await firstCommitEntered;
    const secondInput = await harness.buildInput("before");
    const second = coordinator.build(secondInput);
    Object.defineProperty(secondInput.entries[0].request, "specifier", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "after",
    });
    releaseFirstCommit();

    await Promise.all([first, second]);
    expect(harness.calls.get("resolve:before")).toBe(1);
    expect(harness.calls.get("resolve:after")).toBeUndefined();
  });

  it("does not retain cache without its cross-graph invalidation lineage", async () => {
    const harness = await createHarness([
      {
        key: "a",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("b")],
          },
        ],
      },
      { key: "b" },
      { key: "c" },
    ]);
    const coordinator = createModuleCoordinator(harness.adapter);
    const graphA = await harness.buildInput("a");
    await coordinator.build(graphA);
    await coordinator.build(await harness.buildInput("c"));

    await coordinator.build(graphA, {
      changedObservationKeys: [harness.observationKey("load", "b", "present")],
    });

    expect(harness.calls.get("load:b")).toBe(2);
    expect(harness.calls.get("transform:a")).toBe(2);
  });

  it("does not call tryCommit when graph snapshot validation fails", async () => {
    const harness = await createHarness([{ key: "external", external: true }]);

    await expect(
      createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("external"),
      ),
    ).rejects.toThrow(/external/i);
    expect(harness.commits).toHaveLength(0);
  });

  it.each([
    ["maxDomains", { maxDomains: 0 }, [{ key: "entry" }], ["entry"]],
    ["maxEntries", { maxEntries: 0 }, [{ key: "entry" }], ["entry"]],
    ["maxLoaderUnits", { maxLoaderUnits: 0 }, [{ key: "entry" }], ["entry"]],
    ["maxRuntimeUnits", { maxRuntimeUnits: 0 }, [{ key: "entry" }], ["entry"]],
    [
      "maxSemanticRequests",
      { maxSemanticRequests: 0 },
      [
        {
          key: "entry",
          sites: [
            {
              kind: "static-import",
              phase: "evaluation",
              candidates: [nativeRequest("leaf")],
            },
          ],
        },
        { key: "leaf" },
      ],
      ["entry"],
    ],
    [
      "maxSites",
      { maxSites: 0 },
      [
        {
          key: "entry",
          sites: [
            {
              kind: "static-import",
              phase: "evaluation",
              candidates: [nativeRequest("leaf")],
            },
          ],
        },
        { key: "leaf" },
      ],
      ["entry"],
    ],
    [
      "maxCandidates",
      { maxCandidates: 0 },
      [
        {
          key: "entry",
          sites: [
            {
              kind: "dynamic-import",
              phase: "evaluation",
              candidates: [nativeRequest("leaf")],
            },
          ],
        },
        { key: "leaf" },
      ],
      ["entry"],
    ],
    ["maxObservations", { maxObservations: 1 }, [{ key: "entry" }], ["entry"]],
    [
      "maxFixedPointRounds",
      { maxFixedPointRounds: 0 },
      [{ key: "entry" }],
      ["entry"],
    ],
    ["maxCacheEntries", { maxCacheEntries: 0 }, [{ key: "entry" }], ["entry"]],
    ["maxCacheBytes", { maxCacheBytes: 0 }, [{ key: "entry" }], ["entry"]],
  ] as const)(
    "enforces the %s hard budget",
    async (resource, coordinatorOptions, modules, entries) => {
      const harness = await createHarness(modules);
      const coordinator = createModuleCoordinator(
        harness.adapter,
        coordinatorOptions,
      );

      await expectCoordinatorError(
        coordinator.build(await harness.buildInput(...entries)),
        "budget-exceeded",
        resource,
      );
      expect(coordinator.committedSnapshot).toBeNull();
    },
  );

  it("enforces the retry budget after an invalidated commit", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      commit(input) {
        return {
          kind: "invalidated",
          changedObservationKeys: [input.exactObservations[0].key],
        };
      },
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter, { maxRetries: 0 }).build(
        await harness.buildInput("entry"),
      ),
      "budget-exceeded",
      "maxRetries",
    );
  });

  it("counts pinned observation evidence against the cache byte budget", async () => {
    const harness = await createHarness([{ key: "entry" }], {
      cacheKindByStage: {
        "describe-domain": "transaction-local",
        resolve: "transaction-local",
        load: "transaction-local",
        transform: "transaction-local",
        extract: "transaction-local",
      },
    });

    await expectCoordinatorError(
      createModuleCoordinator(harness.adapter, {
        maxCacheEntries: 0,
        maxCacheBytes: 1,
      }).build(await harness.buildInput("entry")),
      "budget-exceeded",
      "maxCacheBytes",
    );
  });

  it("supports CommonJS requests as a distinct semantic request kind", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "commonjs-require",
            phase: null,
            candidates: [commonJsRequest("required")],
          },
        ],
      },
      { key: "required" },
    ]);

    const snapshot = (
      await createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      )
    ).snapshot;

    expect(snapshot.preimage.semanticRequests[0].preimage.kind).toBe(
      "commonjs",
    );
    expect(
      snapshot.preimage.loaderEntries.some(
        (entry) => entry.preimage.namespaceKind === "commonjs",
      ),
    ).toBe(true);
  });

  it("accepts an empty native module specifier", async () => {
    const harness = await createHarness([
      {
        key: "entry",
        sites: [
          {
            kind: "static-import",
            phase: "evaluation",
            candidates: [nativeRequest("")],
          },
        ],
      },
      { key: "" },
    ]);

    const snapshot = (
      await createModuleCoordinator(harness.adapter).build(
        await harness.buildInput("entry"),
      )
    ).snapshot;

    expect(snapshot.preimage.semanticRequests[0].preimage.specifier).toBe("");
  });
});

void ({} satisfies ModuleCoordinatorOptions);
