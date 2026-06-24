import { css, defineComponent, signal } from "@dathra/core";
import { fromMarkup } from "@dathra/runtime";

import { highlightCode } from "../syntaxHighlightRuntime";

function formatCode(code: string): string {
  const lines = code.split("\n");
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  const indent = Math.min(
    ...lines.filter((l) => l.trim().length > 0).map((l) => l.match(/^ */)![0]!.length),
  );
  return lines.map((l) => l.slice(indent)).join("\n");
}

const codeStyles = css`
  :host {
    display: block;
    margin: 16px 0;
    border-radius: 14px;
    border: 1px solid var(--panel-border);
    font-family: "Intel One Mono", "Berkeley Mono", "SFMono-Regular", monospace;
    max-width: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: color-mix(in srgb, var(--panel-bg) 82%, var(--accent));
    border-bottom: 1px solid var(--panel-border);
  }

  .lang {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .copy-btn:hover {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
  }

  .copy-btn.copied {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--panel-border));
    color: var(--accent);
  }

  .scroll-wrap {
    overflow-x: auto;
  }

  .inner {
    overflow: hidden;
    border-radius: inherit;
    background: color-mix(in srgb, var(--code-bg) 72%, var(--panel-bg));
  }

  pre {
    margin: 0;
    padding: 16px 20px;
    line-height: 1.55;
    font-family: inherit;
    font-size: 0.85rem;
    width: max-content;
    min-width: 100%;
    box-sizing: border-box;
  }

  pre.shiki {
    background: transparent !important;
  }

  pre.shiki span {
    background-color: transparent !important;
  }

  @media (prefers-color-scheme: dark) {
    pre.shiki,
    pre.shiki span {
      color: var(--shiki-dark) !important;
      background-color: transparent !important;
      font-style: var(--shiki-dark-font-style) !important;
      font-weight: var(--shiki-dark-font-weight) !important;
      text-decoration: var(--shiki-dark-text-decoration) !important;
    }
  }
`;

const DocCodeBlock = defineComponent(
  "dathra-code",
  ({ props, children }) => {
    const copied = signal(false);
    const highlighterReady = signal(false);
    const raw =
      typeof children === "string" && children.length > 0 ? children : (props.code.value ?? "");
    const source = formatCode(raw);
    const highlighted = highlightCode(source, props.language.value ?? "");
    const highlightedContent =
      highlighted !== undefined
        ? typeof document === "undefined"
          ? highlighted
          : fromMarkup(highlighted)()
        : undefined;

    if (
      highlightedContent === undefined &&
      typeof document !== "undefined" &&
      !highlighterReady.value
    ) {
      void import("../syntaxHighlight").then(async ({ prepareSyntaxHighlighting }) => {
        await prepareSyntaxHighlighting();
        highlighterReady.set(true);
      });
    }

    function handleCopy() {
      if (typeof navigator.clipboard?.writeText === "function") {
        navigator.clipboard.writeText(source).catch(() => {});
      }
      copied.set(true);
      setTimeout(() => {
        copied.set(false);
      }, 1800);
    }

    return (
      <div class="inner">
        <div class="header">
          <span class="lang">{props.language.value}</span>
          <button class={"copy-btn" + (copied.value ? " copied" : "")} onClick={handleCopy}>
            {copied.value ? "Copied!" : "Copy"}
          </button>
        </div>
        <div class="scroll-wrap">
          {highlightedContent !== undefined ? (
            highlightedContent
          ) : (
            <pre>
              <code>{source}</code>
            </pre>
          )}
        </div>
      </div>
    );
  },
  {
    props: {
      code: { type: String, default: "" },
      language: { type: String, default: "" },
    },
    styles: [codeStyles],
  },
);

export { DocCodeBlock };
