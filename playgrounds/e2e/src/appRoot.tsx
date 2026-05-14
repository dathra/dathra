import { defineComponent } from "@dathra/components";
import { bindStoreToHost } from "@dathra/components/internal";

import { App } from "./App";
import type { FixtureRoutePath } from "./routes";
import { createFixtureStore } from "./store";

const E2EAppRoot = defineComponent(
  "e2e-ssr-app",
  ({ props }) => {
    return (
      <App
        routePath={props.routePath.value as FixtureRoutePath}
        requestStoreAppId={props.requestStoreAppId.value}
        pagePayloadJson={props.pagePayloadJson.value}
      />
    );
  },
  {
    hydrate: ({ host }) => {
      const appId =
        host.getAttribute("requeststoreappid") ?? "playground-e2e-root";
      bindStoreToHost(
        host,
        createFixtureStore({
          appId,
        }),
      );
    },
    props: {
      routePath: { type: String, default: "/" },
      requestStoreAppId: { type: String, default: "playground-e2e-root" },
      pagePayloadJson: { type: String, default: "" },
    },
  },
);

export { E2EAppRoot };
