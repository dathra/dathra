import { clearGlobalStyles } from "@dathra/components";
import { renderDSD } from "@dathra/components/ssr";
import { withStore } from "@dathra/core";

import {
  collectCurrentStoreProbe,
  runParallelIsolationProbe,
} from "./alsDiagnostics";
import { E2EAppRoot } from "./appRoot";
import { resolveRoute, type FixtureRoutePath } from "./routes";
import { createFixtureStore, fixtureStoreSnapshotSchema } from "./store";

type SSRRenderContext = {
  routePath?: string;
};

async function render(context: SSRRenderContext = {}): Promise<string> {
  clearGlobalStyles();

  const routePath = resolveRoute(context.routePath ?? "/") as FixtureRoutePath;
  const requestStore = createFixtureStore({
    appId: `playground-e2e-${routePath === "/" ? "home" : routePath.slice(1)}`,
    count: routePath === "/store-snapshot-roundtrip" ? 7 : 3,
    theme:
      routePath === "/store-snapshot-roundtrip" ? "snapshot-midnight" : "mint",
  });

  const pagePayloadJson =
    routePath === "/als"
      ? JSON.stringify(
          await withStore(requestStore, () =>
            collectCurrentStoreProbe("ssr", 5),
          ),
        )
      : "";

  try {
    return renderDSD(
      E2EAppRoot,
      {
        routePath,
        requestStoreAppId: requestStore.appId,
        pagePayloadJson,
      },
      {
        store: requestStore,
        storeSnapshotSchema:
          routePath === "/store-snapshot-roundtrip"
            ? fixtureStoreSnapshotSchema
            : undefined,
      },
    );
  } finally {
    clearGlobalStyles();
  }
}

async function renderParallelProbe(): Promise<unknown> {
  return await runParallelIsolationProbe();
}

export { render };
export default render;
export { renderParallelProbe };
