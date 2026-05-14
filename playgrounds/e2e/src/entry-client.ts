import { clearGlobalStyles } from "@dathra/components";
import { hydrateIslands } from "@dathra/runtime/hydration";

clearGlobalStyles();

void import("./appRoot").then(() => {
  queueMicrotask(() => {
    hydrateIslands(document);
  });
});
