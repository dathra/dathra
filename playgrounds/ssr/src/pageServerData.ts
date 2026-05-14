import { withStore } from "@dathra/core";

import { collectCurrentStoreProbe } from "./alsDiagnostics";
import { createDemoStore } from "./demoStore";
import type { PlaygroundRoutePath } from "./routes";

type IslandsDirectivePreview = {
  title: string;
  mode: "csr" | "ssr";
  source: string;
  output?: string;
  error?: string;
};

function createIslandsDirectivePayload(): string {
  const previews: IslandsDirectivePreview[] = [
    {
      title: "client:visible becomes reserved metadata",
      mode: "csr",
      source: "const island = <Counter client:visible initialCount={5} />;",
      output:
        'const island = Counter({ initialCount: 5, "data-dh-island": "visible" });',
    },
    {
      title: "bare client:interaction defaults to click",
      mode: "csr",
      source: "const island = <Counter client:interaction />;",
      output:
        'const island = Counter({ "data-dh-island": "interaction", "data-dh-island-value": "click" });',
    },
    {
      title: "valued client:interaction survives in SSR mode",
      mode: "ssr",
      source: 'const island = <Counter client:interaction="mouseenter" />;',
      output:
        'const island = Counter({ "data-dh-island": "interaction", "data-dh-island-value": "mouseenter" });',
    },
    {
      title: "invalid client:media fails fast",
      mode: "csr",
      source: "const broken = <Counter client:media />;",
      error: "[dathra] client:media requires a string literal media query",
    },
  ];

  return JSON.stringify(previews);
}

async function createPagePayload(context: {
  routePath: PlaygroundRoutePath;
  requestId: string;
  requestStore: ReturnType<typeof createDemoStore>;
}): Promise<string> {
  switch (context.routePath) {
    case "/als": {
      const serverProbe = await withStore(context.requestStore, async () =>
        collectCurrentStoreProbe(`page:${context.requestId}`, 12),
      );

      return JSON.stringify(serverProbe);
    }

    case "/islands-directive": {
      return createIslandsDirectivePayload();
    }

    default:
      return "";
  }
}

export { createPagePayload };
