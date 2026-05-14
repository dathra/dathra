import { describe, expect, it, vi } from "vitest";

import { renderDSD } from "@dathra/components/ssr";
import { defineSsrEntry, render } from "./implementation";

vi.mock("@dathra/components/ssr", () => ({
  renderDSD: vi.fn(() => "<my-app></my-app>"),
}));

describe("core ssr", () => {
  it("passes arguments through to renderDSD", () => {
    const options = { store: undefined };

    render("my-app", { title: "Hello" }, options);

    expect(renderDSD).toHaveBeenCalledWith(
      "my-app",
      { title: "Hello" },
      options,
    );
  });

  it("returns the renderDSD result", () => {
    expect(render("my-app")).toBe("<my-app></my-app>");
  });

  it("returns the SSR entry handler unchanged", () => {
    const handler = () => ({ html: "<main>ok</main>", statusCode: 200 });

    expect(defineSsrEntry(handler)).toBe(handler);
  });

  it("accepts SSR entry handlers that return Response", () => {
    const entry = defineSsrEntry(({ request }) => {
      return new Response(new URL(request.url).pathname, { status: 404 });
    });

    const result = entry({
      request: new Request("http://localhost/missing"),
      requestId: "req-1",
      url: "/missing",
    });

    expect(result).toBeInstanceOf(Response);
  });
});
