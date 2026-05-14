import { bindStoreToHost, clearGlobalStyles } from "@dathra/components";
import { hydrate } from "@dathra/core/hydration";

import { createDemoStore } from "./demoStore";

function bindPlaygroundRootStore(): void {
  const rootHost = document.querySelector("playground-ssr-app");
  if (!(rootHost instanceof HTMLElement)) {
    return;
  }

  const appId =
    rootHost.getAttribute("requeststoreappid") ?? "playground-ssr-root";
  bindStoreToHost(
    rootHost,
    createDemoStore({
      appId,
    }),
  );
}

clearGlobalStyles();
bindPlaygroundRootStore();

void import("./SSRAppRoot").then(() => {
  queueMicrotask(() => {
    hydrate(document);
  });
});
