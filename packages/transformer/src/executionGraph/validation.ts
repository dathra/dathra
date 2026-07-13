import type {
  ObservationConstraint,
  ObservationContract,
  Sha256Digest,
} from "@dathra/shared";

import type { BudgetLedger } from "./budget";
import type { ParsedDependencies, ParsedGraphRecords } from "./canonical";
import {
  EDGE_ROLE_RULE,
  OPERATION_ROLE,
  REACTIVE_SUPPORT_OPERATION_RULE,
  ROOT_KIND_RULE,
  SCHEDULER_SEQUENCE_RULE,
  fail,
  mapById,
  requireMapValue,
  type ExecutionAnalysisProfileId,
  type ExecutionGenerationDomainId,
  type ExecutionLocationRequirementId,
  type ExecutionOperationKind,
  type ExecutionRootDefinition,
  type ExecutionRootDefinitionId,
  type ExecutionRootObligation,
  type ExecutionSemanticRole,
  type ExecutionTemplateNode,
  type ExecutionTemplateNodeId,
  type QualifiedExecutionNode,
  type QualifiedExecutionNodeId,
  type StaticExecutionOccurrenceTemplate,
  type StaticExecutionOccurrenceTemplateId,
  type ValidationPath,
} from "./model";

function includesRole(
  roles: readonly ExecutionSemanticRole[] | "any",
  role: ExecutionSemanticRole,
): boolean {
  return roles === "any" || roles.includes(role);
}

function operationForNode(
  node: QualifiedExecutionNode,
  templatesById: ReadonlyMap<ExecutionTemplateNodeId, ExecutionTemplateNode>,
): ExecutionOperationKind {
  const template = templatesById.get(node.preimage.templateNodeId);
  if (template === undefined) {
    throw new Error("Validated node references an unknown template");
  }
  return template.preimage.operationKind;
}

function validateTemplateDag(
  templates: readonly ExecutionTemplateNode[],
  templatesById: ReadonlyMap<ExecutionTemplateNodeId, ExecutionTemplateNode>,
  ledger: BudgetLedger,
): void {
  const state = new Map<ExecutionTemplateNodeId, "visiting" | "visited">();
  for (const rootTemplate of templates) {
    ledger.charge(
      "maximumValidationSteps",
      1,
      ["templateNodes", rootTemplate.id],
      "Validation-step budget exceeded",
    );
    if (state.has(rootTemplate.id)) continue;
    state.set(rootTemplate.id, "visiting");
    const stack: { id: ExecutionTemplateNodeId; inputIndex: number }[] = [
      { id: rootTemplate.id, inputIndex: 0 },
    ];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const template = requireMapValue(
        templatesById,
        frame.id,
        ["templateNodes", frame.id],
        "template node",
      );
      const inputs =
        template.preimage.kind === "generated" ? template.preimage.inputs : [];
      if (frame.inputIndex >= inputs.length) {
        state.set(frame.id, "visited");
        stack.pop();
        continue;
      }
      const input = inputs[frame.inputIndex];
      frame.inputIndex += 1;
      ledger.charge(
        "maximumValidationSteps",
        1,
        ["templateNodes", frame.id, "inputs", input.slot],
        "Validation-step budget exceeded",
      );
      requireMapValue(
        templatesById,
        input.templateNodeId,
        ["templateNodes", frame.id, "inputs", input.slot],
        "input template",
      );
      const inputState = state.get(input.templateNodeId);
      if (inputState === "visiting") {
        fail(
          "identity-cycle",
          ["templateNodes", input.templateNodeId],
          "Generated template cycle",
        );
      }
      if (inputState !== "visited") {
        state.set(input.templateNodeId, "visiting");
        stack.push({ id: input.templateNodeId, inputIndex: 0 });
      }
    }
  }
}

