const docRoutes = [
  {
    path: "/",
    label: "Overview",
    title: "Dathra",
    section: "Getting Started",
  },
  {
    path: "/getting-started",
    label: "Getting Started",
    title: "Getting Started",
    section: "Getting Started",
  },
  {
    path: "/getting-started-csr",
    label: "Getting Started (CSR)",
    title: "Getting Started: CSR",
    section: "Getting Started",
  },
  {
    path: "/getting-started-ssr",
    label: "Getting Started (SSR)",
    title: "Getting Started: SSR",
    section: "Getting Started",
  },
  {
    path: "/reactivity",
    label: "Reactivity",
    title: "Reactivity — Signals",
    section: "Core Concepts",
  },
  {
    path: "/components",
    label: "Components",
    title: "Web Components API",
    section: "Core Concepts",
  },
  {
    path: "/runtime",
    label: "Runtime",
    title: "DOM Runtime & SSR",
    section: "Core Concepts",
  },
  {
    path: "/store",
    label: "Store",
    title: "Atomic State Management",
    section: "Core Concepts",
  },
  {
    path: "/ssr",
    label: "SSR & Hydration",
    title: "SSR & Hydration",
    section: "Advanced",
  },
  {
    path: "/transformer",
    label: "Transformer",
    title: "JSX Transformer",
    section: "Advanced",
  },
  {
    path: "/plugin",
    label: "Build Plugin",
    title: "Build Tool Plugin",
    section: "Advanced",
  },
  {
    path: "/reference/reactivity",
    label: "Reactivity",
    title: "Reactivity Reference",
    section: "API Reference",
  },
  {
    path: "/reference/components",
    label: "Components",
    title: "Components Reference",
    section: "API Reference",
  },
  {
    path: "/reference/components/ssr",
    label: "Components SSR",
    title: "Components SSR Reference",
    section: "API Reference",
  },
  {
    path: "/reference/components/internal",
    label: "Components Internal",
    title: "Components Internal Reference",
    section: "API Reference",
  },
  {
    path: "/reference/runtime",
    label: "Runtime",
    title: "Runtime Reference",
    section: "API Reference",
  },
  {
    path: "/reference/runtime/ssr",
    label: "Runtime SSR",
    title: "Runtime SSR Reference",
    section: "API Reference",
  },
  {
    path: "/reference/runtime/hydration",
    label: "Runtime Hydration",
    title: "Runtime Hydration Reference",
    section: "API Reference",
  },
  {
    path: "/reference/store",
    label: "Store",
    title: "Store Reference",
    section: "API Reference",
  },
  {
    path: "/reference/store/internal",
    label: "Store Internal",
    title: "Store Internal Reference",
    section: "API Reference",
  },
  {
    path: "/reference/plugin",
    label: "Plugin",
    title: "Plugin Reference",
    section: "API Reference",
  },
  {
    path: "/reference/transformer",
    label: "Transformer",
    title: "Transformer Reference",
    section: "API Reference",
  },
  {
    path: "/reference/core/ssr",
    label: "Core SSR",
    title: "Core SSR Reference",
    section: "API Reference",
  },
  {
    path: "/reference/core/hydration",
    label: "Core Hydration",
    title: "Core Hydration Reference",
    section: "API Reference",
  },
] as const;

type DocRoute = (typeof docRoutes)[number];
type DocRoutePath = DocRoute["path"];

function getDocRoute(pathname: string): DocRoute | undefined {
  return docRoutes.find((route) => route.path === pathname);
}

function getDocRouteByPath(pathname: DocRoutePath): DocRoute {
  const route = docRoutes.find((r) => r.path === pathname);
  if (route === undefined) {
    throw new Error(`Route not found: ${pathname}`);
  }
  return route;
}

const docRouteByPath = Object.fromEntries(docRoutes.map((route) => [route.path, route])) as Record<
  DocRoutePath,
  DocRoute
>;

function normalizeDocPath(pathname: string): string {
  if (pathname === "/index.html") return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export { docRouteByPath, docRoutes, getDocRoute, getDocRouteByPath, normalizeDocPath };
export type { DocRoute, DocRoutePath };
