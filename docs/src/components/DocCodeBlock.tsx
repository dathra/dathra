import { css, defineComponent, signal } from "@dathra/core";

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
    border: 1px solid rgba(28, 58, 47, 0.12);
    font-family: "Intel One Mono", "Berkeley Mono", "SFMono-Regular", monospace;
    max-width: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: rgba(17, 36, 29, 0.98);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .lang {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(180, 220, 200, 0.7);
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: transparent;
    color: rgba(180, 220, 200, 0.6);
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .copy-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(180, 220, 200, 0.9);
  }

  .copy-btn.copied {
    border-color: rgba(75, 195, 160, 0.4);
    color: #4bc3a0;
  }

  .scroll-wrap {
    overflow-x: auto;
  }

  .inner {
    overflow: hidden;
    border-radius: inherit;
    background: rgba(17, 36, 29, 0.94);
  }

  pre {
    margin: 0;
    padding: 16px 20px;
    color: #dcece3;
    line-height: 1.55;
    font-family: inherit;
    font-size: 0.85rem;
    width: max-content;
    min-width: 100%;
    box-sizing: border-box;
  }
`;

const DocCodeBlock = defineComponent(
  "dathra-code",
  ({ props, children }) => {
    const copied = signal(false);
    const raw =
      typeof children === "string" && children.length > 0 ? children : (props.code.value ?? "");
    const source = formatCode(raw);

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
          <pre>
            <code>{source}</code>
          </pre>
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
