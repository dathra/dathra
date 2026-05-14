import { defineComponent } from "@dathra/components";

import type {
  AsyncStoreProbe,
  ParallelIsolationProbe,
} from "../alsDiagnostics";
import { probePhaseOrder } from "../alsDiagnostics";
import { pageStyles } from "../routeStyles";

function parseServerProbe(payloadJson: string): AsyncStoreProbe | null {
  if (payloadJson === "") {
    return null;
  }

  try {
    return JSON.parse(payloadJson) as AsyncStoreProbe;
  } catch {
    return null;
  }
}

function ProbeResultCard(props: { title: string; probe: AsyncStoreProbe }) {
  return (
    <article>
      <h3>{props.title}</h3>
      <p>
        Expected appId: <strong>{props.probe.expectedAppId}</strong>
      </p>
      <p>
        <code>{probePhaseOrder[0]}</code>:{" "}
        <strong>{props.probe.phases[probePhaseOrder[0]] ?? "undefined"}</strong>
      </p>
      <p>
        <code>{probePhaseOrder[1]}</code>:{" "}
        <strong>{props.probe.phases[probePhaseOrder[1]] ?? "undefined"}</strong>
      </p>
      <p>
        <code>{probePhaseOrder[2]}</code>:{" "}
        <strong>{props.probe.phases[probePhaseOrder[2]] ?? "undefined"}</strong>
      </p>
      <p>
        <code>{probePhaseOrder[3]}</code>:{" "}
        <strong>{props.probe.phases[probePhaseOrder[3]] ?? "undefined"}</strong>
      </p>
      <p>
        Stable across async boundaries:{" "}
        <strong>{props.probe.stable ? "yes" : "no"}</strong>
      </p>
    </article>
  );
}

const ALSProbeIsland = defineComponent(
  "e2e-als-probe-island",
  () => {
    const runParallelProbe = async (event: Event) => {
      const root = (event.currentTarget as HTMLElement | null)?.getRootNode();
      if (!(root instanceof ShadowRoot)) {
        return;
      }

      const statusNode = root.querySelector<HTMLElement>(
        '[data-testid="parallel-probe-status"]',
      );
      const errorNode = root.querySelector<HTMLElement>(
        '[data-testid="parallel-probe-error"]',
      );
      const resultNode = root.querySelector<HTMLElement>(
        '[data-testid="parallel-probe-results"]',
      );

      if (statusNode === null || errorNode === null || resultNode === null) {
        return;
      }

      statusNode.textContent = "running";
      errorNode.textContent = "";
      resultNode.textContent = "";

      try {
        const response = await fetch("/api/als/parallel");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as ParallelIsolationProbe;
        statusNode.textContent = "done";
        resultNode.textContent = `Concurrent isolation:${payload.isolated ? "passed" : "failed"}`;
      } catch (error) {
        statusNode.textContent = "error";
        errorNode.textContent =
          error instanceof Error ? error.message : "unknown";
      }
    };

    return (
      <section>
        <button data-testid="run-parallel-probe" onClick={runParallelProbe}>
          Run parallel probe
        </button>
        <p>
          Status: <strong data-testid="parallel-probe-status">idle</strong>
        </p>
        <p data-testid="parallel-probe-error"></p>
        <p data-testid="parallel-probe-results"></p>
      </section>
    );
  },
  {
    styles: [pageStyles],
  },
);

function ALSRoute(props: {
  requestStoreAppId: string;
  pagePayloadJson: string;
}) {
  const serverProbe = parseServerProbe(props.pagePayloadJson);

  return (
    <main>
      <section>
        <h2>ALS SSR fixture</h2>
        <p>
          Request store appId: <strong>{props.requestStoreAppId}</strong>
        </p>
        <p>
          SSR async propagation:{" "}
          <strong data-testid="server-probe-status">
            {serverProbe?.stable ? "stable" : "missing"}
          </strong>
        </p>
        {serverProbe === null ? (
          ""
        ) : (
          <ProbeResultCard title="SSR page render probe" probe={serverProbe} />
        )}
      </section>
      <ALSProbeIsland client:load />
    </main>
  );
}

export { ALSRoute };
