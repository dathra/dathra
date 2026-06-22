import {
  componentsInternalReference,
  componentsReference,
  componentsSsrReference,
} from "./components";
import { coreHydrationReference, coreSsrReference } from "./core";
import { pluginReference } from "./plugin";
import { reactivityReference } from "./reactivity";
import { runtimeHydrationReference, runtimeReference, runtimeSsrReference } from "./runtime";
import { storeInternalReference, storeReference } from "./store";
import { transformerReference } from "./transformer";
import type { ReferenceDocument, ReferenceId } from "../types";

const referenceDocuments = {
  "components-internal": componentsInternalReference,
  "components-ssr": componentsSsrReference,
  components: componentsReference,
  "core-hydration": coreHydrationReference,
  "core-ssr": coreSsrReference,
  plugin: pluginReference,
  reactivity: reactivityReference,
  "runtime-hydration": runtimeHydrationReference,
  "runtime-ssr": runtimeSsrReference,
  runtime: runtimeReference,
  "store-internal": storeInternalReference,
  store: storeReference,
  transformer: transformerReference,
} satisfies Record<ReferenceId, ReferenceDocument>;

export { referenceDocuments };
