import { PlaygroundShell } from "./PlaygroundShell";
import { ALSPage } from "./pages/ALSPage";
import { ComponentSSRPage } from "./pages/ComponentSSRPage";
import { StoreBoundariesPage } from "./pages/StoreBoundariesPage";
import { GlobalStylesPage } from "./pages/GlobalStylesPage";
import { IslandsDirectivePage } from "./pages/IslandsDirectivePage";
import { IslandsRuntimePage } from "./pages/IslandsRuntimePage";
import { OverviewPage } from "./pages/OverviewPage";
import type { PlaygroundRoutePath } from "./routes";

function renderPlaygroundPage(props: {
  requestId: string;
  requestStoreAppId: string;
  routePath: PlaygroundRoutePath;
  pagePayloadJson: string;
}) {
  let pageContent: JSX.Element;

  switch (props.routePath) {
    case "/als":
      pageContent = (
        <ALSPage
          requestStoreAppId={props.requestStoreAppId}
          pagePayloadJson={props.pagePayloadJson}
        />
      );
      break;

    case "/store-boundaries":
      pageContent = <StoreBoundariesPage />;
      break;

    case "/component-ssr":
      pageContent = <ComponentSSRPage />;
      break;

    case "/global-styles":
      pageContent = <GlobalStylesPage />;
      break;

    case "/islands-directive":
      pageContent = (
        <IslandsDirectivePage pagePayloadJson={props.pagePayloadJson} />
      );
      break;

    case "/islands-runtime":
      pageContent = <IslandsRuntimePage />;
      break;

    case "/":
    default:
      pageContent = <OverviewPage />;
      break;
  }

  return (
    <PlaygroundShell
      routePath={props.routePath}
      requestId={props.requestId}
      renderPage={() => pageContent}
    />
  );
}

export { renderPlaygroundPage };
export default renderPlaygroundPage;
