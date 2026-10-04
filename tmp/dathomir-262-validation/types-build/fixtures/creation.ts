import { signal } from "@dathra/reactivity";
import { defineClient, createComponent, el } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
type Input = { id: string; label: string };
function parse(raw: unknown): Input {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("id" in raw) ||
    typeof raw.id !== "string" ||
    !("label" in raw) ||
    typeof raw.label !== "string"
  )
    throw new Error("Expected id and label");
  return { id: raw.id, label: raw.label };
}
function initialize(input: Input) {
  return { draft: signal(input.label), id: input.id };
}
type Values = ReturnType<typeof initialize>;
type Ctx = ClientContext<Values, unknown, unknown, Input>;
function draftText(ctx: Ctx) {
  return ctx.values.draft.value;
}
function setDraft(ctx: Ctx) {
  ctx.values.draft.set(ctx.input.value);
}
function receive(ctx: Ctx) {
  const label: string = ctx.received.label;
  ctx.values.draft.set(label.toUpperCase());
  // @ts-expect-error Received parser input remains readonly.
  ctx.received.label = "changed";
}
const RowClient = defineClient(
  { draftText, setDraft, receive },
  {
    create: {
      input: parse,
      initialize,
      receive: "receive",
      template(values, { bind, on }) {
        const label: string = values.draft.value;
        // @ts-expect-error Contextual names are not widened by later callback arguments.
        bind("misspelled");
        // @ts-expect-error Sink uses the same complete registry.
        bind("draftText", { input: { sink: "missing" } });
        // @ts-expect-error No public kind or child tag.
        bind("draftText", { kind: "text" });
        return el(
          "div",
          {},
          el("input", { props: { value: bind("draftText", { input: { sink: "setDraft" } }) } }),
          el("span", { "aria-label": bind("draftText") }, label),
          el("button", { on: [on("click", "draftText"), on("click", "setDraft")] }, "All names"),
        );
      },
    },
  },
);
createComponent(RowClient, { _key: "a", input: { id: "a", label: "Alpha" } });
// @ts-expect-error Actual parser input result propagates.
createComponent(RowClient, { _key: "a", input: { id: 1, label: "Alpha" } });
const PlainClient = defineClient({ draftText });
// @ts-expect-error No implicit browser creation authority on a plain definition.
createComponent(PlainClient, { _key: "a", input: { id: "a", label: "Alpha" } });
export { RowClient };
