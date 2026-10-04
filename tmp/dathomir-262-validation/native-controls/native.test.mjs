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
    JSON.stringify(
      { timestamp: new Date().toISOString(), browser: browser.version(), observations },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
});

async function observe(name, html, action) {
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    const result = await action(page);
    observations.push({ name, result });
    return result;
  } finally {
    await page.close();
  }
}

it("requires submitter to include the chosen button in FormData", async () => {
  const result = await observe(
    "submitter",
    '<form><input name="title" value="draft"><button name="command" value="publish">Publish</button></form>',
    (page) =>
      page.evaluate(() => {
        const form = document.querySelector("form");
        const submitter = document.querySelector("button");
        return { without: [...new FormData(form)], with: [...new FormData(form, submitter)] };
      }),
  );
  expect(result.without).toEqual([["title", "draft"]]);
  expect(result.with).toEqual([
    ["title", "draft"],
    ["command", "publish"],
  ]);
});

it("preserves native validation and the actual SubmitEvent submitter", async () => {
  const result = await observe(
    "validation",
    '<form><input required name="title"><button id="save" name="command" value="save">Save</button><button id="preview" name="command" value="preview" formnovalidate>Preview</button></form>',
    (page) =>
      page.evaluate(() => {
        const form = document.querySelector("form");
        const input = document.querySelector("input");
        const submissions = [];
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          submissions.push({
            id: event.submitter.id,
            values: [...new FormData(form, event.submitter)],
          });
        });
        form.requestSubmit(document.querySelector("#save"));
        const invalidCount = submissions.length;
        form.requestSubmit(document.querySelector("#preview"));
        input.value = "Ready";
        form.requestSubmit(document.querySelector("#save"));
        return { invalidCount, submissions };
      }),
  );
  expect(result.invalidCount).toBe(0);
  expect(result.submissions.map((item) => item.id)).toEqual(["preview", "save"]);
  expect(result.submissions[1].values).toEqual([
    ["title", "Ready"],
    ["command", "save"],
  ]);
});

it("observes cross-region radio mutation through native group membership", async () => {
  const result = await observe(
    "radio-cross-region",
    '<form><section data-owner="a"><input id="a" type="radio" name="shipping" value="normal" checked></section><section data-owner="b"><input id="b" type="radio" name="shipping" value="express"></section></form>',
    async (page) => {
      await page.locator("#b").click();
      return page.evaluate(() => ({
        a: document.querySelector("#a").checked,
        b: document.querySelector("#b").checked,
        data: [...new FormData(document.querySelector("form"))],
      }));
    },
  );
  expect(result).toEqual({ a: false, b: true, data: [["shipping", "express"]] });
});

it("uses form ownership rather than visual containment for radio grouping", async () => {
  const result = await observe(
    "radio-form-owner",
    '<form id="one"><input id="a" type="radio" name="choice" checked></form><form id="two"><input id="b" type="radio" name="choice" checked></form><input id="outside" form="one" type="radio" name="choice">',
    async (page) => {
      await page.locator("#outside").click();
      return page.evaluate(() =>
        ["a", "b", "outside"].map((id) => document.getElementById(id).checked),
      );
    },
  );
  expect(result).toEqual([false, true, true]);
});

it("keeps dirty value while changing reset baseline", async () => {
  const result = await observe("default-value", '<form><input value="server"></form>', (page) =>
    page.evaluate(() => {
      const input = document.querySelector("input");
      input.value = "native draft";
      input.defaultValue = "new baseline";
      const before = { value: input.value, defaultValue: input.defaultValue };
      document.querySelector("form").reset();
      return { before, after: input.value };
    }),
  );
  expect(result).toEqual({
    before: { value: "native draft", defaultValue: "new baseline" },
    after: "new baseline",
  });
});

it("reads reset defaults only after an uncanceled native reset", async () => {
  const result = await observe("reset-order", '<form><input value="server"></form>', (page) =>
    page.evaluate(async () => {
      const form = document.querySelector("form");
      const input = document.querySelector("input");
      input.value = "draft";
      const trace = [];
      form.addEventListener("reset", () => {
        trace.push(["event", input.value]);
        queueMicrotask(() => trace.push(["microtask", input.value]));
      });
      form.reset();
      trace.push(["after-call", input.value]);
      await Promise.resolve();
      input.value = "keep";
      form.addEventListener("reset", (event) => event.preventDefault(), { once: true });
      form.reset();
      await Promise.resolve();
      return { trace, afterCanceled: input.value };
    }),
  );
  expect(result.trace.slice(0, 3)).toEqual([
    ["event", "draft"],
    ["after-call", "server"],
    ["microtask", "server"],
  ]);
  expect(result.afterCanceled).toBe("keep");
});

it("retains repeated selection entries and omits disabled/unchecked controls", async () => {
  const result = await observe(
    "successful-controls",
    '<form><select name="tags" multiple><option value="a" selected>A</option><option value="b" selected>B</option></select><input name="disabled" value="x" disabled><input name="unchecked" type="checkbox"><input name="checked" type="checkbox" checked value="yes"></form>',
    (page) =>
      page.evaluate(() => {
        const form = document.querySelector("form");
        const select = document.querySelector("select");
        const entries = [...new FormData(form)];
        select.selectedValues = ["b"];
        return {
          entries,
          lossyRecord: Object.fromEntries(entries),
          selectedAfterFakeProperty: [...select.selectedOptions].map((item) => item.value),
        };
      }),
  );
  expect(result.entries).toEqual([
    ["tags", "a"],
    ["tags", "b"],
    ["checked", "yes"],
  ]);
  expect(result.lossyRecord.tags).toBe("b");
  expect(result.selectedAfterFakeProperty).toEqual(["a", "b"]);
});

it("keeps File in FormData while JSON loses its payload and file.value rejects restoration", async () => {
  const result = await observe(
    "file-boundary",
    '<form><input type="file" name="attachment"></form>',
    async (page) => {
      await page.locator("input").setInputFiles({
        name: "draft.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("draft content"),
      });
      return page.evaluate(async () => {
        const input = document.querySelector("input");
        const data = new FormData(document.querySelector("form"));
        const file = data.get("attachment");
        let restoreError;
        try {
          input.value = "/tmp/draft.txt";
        } catch (error) {
          restoreError = error.name;
        }
        return {
          name: file.name,
          content: await file.text(),
          json: JSON.stringify(file),
          restoreError,
          size: input.files.length,
        };
      });
    },
  );
  expect(result).toEqual({
    name: "draft.txt",
    content: "draft content",
    json: "{}",
    restoreError: "InvalidStateError",
    size: 1,
  });
});

it("does not expose an incomplete numeric draft through value alone", async () => {
  const result = await observe("number-incomplete", '<input type="number">', async (page) => {
    await page.locator("input").click();
    await page.keyboard.type("-");
    return page.evaluate(() => {
      const input = document.querySelector("input");
      return {
        value: input.value,
        badInput: input.validity.badInput,
        numberIsNaN: Number.isNaN(input.valueAsNumber),
      };
    });
  });
  expect(result).toEqual({ value: "", badInput: true, numberIsNaN: true });
});
