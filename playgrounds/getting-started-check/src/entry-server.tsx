import { defineSsrEntry, render } from "@dathra/core/ssr";
import { AppRoot } from "./AppRoot";

const handler = defineSsrEntry(async () => {
  return {
    html: render(AppRoot),
  };
});

export default handler;
