import { bindStoreToHost, clearGlobalStyles } from "@dathra/components";
import { hydrate } from "@dathra/core/hydration";
import { createDocsStore } from "./store";

clearGlobalStyles();

const rootHost = document.querySelector("dathra-docs");
if (rootHost instanceof HTMLElement) {
  bindStoreToHost(rootHost, createDocsStore({ appId: "dathra-docs-client" }));
}

const syntaxHighlightingReady = import("./components/DocCodeBlock/syntaxHighlight")
  .then(({ prepareSyntaxHighlighting }) => prepareSyntaxHighlighting())
  .catch((error) => {
    console.warn("[docs:client] Syntax highlighting unavailable", error);
  });

void Promise.all([syntaxHighlightingReady, import("./DocsAppRoot")]).then(() => {
  queueMicrotask(() => {
    hydrate(document);
  });
});
