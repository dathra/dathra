import type { Content, ServerTools } from "../runtime/contracts.js";
import { el } from "@dathra/core/server";
function nativeControls({ bind }: ServerTools<"checked" | "disabled" | "title">) {
  return el(
    "form",
    {},
    el("input", {
      type: "checkbox",
      props: {
        checked: bind("checked", { server: true }),
        defaultChecked: true,
      },
    }),
    el("input", {
      type: "checkbox",
      props: {
        checked: bind("checked", { server: false }),
        defaultChecked: false,
      },
    }),
    el(
      "button",
      { disabled: bind("disabled", { server: true }), title: bind("title", { server: "Save" }) },
      "Save",
    ),
    el("button", { disabled: bind("disabled", { server: false }) }, "Enabled"),
    el("input", { type: "checkbox", props: { defaultChecked: bind("checked", { server: true }) } }),
  );
}
// Proposed policy: boolean children represent empty content, including condition && description.
const emptyBooleanChild: Content = false;
// oxlint-disable-next-line no-constant-binary-expression -- Exercise the false branch as a public Content type.
const conditionallyVisible: Content = false && el("span", {}, "conditional");
export { nativeControls, emptyBooleanChild, conditionallyVisible };
