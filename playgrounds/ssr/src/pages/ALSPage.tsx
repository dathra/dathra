import { signal } from "@dathra/core";

import type {
  AsyncStoreProbe,
  ParallelIsolationProbe,
} from "../alsDiagnostics";
import { probePhaseOrder } from "../alsDiagnostics";

function parseServerProbe(pagePayloadJson: string): AsyncStoreProbe | null {
  if (pagePayloadJson === "") {
    return null;
  }

  try {
    return JSON.parse(pagePayloadJson) as AsyncStoreProbe;
  } catch {
    return null;
  }
}

function ProbeResultCard(props: { title: string; probe: AsyncStoreProbe }) {
  return (
    <article class="probe-result-card">
      <h3>{props.title}</h3>
      <p>
        Expected appId: <strong>{props.probe.expectedAppId}</strong>
      </p>
      <div class="probe-step-list">
        {probePhaseOrder.map((phase) => (
          <p>
            <code>{phase}</code>:{" "}
            <strong>{props.probe.phases[phase] ?? "undefined"}</strong>
          </p>
        ))}
      </div>
      <p>
        Stable across async boundaries:{" "}
        <strong>{props.probe.stable ? "yes" : "no"}</strong>
      </p>
    </article>
  );
}

function ALSPage(props: {
  requestStoreAppId: string;
  pagePayloadJson: string;
}) {
  const parallelProbe = signal<ParallelIsolationProbe | null>(null);
  const parallelProbeStatus = signal<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const parallelProbeError = signal("");
  const serverProbe = parseServerProbe(props.pagePayloadJson);

  const runParallelProbe = async () => {
    parallelProbeStatus.set("running");
    parallelProbeError.set("");

    try {
      const response = await fetch("/api/als/parallel");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ParallelIsolationProbe;
      parallelProbe.set(payload);
      parallelProbeStatus.set("done");
    } catch (error) {
      parallelProbe.set(null);
      parallelProbeStatus.set("error");
      parallelProbeError.set(
        error instanceof Error ? error.message : "Unknown fetch error",
      );
    }
  };

  return (
    <>
      <section>
        <h2>Request-scoped SSR probe</h2>
        <p>
          This page is server-rendered inside <code>withStore()</code> using a
          request-local store boundary backed by AsyncLocalStorage.
        </p>
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
          <p>No server probe payload was provided.</p>
        ) : (
          <ProbeResultCard title="SSR page render probe" probe={serverProbe} />
        )}
      </section>

      <section>
        <h2>Parallel isolation probe</h2>
        <p>
          This calls a Node.js endpoint that runs two concurrent{" "}
          <code>withStore()</code>
          branches with different delays and verifies the active store never
          leaks across requests.
        </p>
        <div class="probe-actions">
          <button data-testid="run-parallel-probe" onClick={runParallelProbe}>
            Run parallel AsyncLocalStorage probe
          </button>
          <p>
            Status:{" "}
            <strong data-testid="parallel-probe-status">
              {parallelProbeStatus.value}
            </strong>
          </p>
        </div>
        {parallelProbeError.value === "" ? (
          ""
        ) : (
          <p data-testid="parallel-probe-error">{parallelProbeError.value}</p>
        )}
        {parallelProbe.value === null ? (
          ""
        ) : (
          <div class="probe-grid" data-testid="parallel-probe-results">
            <ProbeResultCard
              title="Parallel branch A"
              probe={parallelProbe.value.left}
            />
            <ProbeResultCard
              title="Parallel branch B"
              probe={parallelProbe.value.right}
            />
            <article class="probe-result-card probe-result-summary">
              <h3>Isolation verdict</h3>
              <p>
                Concurrent isolation:{" "}
                <strong>
                  {parallelProbe.value.isolated ? "passed" : "failed"}
                </strong>
              </p>
            </article>
          </div>
        )}
      </section>
    </>
  );
}

export { ALSPage };
