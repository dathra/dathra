import { getCurrentStore, withStore } from "@dathra/core";

import { createDemoStore } from "./demoStore";

const probePhaseOrder = ["sync", "afterAwait", "microtask", "timeout"] as const;

type ProbePhaseName = (typeof probePhaseOrder)[number];

type AsyncStoreProbe = {
  label: string;
  expectedAppId: string;
  phases: Record<ProbePhaseName, string | undefined>;
  stable: boolean;
};

type ParallelIsolationProbe = {
  left: AsyncStoreProbe;
  right: AsyncStoreProbe;
  isolated: boolean;
};

function requireCurrentStoreForProbe(label: string) {
  const store = getCurrentStore();
  if (store === undefined) {
    throw new Error(`[playground/ssr] missing store boundary for ${label}`);
  }
  return store;
}

async function collectCurrentStoreProbe(
  label: string,
  delayMs: number,
): Promise<AsyncStoreProbe> {
  const expectedAppId = requireCurrentStoreForProbe(label).appId;
  const sync = getCurrentStore()?.appId;

  await Promise.resolve();
  const afterAwait = getCurrentStore()?.appId;

  const microtask = await new Promise<string | undefined>((resolve) => {
    queueMicrotask(() => {
      resolve(getCurrentStore()?.appId);
    });
  });

  const timeout = await new Promise<string | undefined>((resolve) => {
    setTimeout(() => {
      resolve(getCurrentStore()?.appId);
    }, delayMs);
  });

  const phases = {
    sync,
    afterAwait,
    microtask,
    timeout,
  } satisfies Record<ProbePhaseName, string | undefined>;

  return {
    label,
    expectedAppId,
    phases,
    stable: probePhaseOrder.every((phase) => phases[phase] === expectedAppId),
  };
}

async function runNamedStoreProbe(
  label: string,
  delayMs: number,
): Promise<AsyncStoreProbe> {
  const store = createDemoStore({
    appId: `als-${label}`,
    count: delayMs,
    theme: label.includes("right") ? "night" : "mint",
  });

  return withStore(store, async () => collectCurrentStoreProbe(label, delayMs));
}

async function runParallelIsolationProbe(): Promise<ParallelIsolationProbe> {
  const [left, right] = await Promise.all([
    runNamedStoreProbe("parallel-left", 80),
    runNamedStoreProbe("parallel-right", 20),
  ]);

  return {
    left,
    right,
    isolated:
      left.stable && right.stable && left.expectedAppId !== right.expectedAppId,
  };
}

export { collectCurrentStoreProbe, probePhaseOrder, runParallelIsolationProbe };
export type { AsyncStoreProbe, ParallelIsolationProbe, ProbePhaseName };
