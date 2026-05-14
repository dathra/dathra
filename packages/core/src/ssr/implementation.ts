import { renderDSD } from "@dathra/components/ssr";

type SsrEntryContext = {
  request: Request;
  requestId: string;
  url: string;
};

type SsrEntryResult =
  | string
  | Response
  | {
      html: string;
      statusCode?: number;
      headers?: HeadersInit;
    };

type SsrEntryHandler = (
  context: SsrEntryContext,
) => SsrEntryResult | Promise<SsrEntryResult>;

/**
 * Render a Dathra component to Declarative Shadow DOM HTML for SSR.
 */
function render(
  ...args: Parameters<typeof renderDSD>
): ReturnType<typeof renderDSD> {
  return renderDSD(...args);
}

/**
 * Define a typed SSR entry handler for Dathra SSR adapters.
 */
function defineSsrEntry<const Handler extends SsrEntryHandler>(
  handler: Handler,
): Handler {
  return handler;
}

export { defineSsrEntry, render };
export type { SsrEntryContext, SsrEntryHandler, SsrEntryResult };
