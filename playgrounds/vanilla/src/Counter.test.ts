import { fileURLToPath } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { preview, type PreviewServer } from "vite";
import { afterAll, beforeAll, expect, it } from "vitest";

const playgroundRoot = fileURLToPath(new URL("..", import.meta.url));
const viteConfigPath = fileURLToPath(
  new URL("../vite.config.ts", import.meta.url),
);

let browser: Browser | undefined;
let previewServer: PreviewServer | undefined;
let previewUrl: string | undefined;

async function closeResources(): Promise<void> {
  const currentBrowser = browser;
  const currentPreviewServer = previewServer;

  browser = undefined;
  previewServer = undefined;

  const results = await Promise.allSettled([
    currentBrowser?.close() ?? Promise.resolve(),
    currentPreviewServer?.close() ?? Promise.resolve(),
  ]);
  const errors = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );

  if (errors.length > 0) {
    throw new AggregateError(errors, "Failed to close preview test resources");
  }
}

async function expectCounterState(
  page: Page,
  rootSelector: string,
  count: number,
  doubled: number,
): Promise<void> {
  const values = page.locator(`${rootSelector} .counter p`);

  await expect
    .poll(async () => {
      const [countText, doubledText] = await Promise.all([
        values.nth(0).textContent(),
        values.nth(1).textContent(),
      ]);

      return {
        count: countText?.replaceAll(/\s/g, ""),
        doubled: doubledText?.replaceAll(/\s/g, ""),
      };
    })
    .toEqual({
      count: `Count:${count}`,
      doubled: `Doubled:${doubled}`,
    });
}

function formatPageErrors(pageErrors: string[]): string {
  return `Browser page errors:\n${pageErrors.length === 0 ? "(none captured)" : pageErrors.join("\n")}`;
}

beforeAll(async () => {
  try {
    previewServer = await preview({
      root: playgroundRoot,
      configFile: viteConfigPath,
      preview: {
        host: "127.0.0.1",
        port: 0,
        strictPort: true,
      },
    });

    const address = previewServer.httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("Failed to resolve the Vite preview port");
    }

    previewUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    try {
      await closeResources();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Failed to initialize and clean up preview test resources",
      );
    }

    throw error;
  }
});

afterAll(async () => {
  await closeResources();
});

it("updates count and doubled values through production preview interactions", async () => {
  if (browser === undefined || previewUrl === undefined) {
    throw new Error("Preview test resources are not initialized");
  }

  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  try {
    const response = await page.goto(previewUrl, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    await expectCounterState(page, "#app", 0, 0);

    const counter = page.locator("#app .counter");
    await counter.getByRole("button", { name: "+", exact: true }).click();
    await expectCounterState(page, "#app", 1, 2);

    await counter.getByRole("button", { name: "-", exact: true }).click();
    await expectCounterState(page, "#app", 0, 0);

    const runtimeCounter = page.locator("#runtime-app .counter");
    await expectCounterState(page, "#runtime-app", 0, 0);
    await runtimeCounter
      .getByRole("button", { name: "+", exact: true })
      .click();
    await expectCounterState(page, "#runtime-app", 1, 2);
    await expect.poll(() => runtimeCounter.locator("li").count()).toBe(3);
    await runtimeCounter.getByRole("button", { name: "Add Item" }).click();
    await expect.poll(() => runtimeCounter.locator("li").count()).toBe(4);
    await expect
      .poll(async () =>
        (await runtimeCounter.locator("li").last().textContent())?.trim(),
      )
      .toBe("Item 4");

    const toggle = page.locator("#fc-example-app .toggle");
    await expect.poll(() => toggle.locator(".toggle-content").count()).toBe(1);
    await toggle.getByRole("button", { name: /Close/ }).click();
    await expect.poll(() => toggle.locator(".toggle-content").count()).toBe(0);
    await toggle.getByRole("button", { name: /Open/ }).click();
    await expect.poll(() => toggle.locator(".toggle-content").count()).toBe(1);

    const webComponentCounter = page.locator("dathra-counter").first();
    await expect
      .poll(() =>
        webComponentCounter.evaluate((element) => element.shadowRoot !== null),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        (await webComponentCounter.locator(".count").textContent())?.trim(),
      )
      .toBe("0");
    await webComponentCounter
      .getByRole("button", { name: "+", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await webComponentCounter.locator(".count").textContent())?.trim(),
      )
      .toBe("1");
    expect(pageErrors, formatPageErrors(pageErrors)).toEqual([]);
  } catch (error) {
    throw new AggregateError(
      [error],
      `Vanilla production interaction failed.\n${formatPageErrors(pageErrors)}`,
    );
  } finally {
    await page.close();
  }
});
