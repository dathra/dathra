import { afterAll, beforeAll, expect, it } from "vitest";

import { acquireHarness, fetchHtml, releaseHarness } from "../e2eHarness";

beforeAll(async () => {
  await acquireHarness();
});

afterAll(async () => {
  await releaseHarness();
});

it("returns server-rendered home HTML", async () => {
  const { response, html } = await fetchHtml();

  expect(response.status).toBe(200);
  expect(html).toContain("Dathra E2E SSR Fixtures");
  expect(html).not.toContain("<!--ssr-outlet-->");
});
