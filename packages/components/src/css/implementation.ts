/**
 * css tagged template literal - creates CSSStyleSheet for adoptedStyleSheets.
 *
 * In SSR environments (no CSSStyleSheet), returns a DathraStyleSheet
 * that carries the raw CSS text for DSD `<style>` injection.
 * @module
 */

/**
 * Marker interface for SSR-compatible style sheets.
 * Carries raw CSS text for Declarative Shadow DOM output.
 */
interface DathraStyleSheet extends CSSStyleSheet {
  /** Raw CSS text for SSR `<style>` injection. */
  __cssText: string;
}

interface GlobalStyleEntry {
  readonly cssText: string;
  readonly sheet: CSSStyleSheet;
}

const globalStyles: GlobalStyleEntry[] = [];
const globalStyleTexts = new Set<string>();
const globalStyleSheets = new Set<CSSStyleSheet>();
const trackedRoots = new Set<ShadowRoot>();

function readCssRulesText(sheet: CSSStyleSheet): string | undefined {
  try {
    const cssText = Array.from(sheet.cssRules, (rule) => rule.cssText).join(
      "\n",
    );
    (sheet as DathraStyleSheet).__cssText = cssText;
    return cssText;
  } catch {
    return undefined;
  }
}

function toStyleSheet(style: CSSStyleSheet | string): CSSStyleSheet {
  if (typeof style !== "string") {
    return style;
  }

  if (typeof CSSStyleSheet === "undefined") {
    return { __cssText: style } as unknown as CSSStyleSheet;
  }

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(style);
  (sheet as DathraStyleSheet).__cssText = style;
  return sheet;
}

function normalizeCssTextForDedupe(
  sheet: CSSStyleSheet | string,
): string | undefined {
  if (typeof sheet === "string") {
    if (typeof CSSStyleSheet === "undefined") {
      return sheet.trim();
    }

    const normalizedSheet = new CSSStyleSheet();
    normalizedSheet.replaceSync(sheet);
    return readCssRulesText(normalizedSheet) ?? sheet.trim();
  }

  return readCssRulesText(sheet) ?? getCssText(sheet)?.trim();
}

function mergeStyleSheets(
  localSheets: readonly CSSStyleSheet[] = [],
): readonly CSSStyleSheet[] {
  const merged: CSSStyleSheet[] = [];
  const seen = new Set<CSSStyleSheet>();
  const seenCssTexts = new Set<string>();

  const pushSheet = (sheet: CSSStyleSheet) => {
    const cssText = normalizeCssTextForDedupe(sheet);
    if (cssText !== undefined) {
      if (seenCssTexts.has(cssText)) return;
      seenCssTexts.add(cssText);
    }

    if (seen.has(sheet)) return;
    seen.add(sheet);
    merged.push(sheet);
  };

  for (const entry of globalStyles) {
    pushSheet(entry.sheet);
  }

  for (const sheet of localSheets) {
    pushSheet(sheet);
  }

  return merged;
}

function applyGlobalStylesToTrackedRoots(): void {
  for (const root of trackedRoots) {
    const localSheets =
      (
        root as ShadowRoot & {
          __dathraLocalSheets?: readonly CSSStyleSheet[];
        }
      ).__dathraLocalSheets ?? [];
    root.adoptedStyleSheets = [...mergeStyleSheets(localSheets)];
  }
}

/**
 * Create a CSSStyleSheet from a template literal.
 * For use with defineComponent's styles option.
 *
 * In SSR environments, returns an object with `__cssText` for DSD output.
 * @param strings - Template string parts
 * @param values - Interpolated values
 * @returns Constructed CSSStyleSheet (with __cssText property)
 */
function css(
  strings: TemplateStringsArray,
  ...values: unknown[]
): CSSStyleSheet {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += String(values[i]);
    }
  }

  // SSR environment check
  if (typeof CSSStyleSheet === "undefined") {
    // Return an object carrying the CSS text for DSD <style> output
    return { __cssText: result } as unknown as CSSStyleSheet;
  }

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(result);
  // Attach raw CSS text for DSD SSR output
  (sheet as DathraStyleSheet).__cssText = result;
  return sheet;
}

/**
 * Extract raw CSS text from a CSSStyleSheet or DathraStyleSheet.
 * Returns undefined if the sheet has no attached text.
 */
function getCssText(sheet: CSSStyleSheet | string): string | undefined {
  if (typeof sheet === "string") return sheet;

  const cssText = (sheet as DathraStyleSheet).__cssText;
  if (cssText !== undefined) {
    return cssText;
  }

  return readCssRulesText(sheet);
}

function adoptGlobalStyles(
  ...styles: readonly (CSSStyleSheet | string)[]
): void {
  for (const style of styles) {
    if (typeof style !== "string" && globalStyleSheets.has(style)) {
      continue;
    }

    const sheet = toStyleSheet(style);
    const cssText = getCssText(sheet);
    const normalizedCssText = normalizeCssTextForDedupe(sheet);

    if (typeof style !== "string") {
      globalStyleSheets.add(style);
    }

    if (cssText === undefined || normalizedCssText === undefined) {
      continue;
    }

    if (globalStyleTexts.has(normalizedCssText)) {
      continue;
    }

    globalStyleSheets.add(sheet);
    globalStyleTexts.add(normalizedCssText);
    globalStyles.push({ cssText, sheet });
  }

  applyGlobalStylesToTrackedRoots();
}

function connectGlobalStyles(
  root: ShadowRoot,
  localSheets: readonly CSSStyleSheet[] = [],
): void {
  (
    root as ShadowRoot & { __dathraLocalSheets?: readonly CSSStyleSheet[] }
  ).__dathraLocalSheets = localSheets;
  trackedRoots.add(root);
  root.adoptedStyleSheets = [...mergeStyleSheets(localSheets)];
}

function disconnectGlobalStyles(root: ShadowRoot): void {
  trackedRoots.delete(root);
}

function getGlobalStyleCssTexts(): readonly string[] {
  return globalStyles.map((entry) => entry.cssText);
}

function clearGlobalStyles(): void {
  globalStyles.length = 0;
  globalStyleSheets.clear();
  globalStyleTexts.clear();

  for (const root of trackedRoots) {
    const localSheets =
      (
        root as ShadowRoot & {
          __dathraLocalSheets?: readonly CSSStyleSheet[];
        }
      ).__dathraLocalSheets ?? [];
    root.adoptedStyleSheets = [...localSheets];
  }

  trackedRoots.clear();
}

export {
  adoptGlobalStyles,
  clearGlobalStyles,
  connectGlobalStyles,
  css,
  disconnectGlobalStyles,
  getCssText,
  getGlobalStyleCssTexts,
};
export type { DathraStyleSheet };
