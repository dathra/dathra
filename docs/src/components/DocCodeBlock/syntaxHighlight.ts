import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import typescript from "shiki/langs/typescript.mjs";
import tsx from "shiki/langs/tsx.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { createHighlighterCore, type BundledLanguage, type HighlighterGeneric } from "shiki/core";

import { setDocsHighlighter } from "./syntaxHighlightRuntime";

type DocsHighlighter = HighlighterGeneric<BundledLanguage, "github-light" | "github-dark">;

let highlighter: DocsHighlighter | undefined;
let highlighterPromise: Promise<DocsHighlighter> | undefined;

async function loadDocsHighlighter(): Promise<DocsHighlighter> {
  highlighter ??= await createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [bash, css, html, javascript, json, typescript, tsx],
    themes: [githubLight, githubDark],
  });
  setDocsHighlighter(highlighter);
  return highlighter;
}

async function prepareSyntaxHighlighting(): Promise<void> {
  highlighterPromise ??= loadDocsHighlighter().catch((error: unknown) => {
    highlighterPromise = undefined;
    throw error;
  });
  await highlighterPromise;
}

export { prepareSyntaxHighlighting };
