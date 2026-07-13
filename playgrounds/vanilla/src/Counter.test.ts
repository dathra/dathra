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
  const results = await Promise.allSettled([
    browser?.close() ?? Promise.resolve(),
    previewServer?.close() ?? Promise.resolve(),
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
  count: number,
  doubled: number,
): Promise<void> {
  const values = page.locator("#app .counter p");

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

beforeAll(async () => {
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
});

afterAll(async () => {
  await closeResources();
});

it("updates the JSX counter through a production preview", async () => {
  if (browser === undefined || previewUrl === undefined) {
    throw new Error("Preview test resources are not initialized");
  }

  const page = await browser.newPage();

  try {
    const response = await page.goto(previewUrl, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    await expectCounterState(page, 0, 0);

    const counter = page.locator("#app .counter");
    await counter.getByRole("button", { name: "+", exact: true }).click();
    await expectCounterState(page, 1, 2);

    await counter.getByRole("button", { name: "-", exact: true }).click();
    await expectCounterState(page, 0, 0);
  } finally {
    await page.close();
  }
});
