import type { BudgetLedger } from "./budget";
import {
  EXECUTION_GRAPH_DERIVATION_PROFILE,
  deepFreeze,
  mapById,
  type ExecutionEdge,
  type ExecutionEdgeId,
  type ExecutionGraphCondensationEdge,
  type ExecutionGraphIndex,
  type ExecutionGraphSnapshot,
  type ExecutionGraphStronglyConnectedComponent,
  type ExecutionJustificationPath,
  type ExecutionRootDefinitionId,
  type ExecutionRootEntryFactKind,
  type ExecutionRootObligation,
  type ExecutionSupportChain,
  type IntraRootFact,
  type PotentialRootSupport,
  type QualifiedExecutionNode,
  type QualifiedExecutionNodeId,
  type ReactiveSupportTemplate,
  type ReactiveSupportTemplateId,
  type RegistrationSupportTemplate,
  type RegistrationSupportTemplateId,
  type SeedReachability,
} from "./model";

const EMPTY_READONLY_ARRAY: readonly never[] = Object.freeze([]);

function compareStringSequence(
  left: readonly string[],
  right: readonly string[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return left.length - right.length;
}

function isBetterPath(
  candidate: readonly string[],
  current: readonly string[],
): boolean {
  return (
    candidate.length < current.length ||
    (candidate.length === current.length &&
      compareStringSequence(candidate, current) < 0)
  );
}

function factKey(
  rootId: ExecutionRootDefinitionId,
  factKind: ExecutionRootEntryFactKind,
  nodeId: QualifiedExecutionNodeId,
): string {
  return `${rootId}\u0000${factKind}\u0000${nodeId}`;
}

function rootNodeFactKey(
  factKind: ExecutionRootEntryFactKind,
  nodeId: QualifiedExecutionNodeId,
): string {
  return `${factKind}\u0000${nodeId}`;
}

interface MutableDerivedFact {
  readonly fact: IntraRootFact;
  path: readonly ExecutionEdgeId[];
}

interface DerivedRootClosure {
  readonly factsByKey: ReadonlyMap<string, MutableDerivedFact>;
}

function deriveRootClosure(
  rootId: ExecutionRootDefinitionId,
  obligation: ExecutionRootObligation,
  traversalBySource: ReadonlyMap<
    QualifiedExecutionNodeId,
    readonly ExecutionEdge[]
  >,
  ledger: BudgetLedger,
): DerivedRootClosure {
  const factsByKey = new Map<string, MutableDerivedFact>();
  const queue: MutableDerivedFact[] = [];
  const enqueue = (
    factKind: ExecutionRootEntryFactKind,
    nodeId: QualifiedExecutionNodeId,
    path: readonly ExecutionEdgeId[],
  ): void => {
    const key = rootNodeFactKey(factKind, nodeId);
    const existing = factsByKey.get(key);
    if (existing !== undefined && !isBetterPath(path, existing.path)) return;
    if (existing === undefined) {
      ledger.charge(
        "maximumDerivationFacts",
        1,
        ["derivation", "facts"],
        "Fact budget exceeded",
      );
      const derived = {
        fact: { rootDefinitionId: rootId, factKind, nodeId },
        path: Object.freeze([...path]),
      };
      factsByKey.set(key, derived);
      queue.push(derived);
    } else {
      existing.path = Object.freeze([...path]);
      queue.push(existing);
    }
  };

  enqueue(
    obligation.preimage.entryFactKind,
    obligation.preimage.targetNodeId,
    [],
  );
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const edges = traversalBySource.get(current.fact.nodeId) ?? [];
    for (const edge of edges) {
      ledger.charge(
        "maximumTraversalSteps",
        1,
        ["derivation", "traversal"],
        "Traversal budget exceeded",
      );
      let targetFact: ExecutionRootEntryFactKind | null = null;
      if (
        edge.preimage.kind === "may-execute" &&
        current.fact.factKind === "execute"
      ) {
        targetFact = "execute";
      } else if (edge.preimage.kind === "may-materialize") {
        targetFact = "materialize";
      }
      if (targetFact === null) continue;
      ledger.charge(
        "maximumPathSteps",
        current.path.length + 1,
        ["derivation", "paths"],
        "Path budget exceeded",
      );
      enqueue(targetFact, edge.preimage.targetNodeId, [
        ...current.path,
        edge.id,
      ]);
    }
  }
  return { factsByKey };
}

