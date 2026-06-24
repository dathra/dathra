import { bindStoreToHost, clearGlobalStyles } from "@dathra/components";
import { hydrate } from "@dathra/core/hydration";
import { createDocsStore } from "./store";

clearGlobalStyles();

const rootHost = document.querySelector("dathra-docs");
if (rootHost instanceof HTMLElement) {
  bindStoreToHost(rootHost, createDocsStore({ appId: "dathra-docs-client" }));
}

void import("./DocsAppRoot").then(() => {
  queueMicrotask(() => {
    hydrate(document);
  });
});
