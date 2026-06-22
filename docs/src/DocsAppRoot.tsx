import { defineComponent } from "@dathra/components";
import { getCurrentStore, withStore } from "@dathra/core";
import { fromMarkup } from "@dathra/runtime";

import { createDocsStore } from "./store";
import baseStyles from "./style.css?raw";
import { DocsShell } from "./DocsShell";
import { OverviewPage } from "./pages/OverviewPage";
import { GettingStartedPage } from "./pages/GettingStartedPage";
import { GettingStartedCsrPage } from "./pages/GettingStartedCsrPage";
import { GettingStartedSsrPage } from "./pages/GettingStartedSsrPage";
import { ReactivityPage } from "./pages/ReactivityPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { RuntimePage } from "./pages/RuntimePage";
import { StorePage } from "./pages/StorePage";
import { SsrPage } from "./pages/SsrPage";
import { TransformerPage } from "./pages/TransformerPage";
import { PluginPage } from "./pages/PluginPage";
import { ReferencePage } from "./pages/ReferencePage";
import type { DocRoutePath } from "./routes";

type DocPageProps = {
  requestStoreAppId: string;
};

const docPageRenderers = {
  "/": () => <OverviewPage />,
  "/getting-started": () => <GettingStartedPage />,
  "/getting-started-csr": () => <GettingStartedCsrPage />,
  "/getting-started-ssr": () => <GettingStartedSsrPage />,
  "/reactivity": () => <ReactivityPage />,
  "/components": () => <ComponentsPage />,
  "/runtime": () => <RuntimePage />,
  "/store": () => <StorePage />,
  "/ssr": () => <SsrPage />,
  "/transformer": () => <TransformerPage />,
  "/plugin": () => <PluginPage />,
  "/reference/reactivity": () => <ReferencePage referenceId="reactivity" />,
  "/reference/components": () => <ReferencePage referenceId="components" />,
  "/reference/components/ssr": () => <ReferencePage referenceId="components-ssr" />,
  "/reference/components/internal": () => <ReferencePage referenceId="components-internal" />,
  "/reference/runtime": () => <ReferencePage referenceId="runtime" />,
  "/reference/runtime/ssr": () => <ReferencePage referenceId="runtime-ssr" />,
  "/reference/runtime/hydration": () => <ReferencePage referenceId="runtime-hydration" />,
  "/reference/store": () => <ReferencePage referenceId="store" />,
  "/reference/store/internal": () => <ReferencePage referenceId="store-internal" />,
  "/reference/plugin": () => <ReferencePage referenceId="plugin" />,
  "/reference/transformer": () => <ReferencePage referenceId="transformer" />,
  "/reference/core/ssr": () => <ReferencePage referenceId="core-ssr" />,
  "/reference/core/hydration": () => <ReferencePage referenceId="core-hydration" />,
} satisfies Record<string, (_props: DocPageProps) => JSX.Element>;

function replaceShadowRootContent(shadowRoot: ShadowRoot, content: string | Node): void {
  shadowRoot.innerHTML = "";
  if (typeof content === "string") {
    shadowRoot.append(fromMarkup(content)());
    return;
  }
  shadowRoot.append(content);
}

export const DocsAppRoot = defineComponent(
  "dathra-docs",
  ({ props }) => {
    const inheritedStore = getCurrentStore();
    const store =
      inheritedStore ??
      createDocsStore({
        appId: "dathra-docs",
      });
    const routePath = props.routePath.value as DocRoutePath;
    const renderPage = docPageRenderers[routePath];
    const pageContent =
      renderPage !== undefined ? (
        renderPage({ requestStoreAppId: props.requestStoreAppId.value })
      ) : (
        <OverviewPage />
      );

    return withStore(store, () => (
      <DocsShell routePath={routePath} renderPage={() => pageContent} />
    ));
  },
  {
    hydrate: ({ host, props, store }) => {
      const routePath = props.routePath.value as DocRoutePath;
      const shadowRoot = host.shadowRoot;
      if (shadowRoot === null) return;

      const renderPage = docPageRenderers[routePath];
      const pageContent =
        renderPage !== undefined ? (
          renderPage({ requestStoreAppId: props.requestStoreAppId.value })
        ) : (
          <OverviewPage />
        );

      replaceShadowRootContent(
        shadowRoot,
        withStore(store, () => (
          <DocsShell routePath={routePath} renderPage={() => pageContent} />
        )) as string | Node,
      );
    },
    props: {
      routePath: { type: String, default: "/" },
      requestStoreAppId: { type: String, default: "dathra-docs-root" },
    },
    styles: [baseStyles],
  },
);