function contractConstraintMap(
  contract: ObservationContract,
  ledger: BudgetLedger,
): ReadonlyMap<Sha256Digest, ObservationConstraint> {
  ledger.charge(
    "maximumValidationSteps",
    contract.preimage.constraints.length,
    ["validation", "contractConstraints"],
    "Validation-step budget exceeded",
  );
  const constraints = new Map<Sha256Digest, ObservationConstraint>();
  for (const constraint of contract.preimage.constraints) {
    constraints.set(constraint.id, constraint);
  }
  return constraints;
}

function validateRequiredOccurrenceSlots(
  root: ExecutionRootDefinition,
  target: QualifiedExecutionNode,
  occurrencesById: ReadonlyMap<
    StaticExecutionOccurrenceTemplateId,
    StaticExecutionOccurrenceTemplate
  >,
): void {
  const occurrence = requireMapValue(
    occurrencesById,
    target.preimage.occurrenceTemplateId,
    ["rootObligations", root.id, "targetNodeId"],
    "occurrence template",
  );
  const slots = new Set(occurrence.preimage.identitySlots);
  if (!slots.has("root-instance")) {
    fail(
      "root-contract-mismatch",
      ["rootObligations", root.id, "targetNodeId"],
      "Root targets require the root-instance occurrence slot",
    );
  }
  if (
    root.preimage.kind === "callback" &&
    (!slots.has("registration") || !slots.has("activation"))
  ) {
    fail(
      "root-contract-mismatch",
      ["rootObligations", root.id, "targetNodeId"],
      "Callback targets require registration and activation slots",
    );
  }
  if (root.preimage.kind === "reactive-updater" && !slots.has("activation")) {
    fail(
      "root-contract-mismatch",
      ["rootObligations", root.id, "targetNodeId"],
      "Reactive updater targets require the activation slot",
    );
  }
}

interface ValidatedGraph {
  readonly selectedContractIds: readonly Sha256Digest[];
}

