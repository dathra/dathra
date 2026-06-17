import { createAtomStore } from "@dathra/core";

function createDocsStore(options: { appId: string }) {
  return createAtomStore({
    appId: options.appId,
    values: [],
  });
}

export { createDocsStore };
