const playgroundRoutes = [
  {
    path: "/",
    label: "Overview",
    title: "SSR Playground Overview",
    description:
      "Browse focused Dathra SSR demos by feature instead of stacking every experiment onto one page.",
  },
  {
    path: "/als",
    label: "AsyncLocalStorage",
    title: "AsyncLocalStorage Request Isolation",
    description:
      "Shows request-scoped store propagation across async boundaries and isolation across concurrent SSR work.",
  },
  {
    path: "/store-boundaries",
    label: "Store Boundaries",
    title: "withStore Boundary Behavior",
    description:
      "Shows how sibling subtrees can share a store or split into isolated store boundaries.",
  },
  {
    path: "/component-ssr",
    label: "Component SSR",
    title: "Component SSR and DSD Output",
    description:
      "Shows defineComponent SSR, shared store usage inside a custom element, and raw DSD markup output.",
  },
  {
    path: "/global-styles",
    label: "Global Styles",
    title: "Shadow DOM Global CSS Injection",
    description:
      "Shows how adoptGlobalStyles() can share typography and surface styles across multiple Shadow DOM components.",
  },
  {
    path: "/islands-directive",
    label: "Islands Directive",
    title: "client:* Directive Contract",
    description:
      "Shows how transformer-level client:* directives normalize into reserved island metadata before runtime strategy execution exists.",
  },
  {
    path: "/islands-runtime",
    label: "Islands Runtime",
    title: "Hydration Strategy Engine",
    description:
      "Shows core `hydrate()` scheduling plus colocated `load:onClick`, `interaction:onClick`, `idle:onClick`, and `visible:onClick` demos.",
  },
  {
    path: "/hydration-plan",
    label: "Hydration Plan",
    title: "Hydration Plan Generation & Compile Guard",
    description:
      "Demonstrates planFactory (Path A) vs fallback rerender (Path B), nested islands, and the unsupported+colocated compile-time guard.",
  },
] as const;

type PlaygroundRoute = (typeof playgroundRoutes)[number];
type PlaygroundRoutePath = PlaygroundRoute["path"];

const playgroundRouteByPath = {
  "/": playgroundRoutes[0],
  "/als": playgroundRoutes[1],
  "/store-boundaries": playgroundRoutes[2],
  "/component-ssr": playgroundRoutes[3],
  "/global-styles": playgroundRoutes[4],
  "/islands-directive": playgroundRoutes[5],
  "/islands-runtime": playgroundRoutes[6],
  "/hydration-plan": playgroundRoutes[7],
} satisfies Record<PlaygroundRoutePath, PlaygroundRoute>;

function normalizePlaygroundPath(pathname: string): string {
  if (pathname === "/index.html") {
    return "/";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function getPlaygroundRoute(pathname: string): PlaygroundRoute | undefined {
  const normalized = normalizePlaygroundPath(pathname);

  return playgroundRoutes.find((route) => route.path === normalized);
}

function getPlaygroundRouteByPath(
  pathname: PlaygroundRoutePath,
): PlaygroundRoute {
  return playgroundRouteByPath[pathname];
}

export {
  getPlaygroundRoute,
  getPlaygroundRouteByPath,
  normalizePlaygroundPath,
  playgroundRoutes,
};
export type { PlaygroundRoute, PlaygroundRoutePath };
