type DocsHighlighter = {
  codeToHtml: (
    source: string,
    options: {
      lang: string;
      themes: {
        light: string;
        dark: string;
      };
    },
  ) => string;
};

type DocsLanguage = "bash" | "css" | "html" | "js" | "json" | "ts" | "tsx";

const supportedLanguages = new Set<DocsLanguage>([
  "bash",
  "css",
  "html",
  "js",
  "json",
  "ts",
  "tsx",
]);
let highlighter: DocsHighlighter | undefined;

function normalizeLanguage(language: string): DocsLanguage {
  return supportedLanguages.has(language as DocsLanguage) ? (language as DocsLanguage) : "ts";
}

function setDocsHighlighter(nextHighlighter: DocsHighlighter): void {
  highlighter = nextHighlighter;
}

function highlightCode(source: string, language: string): string | undefined {
  if (highlighter === undefined) {
    return undefined;
  }

  return highlighter.codeToHtml(source, {
    lang: normalizeLanguage(language),
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  });
}

export { highlightCode, setDocsHighlighter };
