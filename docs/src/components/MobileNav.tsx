import { css, defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";
import { docRoutes, type DocRoutePath } from "../routes";

const mobileStyles = css`
  :host {
    display: none;
  }

  @media (max-width: 720px) {
    :host {
      display: block;
    }
  }

  .backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 140;
    background: rgba(0, 0, 0, 0.3);
  }

  .backdrop.is-open {
    display: block;
  }

  .sidebar {
    position: fixed;
    bottom: 16px;
    left: 16px;
    right: 16px;
    width: auto;
    top: auto;
    height: auto;
    max-height: calc(70vh - 32px);
    z-index: 150;
    background: var(--page-bg);
    border: 1px solid var(--panel-border);
    padding: 24px 20px;
    overflow-y: auto;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    transform: translateY(calc(100% + 16px));
    transition: transform 250ms ease;
  }

  .sidebar.is-open {
    transform: translateY(0);
    padding-bottom: 68px;
  }

  .sidebar h2 {
    font-size: 1.1rem;
    margin: 0 0 4px;
    padding: 0 12px;
    letter-spacing: -0.02em;
  }

  .sidebar .version {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 0 0 20px;
    padding: 0 12px;
  }

  .sidebar nav {
    display: grid;
    gap: 2px;
  }

  .sidebar .nav-section {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    padding: 16px 12px 4px;
  }

  .sidebar a {
    display: block;
    padding: 6px 12px;
    border-radius: 8px;
    color: var(--text);
    text-decoration: none;
    font-size: 0.92rem;
    transition: background 120ms ease;
  }

  .sidebar a:hover {
    background: rgba(33, 71, 60, 0.08);
  }

  .sidebar a.is-active {
    background: rgba(33, 71, 60, 0.12);
    font-weight: 600;
  }

  .menu-btn {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--panel-border);
    border-radius: 50%;
    background: var(--page-bg);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.82rem;
    color: var(--text);
    transition: background 120ms ease;
    padding: 0;
  }

  .menu-btn:hover {
    background: rgba(33, 71, 60, 0.06);
  }

  .menu-icon {
    display: inline-block;
    width: 18px;
    height: 14px;
    position: relative;
  }

  .menu-icon,
  .menu-icon::before,
  .menu-icon::after {
    display: block;
    width: 18px;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
    transition: all 200ms ease;
  }

  .menu-icon::before,
  .menu-icon::after {
    content: "";
    position: absolute;
    left: 0;
  }

  .menu-icon::before {
    top: -5px;
  }
  .menu-icon::after {
    top: 5px;
  }

  .menu-btn.is-open .menu-icon {
    background: transparent;
  }

  .menu-btn.is-open .menu-icon::before {
    top: 0;
    transform: rotate(45deg);
  }

  .menu-btn.is-open .menu-icon::after {
    top: 0;
    transform: rotate(-45deg);
  }
`;

const MobileNav = defineComponent(
  "dathra-mobile-nav",
  ({ props }) => {
    const menuOpen = signal(false);
    const toggle = () => {
      menuOpen.set(!menuOpen.value);
    };
    const close = () => {
      menuOpen.set(false);
    };
    const routePath = props.routePath.value as DocRoutePath;
    const sections = [...new Set(docRoutes.map((r) => r.section))];
    const onLinkClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a") !== null) close();
    };

    return (
      <>
        <button
          class={"menu-btn" + (menuOpen.value ? " is-open" : "")}
          onClick={toggle}
          aria-label="Toggle navigation menu"
        >
          <span class="menu-icon" />
        </button>
        <div class={"backdrop" + (menuOpen.value ? " is-open" : "")} onClick={close} />
        <aside class={"sidebar" + (menuOpen.value ? " is-open" : "")} onClick={onLinkClick}>
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
      </>
    );
  },
  {
    props: {
      routePath: { type: String, default: "/" },
    },
    styles: [mobileStyles],
  },
);

export { MobileNav };
