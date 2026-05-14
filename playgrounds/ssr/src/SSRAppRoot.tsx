import { defineComponent } from "@dathra/components";

import { getCurrentStore, withStore } from "@dathra/core";
import { fromMarkup } from "@dathra/runtime";
import { createDemoStore } from "./demoStore";
import { PlaygroundShell } from "./PlaygroundShell";
import { ALSPage } from "./pages/ALSPage";
import { ComponentSSRPage } from "./pages/ComponentSSRPage";
import { GlobalStylesPage } from "./pages/GlobalStylesPage";
import { HydrationPlanPage } from "./pages/HydrationPlanPage";
import { IslandsDirectivePage } from "./pages/IslandsDirectivePage";
import { IslandsRuntimePage } from "./pages/IslandsRuntimePage";
import { OverviewPage } from "./pages/OverviewPage";
import { StoreBoundariesPage } from "./pages/StoreBoundariesPage";
import type { PlaygroundRoutePath } from "./routes";

type PlaygroundPageRenderProps = {
  requestStoreAppId: string;
  pagePayloadJson: string;
};

function renderALSPlaygroundPage(
  props: PlaygroundPageRenderProps,
): JSX.Element {
  return (
    <ALSPage
      requestStoreAppId={props.requestStoreAppId}
      pagePayloadJson={props.pagePayloadJson}
    />
  );
}

function renderStoreBoundariesPlaygroundPage(): JSX.Element {
  return <StoreBoundariesPage />;
}

function renderComponentSSRPlaygroundPage(): JSX.Element {
  return <ComponentSSRPage />;
}

function renderGlobalStylesPlaygroundPage(): JSX.Element {
  return <GlobalStylesPage />;
}

function renderIslandsDirectivePlaygroundPage(
  props: PlaygroundPageRenderProps,
): JSX.Element {
  return <IslandsDirectivePage pagePayloadJson={props.pagePayloadJson} />;
}

function renderHydrationPlanPlaygroundPage(): JSX.Element {
  return <HydrationPlanPage />;
}

function renderIslandsRuntimePlaygroundPage(): JSX.Element {
  return <IslandsRuntimePage />;
}

function renderOverviewPlaygroundPage(): JSX.Element {
  return <OverviewPage />;
}

const playgroundPageRenderers = {
  "/als": renderALSPlaygroundPage,
  "/store-boundaries": renderStoreBoundariesPlaygroundPage,
  "/component-ssr": renderComponentSSRPlaygroundPage,
  "/global-styles": renderGlobalStylesPlaygroundPage,
  "/islands-directive": renderIslandsDirectivePlaygroundPage,
  "/islands-runtime": renderIslandsRuntimePlaygroundPage,
  "/hydration-plan": renderHydrationPlanPlaygroundPage,
  "/": renderOverviewPlaygroundPage,
} satisfies Record<
  PlaygroundRoutePath,
  (props: PlaygroundPageRenderProps) => JSX.Element
>;

function renderResolvedPlaygroundPage(
  routePath: PlaygroundRoutePath,
  props: PlaygroundPageRenderProps,
): JSX.Element {
  return playgroundPageRenderers[routePath](props);
}

function renderPlaygroundPageShell(props: {
  requestId: string;
  requestStoreAppId: string;
  routePath: PlaygroundRoutePath;
  pagePayloadJson: string;
}) {
  const pageContent = renderResolvedPlaygroundPage(props.routePath, {
    requestStoreAppId: props.requestStoreAppId,
    pagePayloadJson: props.pagePayloadJson,
  });

  return (
    <PlaygroundShell
      routePath={props.routePath}
      requestId={props.requestId}
      renderPage={() => pageContent}
    />
  );
}

function replaceShadowRootContent(
  shadowRoot: ShadowRoot,
  content: string | Node,
): void {
  shadowRoot.innerHTML = "";

  if (typeof content === "string") {
    shadowRoot.append(fromMarkup(content)());
    return;
  }

  shadowRoot.append(content);
}

export const SSRAppRoot = defineComponent(
  "playground-ssr-app",
  ({ props }) => {
    const inheritedStore = getCurrentStore();
    const store =
      inheritedStore ??
      createDemoStore({
        appId: props.requestStoreAppId.value,
        count: 3,
        theme: "light",
      });
    const routePath = props.routePath.value as PlaygroundRoutePath;
    const pageContent = renderResolvedPlaygroundPage(routePath, {
      requestStoreAppId: props.requestStoreAppId.value,
      pagePayloadJson: props.pagePayloadJson.value,
    });

    return withStore(store, () => (
      <PlaygroundShell
        routePath={routePath}
        requestId={props.requestId.value}
        renderPage={() => pageContent}
      />
    ));
  },
  {
    hydrate: ({ host, props, store }) => {
      const routePath = props.routePath.value as PlaygroundRoutePath;
      if (routePath === "/islands-runtime") {
        return;
      }

      const shadowRoot = host.shadowRoot;
      if (shadowRoot === null) {
        return;
      }

      replaceShadowRootContent(
        shadowRoot,
        withStore(store, () =>
          renderPlaygroundPageShell({
            requestId: props.requestId.value,
            requestStoreAppId: props.requestStoreAppId.value,
            routePath,
            pagePayloadJson: props.pagePayloadJson.value,
          }),
        ) as string | Node,
      );
    },
    props: {
      requestId: { type: String, default: "client-hydration" },
      requestStoreAppId: {
        type: String,
        default: "playground-ssr-root",
      },
      routePath: { type: String, default: "/" },
      pagePayloadJson: { type: String, default: "" },
    },
  },
);
