import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(resolve(process.cwd(), "playgrounds/e2e/package.json"));
const { chromium } = await import(pathToFileURL(require.resolve("playwright")).href);

const listHTML =
  '<div id="list"><!--list:start--><!--row:a:start--><input value="Alpha"><span>Alpha</span><!--row:a:end--><!--row:b:start--><input value="Beta"><span>Beta</span><!--row:b:end--><!--list:end--></div><p id="status"><!--bind:start-->Count: 7<!--bind:end--></p><aside id="foreign">Foreign</aside>';
const inputHTML =
  '<form id="form"><input id="a" name="a" value="a"><input id="b" name="b" value="a"><button type="reset">Reset</button></form><p id="status"><!--bind:start-->Count: 7<!--bind:end--></p>';

/** Launch a real browser and retain JSON observations per bounded suite. */
async function harness(name) {
  const browser = await chromium.launch({ headless: true });
  const observations = [];
  const content = readFileSync(new URL("./browser.bundle.js", import.meta.url), "utf8");
  return {
    async observe(label, html, action) {
      const page = await browser.newPage();
      try {
        await page.setContent(html);
        await page.addScriptTag({ content });
        const result = await action(page);
        observations.push({ name: label, result });
        return result;
      } finally {
        await page.close();
      }
    },
    async close() {
      writeFileSync(
        new URL(`./${name}-observations.json`, import.meta.url),
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            browser: browser.version(),
            engine: "bundled unmodified packages/reactivity/src/index.ts",
            nativeIME: false,
            observations,
          },
          null,
          2,
        ) + "\n",
      );
      await browser.close();
    },
  };
}

export { harness, listHTML, inputHTML };