function validateGraphRecords(
  records: ParsedGraphRecords,
  dependencies: ParsedDependencies,
  ledger: BudgetLedger,
): ValidatedGraph {
  for (const values of [
    records.analysisProfiles,
    records.rootDefinitions,
    records.locationRequirements,
    records.occurrenceTemplates,
    records.templateNodes,
    records.generationDomains,
    records.qualifiedNodes,
    records.edges,
    records.registrationSupports,
    records.reactiveSupports,
    records.rootObligations,
  ]) {
    ledger.charge(
      "maximumValidationSteps",
      values.length,
      ["validation"],
      "Validation-step budget exceeded",
    );
  }
  ledger.charge(
    "maximumValidationSteps",
    dependencies.moduleGraph.preimage.moduleDefinitions.length +
      dependencies.moduleGraph.preimage.runtimeBindings.length +
      dependencies.moduleGraph.preimage.resolutionDomains.length,
    ["validation", "moduleDependencies"],
    "Validation-step budget exceeded",
  );
  const analysisById = mapById(records.analysisProfiles);
  const rootsById = mapById(records.rootDefinitions);
  const locationsById = mapById(records.locationRequirements);
  const occurrencesById = mapById(records.occurrenceTemplates);
  const templatesById = mapById(records.templateNodes);
  const generationsById = mapById(records.generationDomains);
  const nodesById = mapById(records.qualifiedNodes);
  const edgesById = mapById(records.edges);
  const moduleDefinitionsById = mapById(
    dependencies.moduleGraph.preimage.moduleDefinitions,
  );
  const moduleBindingsById = mapById(
    dependencies.moduleGraph.preimage.runtimeBindings,
  );
  const moduleDomainsById = mapById(
    dependencies.moduleGraph.preimage.resolutionDomains,
  );
  const requireContract = (
    id: Sha256Digest | null,
    path: ValidationPath,
  ): ObservationContract => {
    if (id === null) {
      fail("dependency-mismatch", path, "Missing observation contract ID");
    }
    const contract = dependencies.contractsById.get(id);
    if (contract === undefined) {
      fail(
        "dependency-mismatch",
        path,
        "Observation contract is not in context",
      );
    }
    return contract;
  };

  for (const location of records.locationRequirements) {
    ledger.charge(
      "maximumValidationSteps",
      location.preimage.resolutionDomainIds.length,
      ["locationRequirements", location.id, "resolutionDomainIds"],
      "Validation-step budget exceeded",
    );
    for (const domainId of location.preimage.resolutionDomainIds) {
      const domain = requireMapValue(
        moduleDomainsById,
        domainId,
        ["locationRequirements", location.id, "resolutionDomainIds"],
        "module resolution domain",
      );
      if (
        !location.preimage.targetEnvironmentIds.includes(
          domain.preimage.targetEnvironmentId,
        )
      ) {
        fail(
          "location-mismatch",
          ["locationRequirements", location.id, "resolutionDomainIds"],
          "Resolution-domain environment is outside the location requirement",
        );
      }
    }
  }

  for (const template of records.templateNodes) {
    if (template.preimage.kind === "source") {
      requireMapValue(
        analysisById,
        template.preimage.analysisProfileId,
        ["templateNodes", template.id, "analysisProfileId"],
        "analysis profile",
      );
      const definition = requireMapValue(
        moduleDefinitionsById,
        template.preimage.moduleDefinitionId,
        ["templateNodes", template.id, "moduleDefinitionId"],
        "module definition",
      );
      if (
        definition.preimage.kind !== "content" ||
        definition.preimage.canonicalSourceUrl !==
          template.preimage.canonicalSourceUrl ||
        definition.preimage.transformedContentDigest !==
          template.preimage.transformedContentDigest ||
        definition.preimage.semanticProfileId !==
          template.preimage.semanticProfileId
      ) {
        fail(
          "dependency-mismatch",
          ["templateNodes", template.id],
          "Source template does not match a content module definition",
        );
      }
    } else if (template.preimage.rootDefinitionId !== null) {
      const root = requireMapValue(
        rootsById,
        template.preimage.rootDefinitionId,
        ["templateNodes", template.id, "rootDefinitionId"],
        "root definition",
      );
      const contract = requireContract(
        template.preimage.observationContractId,
        ["templateNodes", template.id, "observationContractId"],
      );
      if (contract.preimage.rootDefinitionId !== root.id) {
        fail(
          "root-contract-mismatch",
          ["templateNodes", template.id, "observationContractId"],
          "Generated template contract belongs to another root",
        );
      }
    }
  }
  validateTemplateDag(records.templateNodes, templatesById, ledger);

  for (const generation of records.generationDomains) {
    const location = requireMapValue(
      locationsById,
      generation.preimage.locationRequirementId,
      ["generationDomains", generation.id, "locationRequirementId"],
      "location requirement",
    );
    if (
      !location.preimage.targetEnvironmentIds.includes(
        generation.preimage.targetEnvironmentId,
      )
    ) {
      fail(
        "location-mismatch",
        ["generationDomains", generation.id, "targetEnvironmentId"],
        "Generation environment is outside the location requirement",
      );
    }
    if (generation.preimage.resolutionDomainId !== null) {
      const domain = requireMapValue(
        moduleDomainsById,
        generation.preimage.resolutionDomainId,
        ["generationDomains", generation.id, "resolutionDomainId"],
        "module resolution domain",
      );
      if (
        !location.preimage.resolutionDomainIds.includes(domain.id) ||
        domain.preimage.targetEnvironmentId !==
          generation.preimage.targetEnvironmentId
      ) {
        fail(
          "location-mismatch",
          ["generationDomains", generation.id, "resolutionDomainId"],
          "Generation resolution domain and environment do not match",
        );
      }
    }
  }

  for (const node of records.qualifiedNodes) {
    const template = requireMapValue(
      templatesById,
      node.preimage.templateNodeId,
      ["qualifiedNodes", node.id, "templateNodeId"],
      "template node",
    );
    const location = requireMapValue(
      locationsById,
      node.preimage.locationRequirementId,
      ["qualifiedNodes", node.id, "locationRequirementId"],
      "location requirement",
    );
    requireMapValue(
      occurrencesById,
      node.preimage.occurrenceTemplateId,
      ["qualifiedNodes", node.id, "occurrenceTemplateId"],
      "occurrence template",
    );
    if (
      OPERATION_ROLE[template.preimage.operationKind] !==
      node.preimage.semanticRole
    ) {
      fail(
        "role-mismatch",
        ["qualifiedNodes", node.id, "semanticRole"],
        "Semantic role does not match operation kind",
      );
    }
    if (template.preimage.kind === "source") {
      if (node.preimage.binding.kind !== "module") {
        fail(
          "location-mismatch",
          ["qualifiedNodes", node.id, "binding"],
          "Source nodes require a module binding",
        );
      }
      const binding = requireMapValue(
        moduleBindingsById,
        node.preimage.binding.runtimeBindingId,
        ["qualifiedNodes", node.id, "binding", "runtimeBindingId"],
        "runtime module binding",
      );
      const domain = requireMapValue(
        moduleDomainsById,
        binding.preimage.resolutionDomainId,
        ["qualifiedNodes", node.id, "binding", "runtimeBindingId"],
        "module resolution domain",
      );
      if (
        binding.preimage.moduleDefinitionId !==
          template.preimage.moduleDefinitionId ||
        !location.preimage.resolutionDomainIds.includes(domain.id) ||
        !location.preimage.targetEnvironmentIds.includes(
          domain.preimage.targetEnvironmentId,
        )
      ) {
        fail(
          "location-mismatch",
          ["qualifiedNodes", node.id, "binding"],
          "Module binding is outside the qualified location",
        );
      }
    } else {
      if (node.preimage.binding.kind !== "generated") {
        fail(
          "location-mismatch",
          ["qualifiedNodes", node.id, "binding"],
          "Generated nodes require a generation binding",
        );
      }
      const generation = requireMapValue(
        generationsById,
        node.preimage.binding.generationDomainId,
        ["qualifiedNodes", node.id, "binding", "generationDomainId"],
        "generation domain",
      );
      if (
        generation.preimage.locationRequirementId !== location.id ||
        generation.preimage.generatorProfileDigest !==
          template.preimage.generatorProfileDigest
      ) {
        fail(
          "location-mismatch",
          ["qualifiedNodes", node.id, "binding"],
          "Generation binding does not match template and location",
        );
      }
    }
  }

  for (const edge of records.edges) {
    const source = requireMapValue(
      nodesById,
      edge.preimage.sourceNodeId,
      ["edges", edge.id, "sourceNodeId"],
      "source node",
    );
    const target = requireMapValue(
      nodesById,
      edge.preimage.targetNodeId,
      ["edges", edge.id, "targetNodeId"],
      "target node",
    );
    const rule = EDGE_ROLE_RULE[edge.preimage.kind];
    if (
      !includesRole(rule.source, source.preimage.semanticRole) ||
      !includesRole(rule.target, target.preimage.semanticRole)
    ) {
      fail(
        "edge-mismatch",
        ["edges", edge.id],
        "Edge endpoint roles do not match relation kind",
      );
    }
    const sourceOperation = operationForNode(source, templatesById);
    const targetOperation = operationForNode(target, templatesById);
    if (
      edge.preimage.kind === "registration" &&
      (sourceOperation !== "callback-registration" ||
        targetOperation !== "callback-body")
    ) {
      fail(
        "edge-mismatch",
        ["edges", edge.id],
        "Registration edges require registration-to-callback endpoints",
      );
    }
    if (
      edge.preimage.kind === "identity" &&
      source.preimage.semanticRole !== target.preimage.semanticRole
    ) {
      fail(
        "edge-mismatch",
        ["edges", edge.id],
        "Identity edges require equal semantic roles",
      );
    }
    if (edge.preimage.kind === "identity") {
      const sourceOccurrence = requireMapValue(
        occurrencesById,
        source.preimage.occurrenceTemplateId,
        ["edges", edge.id, "sourceNodeId"],
        "source occurrence template",
      );
      const targetOccurrence = requireMapValue(
        occurrencesById,
        target.preimage.occurrenceTemplateId,
        ["edges", edge.id, "targetNodeId"],
        "target occurrence template",
      );
      if (
        !sourceOccurrence.preimage.identitySlots.includes(
          edge.preimage.identitySlot,
        ) ||
        !targetOccurrence.preimage.identitySlots.includes(
          edge.preimage.identitySlot,
        )
      ) {
        fail(
          "edge-mismatch",
          ["edges", edge.id, "identitySlot"],
          "Identity edge endpoints must share the exact occurrence slot",
        );
      }
    }
    if (edge.preimage.kind === "scheduler-sequence") {
      const pair = `${sourceOperation}:${targetOperation}`;
      if (!SCHEDULER_SEQUENCE_RULE.some((allowed) => allowed === pair)) {
        fail("edge-mismatch", ["edges", edge.id], "Invalid scheduler sequence");
      }
    }
  }

  const obligationsByRoot = new Map<
    ExecutionRootDefinitionId,
    ExecutionRootObligation
  >();
  const selectedContracts = new Set<Sha256Digest>();
  for (const obligation of records.rootObligations) {
    const root = requireMapValue(
      rootsById,
      obligation.preimage.rootDefinitionId,
      ["rootObligations", obligation.id, "rootDefinitionId"],
      "root definition",
    );
    if (obligationsByRoot.has(root.id)) {
      fail(
        "duplicate-record",
        ["rootObligations", obligation.id, "rootDefinitionId"],
        "Root has more than one obligation",
      );
    }
    obligationsByRoot.set(root.id, obligation);
    const contract = requireContract(
      obligation.preimage.observationContractId,
      ["rootObligations", obligation.id, "observationContractId"],
    );
    selectedContracts.add(contract.id);
    const target = requireMapValue(
      nodesById,
      obligation.preimage.targetNodeId,
      ["rootObligations", obligation.id, "targetNodeId"],
      "root target node",
    );
    if (contract.preimage.rootDefinitionId !== root.id) {
      fail(
        "root-contract-mismatch",
        ["rootObligations", obligation.id, "observationContractId"],
        "Contract belongs to another root",
      );
    }
    const rule = ROOT_KIND_RULE[root.preimage.kind];
    if (
      root.preimage.admission !== rule.admission ||
      root.preimage.phase !== rule.phase ||
      obligation.preimage.entryFactKind !== rule.entryFactKind
    ) {
      fail(
        "root-contract-mismatch",
        ["rootObligations", obligation.id],
        "Root admission, phase, or entry fact violates the root-kind table",
      );
    }
    const constraints = contractConstraintMap(contract, ledger);
    if (
      obligation.preimage.triggerConstraintIds.length !==
      (rule.triggerKind === null ? 0 : 1)
    ) {
      fail(
        "root-contract-mismatch",
        ["rootObligations", obligation.id, "triggerConstraintIds"],
        "Trigger count violates the root-kind table",
      );
    }
    ledger.charge(
      "maximumValidationSteps",
      obligation.preimage.triggerConstraintIds.length,
      ["rootObligations", obligation.id, "triggerConstraintIds"],
      "Validation-step budget exceeded",
    );
    for (const triggerId of obligation.preimage.triggerConstraintIds) {
      const trigger = requireMapValue(
        constraints,
        triggerId,
        ["rootObligations", obligation.id, "triggerConstraintIds"],
        "trigger constraint",
      );
      if (
        trigger.kind !== rule.triggerKind ||
        !("admissionCutId" in trigger) ||
        trigger.admissionCutId !== contract.preimage.initialCutId
      ) {
        fail(
          "root-contract-mismatch",
          ["rootObligations", obligation.id, "triggerConstraintIds"],
          "Trigger kind or admission cut does not match the contract",
        );
      }
    }
    ledger.charge(
      "maximumValidationSteps",
      obligation.preimage.ownerConstraintIds.length,
      ["rootObligations", obligation.id, "ownerConstraintIds"],
      "Validation-step budget exceeded",
    );
    for (const ownerId of obligation.preimage.ownerConstraintIds) {
      const owner = requireMapValue(
        constraints,
        ownerId,
        ["rootObligations", obligation.id, "ownerConstraintIds"],
        "owner constraint",
      );
      if (owner.kind !== "identity" && owner.kind !== "lifetime") {
        fail(
          "root-contract-mismatch",
          ["rootObligations", obligation.id, "ownerConstraintIds"],
          "Owner references must be identity or lifetime constraints",
        );
      }
    }
    const terminal = requireMapValue(
      constraints,
      obligation.preimage.terminalConstraintId,
      ["rootObligations", obligation.id, "terminalConstraintId"],
      "terminal constraint",
    );
    if (terminal.kind !== "terminal" || terminal.subjectId !== root.id) {
      fail(
        "root-contract-mismatch",
        ["rootObligations", obligation.id, "terminalConstraintId"],
        "Terminal constraint does not belong to the root",
      );
    }
    validateRequiredOccurrenceSlots(root, target, occurrencesById);
  }
  for (const root of records.rootDefinitions) {
    if (!obligationsByRoot.has(root.id)) {
      fail(
        "unreachable-auxiliary",
        ["rootDefinitions", root.id],
        "Root definition has no obligation",
      );
    }
  }

  for (const template of records.templateNodes) {
    if (
      template.preimage.kind === "generated" &&
      template.preimage.rootDefinitionId !== null
    ) {
      const obligation = requireMapValue(
        obligationsByRoot,
        template.preimage.rootDefinitionId,
        ["templateNodes", template.id, "rootDefinitionId"],
        "root obligation",
      );
      if (
        obligation.preimage.observationContractId !==
        template.preimage.observationContractId
      ) {
        fail(
          "root-contract-mismatch",
          ["templateNodes", template.id, "observationContractId"],
          "Generated template contract differs from the root obligation",
        );
      }
      selectedContracts.add(template.preimage.observationContractId);
    }
  }

  const supportCountByRoot = new Map<ExecutionRootDefinitionId, number>();
  const registrationOptionsByNode = new Map<
    QualifiedExecutionNodeId,
    {
      readonly once: boolean;
      readonly abortable: boolean;
      readonly protocol: "dathra.registration-state/1";
    }
  >();
  for (const support of records.registrationSupports) {
    const existingOptions = registrationOptionsByNode.get(
      support.preimage.registrationNodeId,
    );
    if (
      existingOptions !== undefined &&
      (existingOptions.once !== support.preimage.once ||
        existingOptions.abortable !== support.preimage.abortable)
    ) {
      fail(
        "support-mismatch",
        ["registrationSupports", support.id],
        "Registration node has conflicting site-level options",
      );
    }
    registrationOptionsByNode.set(support.preimage.registrationNodeId, {
      once: support.preimage.once,
      abortable: support.preimage.abortable,
      protocol: support.preimage.protocol,
    });
    const registrationNode = requireMapValue(
      nodesById,
      support.preimage.registrationNodeId,
      ["registrationSupports", support.id, "registrationNodeId"],
      "registration node",
    );
    const callbackNode = requireMapValue(
      nodesById,
      support.preimage.callbackNodeId,
      ["registrationSupports", support.id, "callbackNodeId"],
      "callback node",
    );
    const edge = requireMapValue(
      edgesById,
      support.preimage.registrationEdgeId,
      ["registrationSupports", support.id, "registrationEdgeId"],
      "registration edge",
    );
    const root = requireMapValue(
      rootsById,
      support.preimage.contingentRootDefinitionId,
      ["registrationSupports", support.id, "contingentRootDefinitionId"],
      "contingent root",
    );
    const obligation = requireMapValue(
      obligationsByRoot,
      root.id,
      ["registrationSupports", support.id, "contingentRootDefinitionId"],
      "child obligation",
    );
    if (
      operationForNode(registrationNode, templatesById) !==
        "callback-registration" ||
      operationForNode(callbackNode, templatesById) !== "callback-body" ||
      edge.preimage.kind !== "registration" ||
      edge.preimage.sourceNodeId !== registrationNode.id ||
      edge.preimage.targetNodeId !== callbackNode.id ||
      root.preimage.kind !== "callback" ||
      obligation.preimage.targetNodeId !== callbackNode.id ||
      obligation.preimage.triggerConstraintIds.length !== 1 ||
      obligation.preimage.triggerConstraintIds[0] !==
        support.preimage.triggerConstraintId
    ) {
      fail(
        "support-mismatch",
        ["registrationSupports", support.id],
        "Registration support is not exactly bound to its child root",
      );
    }
    supportCountByRoot.set(root.id, (supportCountByRoot.get(root.id) ?? 0) + 1);
  }

  for (const support of records.reactiveSupports) {
    const collector = requireMapValue(
      nodesById,
      support.preimage.collectorNodeId,
      ["reactiveSupports", support.id, "collectorNodeId"],
      "collector node",
    );
    const read = requireMapValue(
      nodesById,
      support.preimage.readNodeId,
      ["reactiveSupports", support.id, "readNodeId"],
      "read node",
    );
    const dependency = requireMapValue(
      nodesById,
      support.preimage.dependencyNodeId,
      ["reactiveSupports", support.id, "dependencyNodeId"],
      "dependency node",
    );
    const binding = requireMapValue(
      nodesById,
      support.preimage.bindingNodeId,
      ["reactiveSupports", support.id, "bindingNodeId"],
      "binding node",
    );
    const dataEdge = requireMapValue(
      edgesById,
      support.preimage.dataEdgeId,
      ["reactiveSupports", support.id, "dataEdgeId"],
      "data edge",
    );
    const subscriptionEdge = requireMapValue(
      edgesById,
      support.preimage.subscriptionEdgeId,
      ["reactiveSupports", support.id, "subscriptionEdgeId"],
      "subscription edge",
    );
    const root = requireMapValue(
      rootsById,
      support.preimage.contingentRootDefinitionId,
      ["reactiveSupports", support.id, "contingentRootDefinitionId"],
      "contingent root",
    );
    const obligation = requireMapValue(
      obligationsByRoot,
      root.id,
      ["reactiveSupports", support.id, "contingentRootDefinitionId"],
      "child obligation",
    );
    if (
      !REACTIVE_SUPPORT_OPERATION_RULE.collector.some(
        (operation) => operation === operationForNode(collector, templatesById),
      ) ||
      !REACTIVE_SUPPORT_OPERATION_RULE.read.some(
        (operation) => operation === operationForNode(read, templatesById),
      ) ||
      !REACTIVE_SUPPORT_OPERATION_RULE.dependency.some(
        (operation) =>
          operation === operationForNode(dependency, templatesById),
      ) ||
      !REACTIVE_SUPPORT_OPERATION_RULE.binding.some(
        (operation) => operation === operationForNode(binding, templatesById),
      ) ||
      dataEdge.preimage.kind !== "data" ||
      dataEdge.preimage.sourceNodeId !== read.id ||
      dataEdge.preimage.targetNodeId !== collector.id ||
      subscriptionEdge.preimage.kind !== "possible-subscription" ||
      subscriptionEdge.preimage.sourceNodeId !== read.id ||
      subscriptionEdge.preimage.targetNodeId !== dependency.id ||
      root.preimage.kind !== "reactive-updater" ||
      obligation.preimage.targetNodeId !== binding.id ||
      obligation.preimage.triggerConstraintIds.length !== 1 ||
      obligation.preimage.triggerConstraintIds[0] !==
        support.preimage.triggerConstraintId
    ) {
      fail(
        "support-mismatch",
        ["reactiveSupports", support.id],
        "Reactive support is not exactly bound to its child root",
      );
    }
    let expectedSource = dependency.id;
    ledger.charge(
      "maximumValidationSteps",
      support.preimage.invalidationEdgeIds.length,
      ["reactiveSupports", support.id, "invalidationEdgeIds"],
      "Validation-step budget exceeded",
    );
    for (const edgeId of support.preimage.invalidationEdgeIds) {
      const edge = requireMapValue(
        edgesById,
        edgeId,
        ["reactiveSupports", support.id, "invalidationEdgeIds"],
        "invalidation edge",
      );
      if (
        edge.preimage.kind !== "invalidation" ||
        edge.preimage.sourceNodeId !== expectedSource
      ) {
        fail(
          "support-mismatch",
          ["reactiveSupports", support.id, "invalidationEdgeIds"],
          "Invalidation path is not contiguous",
        );
      }
      expectedSource = edge.preimage.targetNodeId;
    }
    if (expectedSource !== binding.id) {
      fail(
        "support-mismatch",
        ["reactiveSupports", support.id, "invalidationEdgeIds"],
        "Invalidation path does not end at the binding",
      );
    }
    supportCountByRoot.set(root.id, (supportCountByRoot.get(root.id) ?? 0) + 1);
  }
  for (const root of records.rootDefinitions) {
    if (
      root.preimage.admission === "contingent" &&
      (supportCountByRoot.get(root.id) ?? 0) === 0
    ) {
      fail(
        "unreachable-auxiliary",
        ["rootDefinitions", root.id],
        "Contingent root has no support template",
      );
    }
  }

  const usedAnalysis = new Set<ExecutionAnalysisProfileId>();
  const usedLocations = new Set<ExecutionLocationRequirementId>();
  const usedOccurrences = new Set<StaticExecutionOccurrenceTemplateId>();
  const usedTemplates = new Set<ExecutionTemplateNodeId>();
  const usedGenerations = new Set<ExecutionGenerationDomainId>();
  for (const template of records.templateNodes) {
    if (template.preimage.kind === "source") {
      usedAnalysis.add(template.preimage.analysisProfileId);
    } else {
      ledger.charge(
        "maximumValidationSteps",
        template.preimage.inputs.length,
        ["templateNodes", template.id, "inputs"],
        "Validation-step budget exceeded",
      );
      for (const input of template.preimage.inputs) {
        usedTemplates.add(input.templateNodeId);
      }
    }
  }
  for (const generation of records.generationDomains) {
    usedLocations.add(generation.preimage.locationRequirementId);
  }
  for (const node of records.qualifiedNodes) {
    usedTemplates.add(node.preimage.templateNodeId);
    usedLocations.add(node.preimage.locationRequirementId);
    usedOccurrences.add(node.preimage.occurrenceTemplateId);
    if (node.preimage.binding.kind === "generated") {
      usedGenerations.add(node.preimage.binding.generationDomainId);
    }
  }
  const requireExactUse = <Id extends string>(
    values: readonly { readonly id: Id }[],
    used: ReadonlySet<Id>,
    field: string,
  ): void => {
    ledger.charge(
      "maximumValidationSteps",
      values.length,
      [field],
      "Validation-step budget exceeded",
    );
    for (const value of values) {
      if (!used.has(value.id)) {
        fail(
          "unreachable-auxiliary",
          [field, value.id],
          "Auxiliary record is not structurally referenced",
        );
      }
    }
  };
  requireExactUse(records.analysisProfiles, usedAnalysis, "analysisProfiles");
  requireExactUse(
    records.locationRequirements,
    usedLocations,
    "locationRequirements",
  );
  requireExactUse(
    records.occurrenceTemplates,
    usedOccurrences,
    "occurrenceTemplates",
  );
  requireExactUse(records.templateNodes, usedTemplates, "templateNodes");
  requireExactUse(
    records.generationDomains,
    usedGenerations,
    "generationDomains",
  );

  ledger.charge(
    "maximumValidationSteps",
    selectedContracts.size,
    ["validation", "selectedContracts"],
    "Validation-step budget exceeded",
  );
  const selectedContractIds = [...selectedContracts].sort((left, right) => {
    ledger.charge(
      "maximumValidationSteps",
      1,
      ["validation", "selectedContracts"],
      "Validation-step budget exceeded",
    );
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return { selectedContractIds: Object.freeze(selectedContractIds) };
}

export { validateGraphRecords };
export type { ValidatedGraph };
