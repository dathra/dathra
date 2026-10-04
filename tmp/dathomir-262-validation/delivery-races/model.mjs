/** Creates a deterministic destination-switch model for design experiments. */
function createDeliveryModel(initial) {
  const targets = new Map(
    Object.entries(initial).map(([name, identity]) => [
      name,
      {
        epoch: 0,
        active: identity,
        authority: true,
        state: "active",
      },
    ]),
  );
  const identities = new Set(Object.values(initial));
  const associations = new Map();
  const events = [];

  function begin(target) {
    const slot = targets.get(target);
    if (!slot) throw new Error("Unknown declared target");
    if (slot.state !== "active") throw new Error("Target requires explicit recovery");
    const epoch = ++slot.epoch;
    return { target, epoch, current: () => slot.state === "active" && slot.epoch === epoch };
  }

  async function deliver(ticket, response, hooks = {}) {
    const slot = targets.get(ticket.target);
    const candidate = await response;
    if (!ticket.current()) return { outcome: "stale" };
    const signature = JSON.stringify([candidate.target, candidate.valid]);
    if (
      associations.has(candidate.identity) &&
      associations.get(candidate.identity) !== signature
    ) {
      return { outcome: "association-changed" };
    }
    associations.set(candidate.identity, signature);
    // Preflight is resource-free and does not consume the response identity.
    if (
      candidate.target !== ticket.target ||
      !candidate.valid ||
      hooks.preflight?.(candidate) === false
    )
      return { outcome: "preflight-rejected" };
    if (identities.has(candidate.identity)) return { outcome: "identity-rejected" };
    identities.add(candidate.identity);
    let prepared;
    try {
      prepared = (await hooks.prepare?.(candidate)) ?? { release() {} };
    } catch (error) {
      return { outcome: "prepare-failed-terminal", error };
    }
    if (!ticket.current()) {
      prepared.release();
      return { outcome: "stale-prepared" };
    }
    const oldIdentity = slot.active;
    // The experiment assumes this commit is synchronous; no rollback is claimed.
    slot.authority = false;
    slot.state = "switching";
    try {
      hooks.commit?.(candidate);
    } catch (error) {
      slot.state = "damaged";
      prepared.release();
      events.push(["damage", ticket.target]);
      return { outcome: "commit-damaged", error };
    }
    slot.active = candidate.identity;
    slot.authority = true;
    slot.state = "active";
    events.push(["commit", ticket.target, candidate.identity]);
    let cleanupError;
    try {
      hooks.disposeSource?.(oldIdentity);
    } catch (error) {
      cleanupError = error;
    }
    let historyError;
    try {
      hooks.history?.(candidate);
    } catch (error) {
      historyError = error;
    }
    return {
      outcome: historyError ? "committed-history-failed" : "committed",
      cleanupError,
      historyError,
    };
  }

  function canWrite(target, identity) {
    const slot = targets.get(target);
    return Boolean(slot?.authority && slot.state === "active" && slot.active === identity);
  }

  return { begin, deliver, canWrite, snapshot: (target) => ({ ...targets.get(target) }), events };
}

/** Provides explicit completion ordering without timers or transport assumptions. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export { createDeliveryModel, deferred };
