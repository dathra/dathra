import { adoptList, definition, contentMarker, keyId, extentNodes } from "./p04-kernel.mjs";
import { controlledGroup, nativeDraft } from "./p05-kernel.mjs";
import { counterBaseline } from "./counter-kernel.mjs";
import { signal, effect, createRoot, onCleanup } from "../../../packages/reactivity/src/index.ts";
import { reconcile } from "../../../packages/runtime/src/reconcile/implementation.ts";

function counts() {
  return { factory: 0, initialize: 0, template: 0, serverTemplate: 0, stop: 0 };
}

/** Record references from this fixed server fixture; no runtime ownership inference occurs. */
function listFixture(def, id = "list") {
  const root = document.getElementById(id);
  const [start, aStart, aControl, aLabel, aEnd, bStart, bControl, bLabel, bEnd, end] =
    root.childNodes;
  const rows = [
    { _key: "a", start: aStart, end: aEnd, control: aControl, label: aLabel, snapshot: "Alpha" },
    { _key: "b", start: bStart, end: bEnd, control: bControl, label: bLabel, snapshot: "Beta" },
  ].map((row) =>
    Object.freeze({
      ...row,
      defaultId: def.defaultId,
      profileId: def.profileId,
      parserId: def.parserId,
      tag: def.tag,
      ns: def.ns,
    }),
  );
  return Object.freeze({ id: "response:list:1", root, start, end, rows: Object.freeze(rows) });
}

function intent(def, key, input = String(key)) {
  return Object.freeze({
    _key: key,
    input,
    defaultId: def.defaultId,
    profileId: def.profileId,
    parserId: def.parserId,
    tag: def.tag,
    ns: def.ns,
  });
}

function groupFixture(refs = ["a"], id = "form-response") {
  return Object.freeze({
    id,
    snapshot: "a",
    sink: "setDraft",
    getter: "draftText",
    controls: Object.freeze(
      refs.map((ref) => Object.freeze({ ref, node: document.getElementById(ref), server: "a" })),
    ),
  });
}

function groupRegistry(format = (value) => value, log = []) {
  return Object.freeze({
    setDraft(ctx) {
      log.push({ ...ctx.input });
      ctx.values.draft.set(ctx.input.value);
    },
    draftText(ctx) {
      return format(ctx.values.draft.value);
    },
  });
}

globalThis.Proof = {
  adoptList,
  definition,
  contentMarker,
  keyId,
  extentNodes,
  controlledGroup,
  nativeDraft,
  counterBaseline,
  counts,
  listFixture,
  intent,
  groupFixture,
  groupRegistry,
  signal,
  effect,
  createRoot,
  onCleanup,
  reconcile,
};
