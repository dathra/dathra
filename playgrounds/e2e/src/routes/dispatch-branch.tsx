import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const DispatchBranchView = defineComponent(
  "e2e-dispatch-branch-view",
  ({ props }) => {
    if (props.mode.value === "primary") {
      return (
        <article>
          <p class="meta-chip">dispatch primary</p>
          <h2 data-testid="dispatch-heading">Primary branch</h2>
        </article>
      );
    }

    return (
      <article>
        <p class="meta-chip">dispatch secondary</p>
        <h2 data-testid="dispatch-heading">Secondary branch</h2>
      </article>
    );
  },
  {
    styles: [pageStyles],
    props: {
      mode: { type: String, default: "primary" },
    },
  },
);

const DispatchBranchFixture = defineComponent(
  "e2e-dispatch-branch-fixture",
  () => {
    const mode = signal<"primary" | "secondary">("primary");

    return (
      <article>
        <button
          type="button"
          data-testid="dispatch-toggle"
          onClick={() => {
            mode.set(mode.value === "primary" ? "secondary" : "primary");
          }}
        >
          Switch branch
        </button>
        <DispatchBranchView mode={mode.value} />
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function DispatchBranchRoute() {
  return (
    <main>
      <DispatchBranchFixture />
    </main>
  );
}

export { DispatchBranchRoute };
