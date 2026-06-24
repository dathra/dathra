import { MobileNav } from "./components/MobileNav";
import { docRoutes } from "./routes";
import type { DocRoutePath } from "./routes";

function DocsShell({
  routePath,
  renderPage,
}: {
  routePath: DocRoutePath;
  renderPage: () => JSX.Element;
}) {
  const sections = [...new Set(docRoutes.map((r) => r.section))];
  const currentRoute = docRoutes.find((route) => route.path === routePath);
  const currentSectionRoute = docRoutes.find((route) => route.section === currentRoute?.section);

  return (
    <>
      <aside class="sidebar-desktop">
        <h2>Dathra</h2>
        <p class="version">v0.0.21</p>
        <nav>
          {sections.map((section) => (
            <>
              <div class="nav-section">{section}</div>
              {docRoutes
                .filter((r) => r.section === section)
                .map((route) => (
                  <a class={route.path === routePath ? "is-active" : undefined} href={route.path}>
                    {route.label}
                  </a>
                ))}
            </>
          ))}
        </nav>
      </aside>
      <main class="content">
        {currentRoute !== undefined ? (
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="/">Docs</a>
            <span aria-hidden="true">/</span>
            <a href={currentSectionRoute?.path ?? "/"}>{currentRoute.section}</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{currentRoute.label}</span>
          </nav>
        ) : (
          <></>
        )}
        {renderPage()}
      </main>
      <MobileNav routePath={routePath} />
    </>
  );
}

export { DocsShell };
