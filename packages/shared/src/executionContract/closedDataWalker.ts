import { createActiveAncestorTracker } from "./activeAncestor";
import type { BudgetLedger } from "./budget";
import {
  createClosedDescriptorCapture,
  type ClosedContainerHeader,
  type ClosedContainerView,
} from "./closedDescriptor";
import { fail, type ValidationPath } from "./identity";
import {
  createOccurrencePlanBuilder,
  type ClosedDataOccurrence,
  type ClosedDataPathSegment,
  type ClosedDataPlan,
  type ClosedDataPlanNodeValue,
  type OccurrencePlanBuilder,
} from "./occurrencePlan";

/** Adds caller-specific precharges around generic descriptor completion. */
interface ClosedDataProfile {
  /** Runs after generic header charges and before property descriptors. */
  beforeDescriptors(
    occurrence: ClosedDataOccurrence,
    header: ClosedContainerHeader,
    ledger: BudgetLedger,
  ): void;

  /** Runs after descriptor completion and before cycle or child traversal. */
  beforeChildren(
    occurrence: ClosedDataOccurrence,
    view: ClosedContainerView,
    ledger: BudgetLedger,
  ): void;
}

interface RootVisitFrame {
  readonly kind: "visit";
  readonly value: unknown;
  readonly parentOccurrenceId: null;
  readonly segment: null;
  readonly depth: 1;
}

interface ChildVisitFrame {
  readonly kind: "visit";
  readonly value: unknown;
  readonly parentOccurrenceId: number;
  readonly segment: ClosedDataPathSegment;
  readonly depth: number;
}

type VisitFrame = RootVisitFrame | ChildVisitFrame;

interface LeaveFrame {
  readonly kind: "leave";
  readonly value: object;
}

type WalkerFrame = VisitFrame | LeaveFrame;

const DEFAULT_CLOSED_DATA_PROFILE: ClosedDataProfile = Object.freeze({
  beforeChildren() {},
  beforeDescriptors() {},
});

function defineArrayElement<Value>(
  target: Value[],
  index: number,
  value: Value,
): void {
  const defined = Reflect.defineProperty(target, index, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  if (!defined) {
    throw new TypeError("[dathra] Could not define closed data walker state");
  }
}

function appendArrayElement<Value>(target: Value[], value: Value): void {
  defineArrayElement(target, target.length, value);
}

function framePath(
  builder: OccurrencePlanBuilder,
  frame: VisitFrame,
): ValidationPath {
  if (frame.parentOccurrenceId === null) return builder.rootPath();
  return builder.childPath(frame.parentOccurrenceId, frame.segment);
}

function appendOccurrence(
  builder: OccurrencePlanBuilder,
  frame: VisitFrame,
  value: ClosedDataPlanNodeValue,
): ClosedDataOccurrence {
  if (frame.parentOccurrenceId === null) return builder.appendRoot(value);
  return builder.appendChild(frame.parentOccurrenceId, frame.segment, value);
}

function classifyScalar(
  value: null | boolean | number | string,
): ClosedDataPlanNodeValue {
  if (value === null) return { kind: "null", value };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (typeof value === "number") return { kind: "number", value };
  return { kind: "string", value };
}

function chargeContainerHeader(
  header: ClosedContainerHeader,
  ledger: BudgetLedger,
  path: ValidationPath,
): void {
  const propertyCount =
    header.ownKeys.length - (header.kind === "array" ? 1 : 0);
  ledger.chargeTotal("maximumInputProperties", propertyCount, path);

  for (let index = 0; index < header.ownKeys.length; index += 1) {
    const key = header.ownKeys[index];
    if (typeof key === "string") {
      ledger.chargeTotal("maximumInputStringCodeUnits", key.length, path);
    }
  }

  if (header.kind === "array") {
    ledger.chargeTotal("maximumInputArrayLength", header.length, path);
  }
}

function appendChildFrames(
  frames: WalkerFrame[],
  view: ClosedContainerView,
  parentOccurrenceId: number,
  depth: number,
): void {
  if (view.kind === "record") {
    for (let index = view.entries.length - 1; index >= 0; index -= 1) {
      const entry = view.entries[index];
      appendArrayElement(frames, {
        kind: "visit",
        value: entry[1],
        parentOccurrenceId,
        segment: entry[0],
        depth,
      });
    }
    return;
  }

  for (let index = view.items.length - 1; index >= 0; index -= 1) {
    appendArrayElement(frames, {
      kind: "visit",
      value: view.items[index],
      parentOccurrenceId,
      segment: index,
      depth,
    });
  }
}

/** Creates an operation-local closed data occurrence plan. */
function createClosedDataPlan(
  value: unknown,
  ledger: BudgetLedger,
  profile: ClosedDataProfile = DEFAULT_CLOSED_DATA_PROFILE,
): ClosedDataPlan {
  const capture = createClosedDescriptorCapture();
  const activeAncestors = createActiveAncestorTracker();
  const builder = createOccurrencePlanBuilder();
  const frames: WalkerFrame[] = [];
  appendArrayElement(frames, {
    kind: "visit",
    value,
    parentOccurrenceId: null,
    segment: null,
    depth: 1,
  });

  while (frames.length > 0) {
    const frameIndex = frames.length - 1;
    const frame = frames[frameIndex];
    frames.length = frameIndex;
    if (frame.kind === "leave") {
      activeAncestors.leave(frame.value);
      continue;
    }

    const path = framePath(builder, frame);
    ledger.observePeak("maximumInputDepth", frame.depth, path);
    ledger.chargeTotal("maximumInputDataNodes", 1, path);

    const descriptorValue = frame.value;
    if (
      descriptorValue === null ||
      typeof descriptorValue === "boolean" ||
      typeof descriptorValue === "number" ||
      typeof descriptorValue === "string"
    ) {
      if (typeof descriptorValue === "string") {
        ledger.chargeTotal(
          "maximumInputStringCodeUnits",
          descriptorValue.length,
          path,
        );
      }
      appendOccurrence(builder, frame, classifyScalar(descriptorValue));
      continue;
    }

    if (typeof descriptorValue !== "object") {
      fail(
        "invalid-closed-record",
        path,
        "Closed data contains an unsupported structural value",
      );
    }

    const header = capture.captureHeader(descriptorValue, path);
    const occurrence = appendOccurrence(builder, frame, {
      kind: header.kind,
    });
    chargeContainerHeader(header, ledger, path);
    profile.beforeDescriptors(occurrence, header, ledger);

    const view = capture.completeView(descriptorValue, path);
    profile.beforeChildren(occurrence, view, ledger);
    activeAncestors.enter(descriptorValue, path);
    appendArrayElement(frames, { kind: "leave", value: descriptorValue });
    appendChildFrames(
      frames,
      view,
      occurrence.occurrenceId,
      occurrence.depth + 1,
    );
  }

  return builder.finish();
}

export { createClosedDataPlan };
export type { ClosedDataProfile };
