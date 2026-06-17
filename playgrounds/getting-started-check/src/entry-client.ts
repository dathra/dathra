import { hydrate } from "@dathra/core/hydration";

void import("./AppRoot").then(() => {
  queueMicrotask(() => {
    hydrate(document);
  });
});