function hasRootFact(
  closure: DerivedRootClosure,
  factKind: ExecutionRootEntryFactKind,
  nodeId: QualifiedExecutionNodeId,
): boolean {
  return closure.factsByKey.has(rootNodeFactKey(factKind, nodeId));
}

interface SccResult {
  readonly components: readonly ExecutionGraphStronglyConnectedComponent[];
  readonly condensationEdges: readonly ExecutionGraphCondensationEdge[];
  readonly componentByNode: ReadonlyMap<
    QualifiedExecutionNodeId,
    ExecutionGraphStronglyConnectedComponent
  >;
}

function deriveScc(
  nodes: readonly QualifiedExecutionNode[],
  traversalEdges: readonly ExecutionEdge[],
  ledger: BudgetLedger,
): SccResult {
  const consumeStep = (amount = 1): void => {
    ledger.charge(
      "maximumSccSteps",
      amount,
      ["derivation", "scc"],
      "SCC budget exceeded",
    );
  };
  consumeStep(nodes.length);
  const nodeIds = nodes
    .map((node) => node.id)
    .sort((left, right) => {
      consumeStep();
      return left < right ? -1 : left > right ? 1 : 0;
    });
  const outgoing = new Map<
    QualifiedExecutionNodeId,
    QualifiedExecutionNodeId[]
  >();
  const incoming = new Map<
    QualifiedExecutionNodeId,
    QualifiedExecutionNodeId[]
  >();
  for (const nodeId of nodeIds) {
    consumeStep();
    outgoing.set(nodeId, []);
    incoming.set(nodeId, []);
  }
  for (const edge of traversalEdges) {
    consumeStep();
    outgoing.get(edge.preimage.sourceNodeId)?.push(edge.preimage.targetNodeId);
    incoming.get(edge.preimage.targetNodeId)?.push(edge.preimage.sourceNodeId);
  }
  for (const values of outgoing.values()) {
    consumeStep();
    values.sort((left, right) => {
      consumeStep();
      return left < right ? -1 : left > right ? 1 : 0;
    });
  }
  for (const values of incoming.values()) {
    consumeStep();
    values.sort((left, right) => {
      consumeStep();
      return left < right ? -1 : left > right ? 1 : 0;
    });
  }
  const visited = new Set<QualifiedExecutionNodeId>();
  const finishOrder: QualifiedExecutionNodeId[] = [];
  for (const start of nodeIds) {
    if (visited.has(start)) continue;
    visited.add(start);
    const stack: {
      readonly nodeId: QualifiedExecutionNodeId;
      readonly expanded: boolean;
    }[] = [{ nodeId: start, expanded: false }];
    while (stack.length > 0) {
      consumeStep();
      const frame = stack.pop();
      if (frame === undefined) break;
      if (frame.expanded) {
        finishOrder.push(frame.nodeId);
        continue;
      }
      stack.push({ nodeId: frame.nodeId, expanded: true });
      const targets = outgoing.get(frame.nodeId) ?? [];
      for (let index = targets.length - 1; index >= 0; index -= 1) {
        consumeStep();
        const target = targets[index];
        if (!visited.has(target)) {
          visited.add(target);
          stack.push({ nodeId: target, expanded: false });
        }
      }
    }
  }

  const assigned = new Set<QualifiedExecutionNodeId>();
  const components: ExecutionGraphStronglyConnectedComponent[] = [];
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index];
    if (assigned.has(start)) continue;
    assigned.add(start);
    const members: QualifiedExecutionNodeId[] = [];
    const stack = [start];
    while (stack.length > 0) {
      consumeStep();
      const nodeId = stack.pop();
      if (nodeId === undefined) break;
      members.push(nodeId);
      const sources = incoming.get(nodeId) ?? [];
      for (
        let sourceIndex = sources.length - 1;
        sourceIndex >= 0;
        sourceIndex -= 1
      ) {
        consumeStep();
        const source = sources[sourceIndex];
        if (!assigned.has(source)) {
          assigned.add(source);
          stack.push(source);
        }
      }
    }
    members.sort((left, right) => {
      consumeStep();
      return left < right ? -1 : left > right ? 1 : 0;
    });
    consumeStep();
    components.push({ id: members[0], nodeIds: Object.freeze(members) });
  }
  components.sort((left, right) => {
    consumeStep();
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  const componentByNode = new Map<
    QualifiedExecutionNodeId,
    ExecutionGraphStronglyConnectedComponent
  >();
  for (const component of components) {
    consumeStep();
    deepFreeze(component);
    for (const nodeId of component.nodeIds) {
      consumeStep();
      componentByNode.set(nodeId, component);
    }
  }
  const condensationKeys = new Set<string>();
  const condensationEdges: ExecutionGraphCondensationEdge[] = [];
  for (const edge of traversalEdges) {
    consumeStep();
    const source = componentByNode.get(edge.preimage.sourceNodeId);
    const target = componentByNode.get(edge.preimage.targetNodeId);
    if (
      source === undefined ||
      target === undefined ||
      source.id === target.id
    ) {
      continue;
    }
    const key = `${source.id}\u0000${target.id}`;
    if (condensationKeys.has(key)) continue;
    condensationKeys.add(key);
    condensationEdges.push({
      sourceComponentId: source.id,
      targetComponentId: target.id,
    });
  }
  condensationEdges.sort((left, right) => {
    consumeStep();
    return left.sourceComponentId < right.sourceComponentId
      ? -1
      : left.sourceComponentId > right.sourceComponentId
        ? 1
        : left.targetComponentId < right.targetComponentId
          ? -1
          : left.targetComponentId > right.targetComponentId
            ? 1
            : 0;
  });
  deepFreeze(components);
  deepFreeze(condensationEdges);
  return { components, condensationEdges, componentByNode };
}

interface DerivedIndexData {
  readonly facts: readonly IntraRootFact[];
  readonly supports: readonly PotentialRootSupport[];
  readonly reachability: readonly SeedReachability[];
  readonly pathsByFactKey: ReadonlyMap<string, ExecutionJustificationPath>;
  readonly supportChainsByKey: ReadonlyMap<string, ExecutionSupportChain>;
}

function deriveIndexData(
  snapshot: ExecutionGraphSnapshot,
  ledger: BudgetLedger,
): DerivedIndexData {
  const chargeIndex = (amount = 1): void => {
    ledger.charge(
      "maximumIndexSteps",
      amount,
      ["derivation", "index"],
      "Index budget exceeded",
    );
  };
  chargeIndex(snapshot.preimage.rootObligations.length);
  const obligationsByRoot = new Map<
    ExecutionRootDefinitionId,
    ExecutionRootObligation
  >();
  for (const obligation of snapshot.preimage.rootObligations) {
    obligationsByRoot.set(obligation.preimage.rootDefinitionId, obligation);
  }
  chargeIndex(snapshot.preimage.edges.length);
  const traversalEdges: ExecutionEdge[] = [];
  for (const edge of snapshot.preimage.edges) {
    if (
      edge.preimage.kind === "may-execute" ||
      edge.preimage.kind === "may-materialize"
    ) {
      traversalEdges.push(edge);
    }
  }
  const traversalBySource = new Map<
    QualifiedExecutionNodeId,
    ExecutionEdge[]
  >();
  for (const edge of traversalEdges) {
    chargeIndex();
    const values = traversalBySource.get(edge.preimage.sourceNodeId) ?? [];
    values.push(edge);
    traversalBySource.set(edge.preimage.sourceNodeId, values);
  }
  for (const values of traversalBySource.values()) {
    chargeIndex();
    values.sort((left, right) => {
      chargeIndex();
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  }
  const registrationByNode = new Map<
    QualifiedExecutionNodeId,
    RegistrationSupportTemplate[]
  >();
  for (const support of snapshot.preimage.registrationSupports) {
    chargeIndex();
    const values =
      registrationByNode.get(support.preimage.registrationNodeId) ?? [];
    values.push(support);
    registrationByNode.set(support.preimage.registrationNodeId, values);
  }
  const reactiveByCollector = new Map<
    QualifiedExecutionNodeId,
    ReactiveSupportTemplate[]
  >();
  for (const support of snapshot.preimage.reactiveSupports) {
    chargeIndex();
    const values =
      reactiveByCollector.get(support.preimage.collectorNodeId) ?? [];
    values.push(support);
    reactiveByCollector.set(support.preimage.collectorNodeId, values);
  }
  const roots = snapshot.preimage.rootDefinitions;
  const activeRoots = new Set<ExecutionRootDefinitionId>();
  const rootQueue: ExecutionRootDefinitionId[] = [];
  for (const root of roots) {
    chargeIndex();
    if (root.preimage.admission === "seed") {
      activeRoots.add(root.id);
      rootQueue.push(root.id);
    }
  }
  rootQueue.sort((left, right) => {
    chargeIndex();
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const closures = new Map<ExecutionRootDefinitionId, DerivedRootClosure>();
  const supportsByKey = new Map<string, PotentialRootSupport>();

  for (let cursor = 0; cursor < rootQueue.length; cursor += 1) {
    chargeIndex();
    const rootId = rootQueue[cursor];
    const obligation = obligationsByRoot.get(rootId);
    if (obligation === undefined) {
      throw new Error("Validated root has no obligation");
    }
    const closure = deriveRootClosure(
      rootId,
      obligation,
      traversalBySource,
      ledger,
    );
    closures.set(rootId, closure);
    const addSupport = (
      childRootId: ExecutionRootDefinitionId,
      supportTemplateId:
        | RegistrationSupportTemplateId
        | ReactiveSupportTemplateId,
    ): void => {
      const key = `${rootId}\u0000${childRootId}\u0000${supportTemplateId}`;
      if (supportsByKey.has(key)) return;
      ledger.charge(
        "maximumDerivedSupports",
        1,
        ["derivation", "supports"],
        "Derived support budget exceeded",
      );
      chargeIndex();
      supportsByKey.set(key, {
        parentRootDefinitionId: rootId,
        contingentRootDefinitionId: childRootId,
        supportTemplateId,
      });
      if (!activeRoots.has(childRootId)) {
        activeRoots.add(childRootId);
        rootQueue.push(childRootId);
      }
    };
    for (const derived of closure.factsByKey.values()) {
      chargeIndex();
      if (derived.fact.factKind === "materialize") {
        for (const support of registrationByNode.get(derived.fact.nodeId) ??
          []) {
          ledger.charge(
            "maximumSupportChecks",
            1,
            ["derivation", "supportChecks"],
            "Support-check budget exceeded",
          );
          addSupport(support.preimage.contingentRootDefinitionId, support.id);
        }
      }
      if (derived.fact.factKind === "execute") {
        for (const support of reactiveByCollector.get(derived.fact.nodeId) ??
          []) {
          ledger.charge(
            "maximumSupportChecks",
            1,
            ["derivation", "supportChecks"],
            "Support-check budget exceeded",
          );
          if (
            hasRootFact(closure, "execute", support.preimage.readNodeId) &&
            hasRootFact(closure, "materialize", support.preimage.bindingNodeId)
          ) {
            addSupport(support.preimage.contingentRootDefinitionId, support.id);
          }
        }
      }
    }
  }

  const derivedFacts: IntraRootFact[] = [];
  const pathsByFactKey = new Map<string, ExecutionJustificationPath>();
  for (const [rootId, closure] of closures) {
    chargeIndex();
    for (const derived of closure.factsByKey.values()) {
      chargeIndex();
      derivedFacts.push(derived.fact);
      pathsByFactKey.set(
        factKey(rootId, derived.fact.factKind, derived.fact.nodeId),
        {
          ...derived.fact,
          edgeIds: derived.path,
        },
      );
    }
  }
  derivedFacts.sort((left, right) => {
    chargeIndex();
    return left.rootDefinitionId < right.rootDefinitionId
      ? -1
      : left.rootDefinitionId > right.rootDefinitionId
        ? 1
        : left.factKind < right.factKind
          ? -1
          : left.factKind > right.factKind
            ? 1
            : left.nodeId < right.nodeId
              ? -1
              : left.nodeId > right.nodeId
                ? 1
                : 0;
  });
  chargeIndex(supportsByKey.size);
  const supports = [...supportsByKey.values()].sort((left, right) => {
    chargeIndex();
    return left.parentRootDefinitionId < right.parentRootDefinitionId
      ? -1
      : left.parentRootDefinitionId > right.parentRootDefinitionId
        ? 1
        : left.contingentRootDefinitionId < right.contingentRootDefinitionId
          ? -1
          : left.contingentRootDefinitionId > right.contingentRootDefinitionId
            ? 1
            : left.supportTemplateId < right.supportTemplateId
              ? -1
              : left.supportTemplateId > right.supportTemplateId
                ? 1
                : 0;
  });

  const supportAdjacency = new Map<
    ExecutionRootDefinitionId,
    PotentialRootSupport[]
  >();
  for (const support of supports) {
    chargeIndex();
    const values = supportAdjacency.get(support.parentRootDefinitionId) ?? [];
    values.push(support);
    supportAdjacency.set(support.parentRootDefinitionId, values);
  }
  for (const values of supportAdjacency.values()) {
    chargeIndex();
    values.sort((left, right) => {
      chargeIndex();
      return left.supportTemplateId < right.supportTemplateId
        ? -1
        : left.supportTemplateId > right.supportTemplateId
          ? 1
          : left.contingentRootDefinitionId < right.contingentRootDefinitionId
            ? -1
            : left.contingentRootDefinitionId > right.contingentRootDefinitionId
              ? 1
              : 0;
    });
  }
  const reachability: SeedReachability[] = [];
  const supportChainsByKey = new Map<string, ExecutionSupportChain>();
  const seedIds: ExecutionRootDefinitionId[] = [];
  for (const root of roots) {
    chargeIndex();
    if (root.preimage.admission === "seed") seedIds.push(root.id);
  }
  seedIds.sort((left, right) => {
    chargeIndex();
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (const seedId of seedIds) {
    chargeIndex();
    const paths = new Map<
      ExecutionRootDefinitionId,
      readonly (RegistrationSupportTemplateId | ReactiveSupportTemplateId)[]
    >([[seedId, Object.freeze([])]]);
    const queue = [seedId];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      chargeIndex();
      const parent = queue[cursor];
      const parentPath = paths.get(parent) ?? [];
      for (const support of supportAdjacency.get(parent) ?? []) {
        ledger.charge(
          "maximumPathSteps",
          parentPath.length + 1,
          ["derivation", "supportPaths"],
          "Support-path budget exceeded",
        );
        const child = support.contingentRootDefinitionId;
        const candidate = Object.freeze([
          ...parentPath,
          support.supportTemplateId,
        ]);
        const current = paths.get(child);
        if (current === undefined || isBetterPath(candidate, current)) {
          paths.set(child, candidate);
          queue.push(child);
        }
      }
    }
    for (const [supportedRootId, path] of paths) {
      chargeIndex();
      reachability.push({
        seedRootDefinitionId: seedId,
        supportedRootDefinitionId: supportedRootId,
      });
      supportChainsByKey.set(`${seedId}\u0000${supportedRootId}`, {
        seedRootDefinitionId: seedId,
        supportedRootDefinitionId: supportedRootId,
        supportTemplateIds: path,
      });
    }
  }
  reachability.sort((left, right) => {
    chargeIndex();
    return left.seedRootDefinitionId < right.seedRootDefinitionId
      ? -1
      : left.seedRootDefinitionId > right.seedRootDefinitionId
        ? 1
        : left.supportedRootDefinitionId < right.supportedRootDefinitionId
          ? -1
          : left.supportedRootDefinitionId > right.supportedRootDefinitionId
            ? 1
            : 0;
  });
  deepFreeze(derivedFacts);
  deepFreeze(supports);
  deepFreeze(reachability);
  for (const value of pathsByFactKey.values()) deepFreeze(value);
  for (const value of supportChainsByKey.values()) deepFreeze(value);
  return {
    facts: derivedFacts,
    supports,
    reachability,
    pathsByFactKey,
    supportChainsByKey,
  };
}

/** Builds the deterministic nonserialized index for a validated snapshot. */
function createExecutionGraphIndexFromSnapshot(
  snapshot: ExecutionGraphSnapshot,
  ledger: BudgetLedger,
): ExecutionGraphIndex {
  const chargeIndex = (amount = 1): void => {
    ledger.charge(
      "maximumIndexSteps",
      amount,
      ["index"],
      "Index budget exceeded",
    );
  };
  const derived = deriveIndexData(snapshot, ledger);
  chargeIndex(snapshot.preimage.edges.length);
  const traversalEdges: ExecutionEdge[] = [];
  for (const edge of snapshot.preimage.edges) {
    if (
      edge.preimage.kind === "may-execute" ||
      edge.preimage.kind === "may-materialize"
    ) {
      traversalEdges.push(edge);
    }
  }
  const scc = deriveScc(
    snapshot.preimage.qualifiedNodes,
    traversalEdges,
    ledger,
  );
  chargeIndex(
    snapshot.preimage.templateNodes.length +
      snapshot.preimage.qualifiedNodes.length +
      snapshot.preimage.occurrenceTemplates.length,
  );
  const templatesById = mapById(snapshot.preimage.templateNodes);
  const nodesById = mapById(snapshot.preimage.qualifiedNodes);
  const occurrencesById = mapById(snapshot.preimage.occurrenceTemplates);
  const incoming = new Map<QualifiedExecutionNodeId, ExecutionEdge[]>();
  const outgoing = new Map<QualifiedExecutionNodeId, ExecutionEdge[]>();
  for (const edge of snapshot.preimage.edges) {
    chargeIndex();
    const incomingValues = incoming.get(edge.preimage.targetNodeId) ?? [];
    incomingValues.push(edge);
    incoming.set(edge.preimage.targetNodeId, incomingValues);
    const outgoingValues = outgoing.get(edge.preimage.sourceNodeId) ?? [];
    outgoingValues.push(edge);
    outgoing.set(edge.preimage.sourceNodeId, outgoingValues);
  }
  for (const edgeMap of [incoming, outgoing]) {
    for (const values of edgeMap.values()) {
      chargeIndex();
      values.sort((left, right) => {
        chargeIndex();
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      });
      Object.freeze(values);
    }
  }
  const factsByRoot = new Map<ExecutionRootDefinitionId, IntraRootFact[]>();
  const factsByNode = new Map<QualifiedExecutionNodeId, IntraRootFact[]>();
  for (const fact of derived.facts) {
    chargeIndex();
    const rootValues = factsByRoot.get(fact.rootDefinitionId) ?? [];
    rootValues.push(fact);
    factsByRoot.set(fact.rootDefinitionId, rootValues);
    const nodeValues = factsByNode.get(fact.nodeId) ?? [];
    nodeValues.push(fact);
    factsByNode.set(fact.nodeId, nodeValues);
  }
  for (const factMap of [factsByRoot, factsByNode]) {
    for (const values of factMap.values()) {
      chargeIndex();
      Object.freeze(values);
    }
  }

  chargeIndex();
  const index: ExecutionGraphIndex = {
    derivationProfile: EXECUTION_GRAPH_DERIVATION_PROFILE,
    snapshot,
    intraRootFacts: derived.facts,
    potentialRootSupports: derived.supports,
    seedReachability: derived.reachability,
    stronglyConnectedComponents: scc.components,
    condensationEdges: scc.condensationEdges,
    getTemplateNode: (id) => templatesById.get(id) ?? null,
    getQualifiedNode: (id) => nodesById.get(id) ?? null,
    getIncomingEdges: (id) => incoming.get(id) ?? EMPTY_READONLY_ARRAY,
    getOutgoingEdges: (id) => outgoing.get(id) ?? EMPTY_READONLY_ARRAY,
    getOccurrenceTemplate: (id) => {
      const node = nodesById.get(id);
      return node === undefined
        ? null
        : (occurrencesById.get(node.preimage.occurrenceTemplateId) ?? null);
    },
    getFactsForRoot: (id) => factsByRoot.get(id) ?? EMPTY_READONLY_ARRAY,
    getRootsForNode: (id) => factsByNode.get(id) ?? EMPTY_READONLY_ARRAY,
    getJustificationPath: (rootId, factKind, nodeId) =>
      derived.pathsByFactKey.get(factKey(rootId, factKind, nodeId)) ?? null,
    getSupportChain: (seedRootId, supportedRootId) =>
      derived.supportChainsByKey.get(`${seedRootId}\u0000${supportedRootId}`) ??
      null,
    getStronglyConnectedComponent: (nodeId) =>
      scc.componentByNode.get(nodeId) ?? null,
  };
  Object.freeze(index);
  return index;
}

export { createExecutionGraphIndexFromSnapshot };
