import { beforeAll, afterAll, expect, it } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
const require = createRequire(resolve(process.cwd(), "playgrounds/e2e/package.json"));
const { chromium } = await import(pathToFileURL(require.resolve("playwright")).href);
let browser;
const observations = [];
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  writeFileSync(
    new URL("./observations.json", import.meta.url),
    JSON.stringify({ browser: browser.version(), observations }, null, 2) + "\n",
  );
  await browser.close();
});
async function observe(name, action) {
  const page = await browser.newPage();
  try {
    await page.route("https://history.example.test/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<input value="initial"><main>initial</main>',
      }),
    );
    await page.goto("https://history.example.test/a");
    const result = await action(page);
    observations.push({ name, result });
    return result;
  } finally {
    await page.close();
  }
}
it("does not undo application DOM changes on same-document Back", async () => {
  const result = await observe("same-document-back", (page) =>
    page.evaluate(async () => {
      history.replaceState({ route: "a", draft: "A" }, "", "/a");
      history.pushState({ route: "b", draft: "B" }, "", "/b");
      document.querySelector("main").textContent = "B content";
      document.querySelector("input").value = "B unfinished draft";
      const popped = new Promise((resolve) =>
        addEventListener("popstate", (event) => resolve(event.state), { once: true }),
      );
      history.back();
      const state = await popped;
      return {
        state,
        path: location.pathname,
        content: document.querySelector("main").textContent,
        draft: document.querySelector("input").value,
      };
    }),
  );
  expect(result).toEqual({
    state: { route: "a", draft: "A" },
    path: "/a",
    content: "B content",
    draft: "B unfinished draft",
  });
});
it("snapshots a checkpoint rather than retaining its mutable object", async () => {
  const result = await observe("checkpoint-clone", (page) =>
    page.evaluate(() => {
      const checkpoint = { draft: { text: "saved" }, revision: 1 };
      history.replaceState(checkpoint, "", "/a");
      checkpoint.draft.text = "later";
      checkpoint.revision = 2;
      return {
        state: history.state,
        sameRoot: history.state === checkpoint,
        sameDraft: history.state.draft === checkpoint.draft,
      };
    }),
  );
  expect(result).toEqual({
    state: { draft: { text: "saved" }, revision: 1 },
    sameRoot: false,
    sameDraft: false,
  });
});
it("rejects executable handles without replacing the prior history entry", async () => {
  const result = await observe("non-cloneable-state", (page) =>
    page.evaluate(() => {
      history.replaceState({ draft: "safe" }, "", "/a");
      let failure;
      try {
        history.pushState({ value: 1, set() {} }, "", "/bad");
      } catch (error) {
        failure = error.name;
      }
      return { failure, path: location.pathname, state: history.state };
    }),
  );
  expect(result).toEqual({ failure: "DataCloneError", path: "/a", state: { draft: "safe" } });
});
