import { describe, expect, it } from "vitest";
import { createDeliveryModel, deferred } from "./model.mjs";

const candidate = (identity, target = "results", valid = true) => ({ identity, target, valid });

describe("destination generation proposal", () => {
  it("reproduces the independent-channel-only stale delivery counterexample", async () => {
    const old = deferred();
    const recent = deferred();
    const channels = { search: 1, history: 1 };
    let displayed = "initial";
    const first = old.promise.then((value) => {
      if (channels.search === 1) displayed = value;
    });
    const second = recent.promise.then((value) => {
      if (channels.history === 1) displayed = value;
    });
    recent.resolve("new");
    await second;
    old.resolve("old");
    await first;
    expect(displayed).toBe("old");
  });

  it("suppresses old results even when the newer intent belongs to another channel", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const old = deferred();
    const first = model.deliver(model.begin("results"), old.promise);
    const second = await model.deliver(model.begin("results"), Promise.resolve(candidate("new")));
    old.resolve(candidate("old"));
    expect(await first).toEqual({ outcome: "stale" });
    expect(second.outcome).toBe("committed");
    expect(model.snapshot("results").active).toBe("new");
  });

  it("does not resurrect an older intent when the new destination fails preflight", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const old = deferred();
    const first = model.deliver(model.begin("results"), old.promise);
    expect(
      (
        await model.deliver(
          model.begin("results"),
          Promise.resolve(candidate("bad", "results", false)),
        )
      ).outcome,
    ).toBe("preflight-rejected");
    old.resolve(candidate("old"));
    expect((await first).outcome).toBe("stale");
    expect(model.canWrite("results", "initial")).toBe(true);
  });

  it("isolates different targets", async () => {
    const model = createDeliveryModel({ results: "initial", panel: "panel-initial" });
    const results = model.begin("results");
    await model.deliver(model.begin("panel"), Promise.resolve(candidate("panel-new", "panel")));
    expect((await model.deliver(results, Promise.resolve(candidate("new")))).outcome).toBe(
      "committed",
    );
  });

  it("keeps source alive through destination preparation and releases superseded preparation", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const prep = deferred();
    const entered = deferred();
    let releases = 0;
    const pending = model.deliver(model.begin("results"), Promise.resolve(candidate("pending")), {
      prepare() {
        entered.resolve();
        return prep.promise;
      },
    });
    await entered.promise;
    expect(model.canWrite("results", "initial")).toBe(true);
    model.begin("results");
    prep.resolve({
      release() {
        releases++;
      },
    });
    expect((await pending).outcome).toBe("stale-prepared");
    expect(releases).toBe(1);
    expect(model.canWrite("results", "initial")).toBe(true);
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(candidate("pending")))).outcome,
    ).toBe("identity-rejected");
  });

  it("rejects wrong target without consuming an identity", async () => {
    const model = createDeliveryModel({ results: "initial" });
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(candidate("wrong", "panel"))))
        .outcome,
    ).toBe("preflight-rejected");
    expect(model.canWrite("results", "initial")).toBe(true);
  });

  it("allows the same immutable preflight response after external prerequisites recover", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const response = Object.freeze(candidate("retry"));
    let prerequisite = false;
    const hooks = { preflight: () => prerequisite };
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(response), hooks)).outcome,
    ).toBe("preflight-rejected");
    prerequisite = true;
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(response), hooks)).outcome,
    ).toBe("committed");
  });

  it("rejects a repaired association under the same identity after preflight refusal", async () => {
    const model = createDeliveryModel({ results: "initial" });
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(candidate("bad", "panel"))))
        .outcome,
    ).toBe("preflight-rejected");
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(candidate("bad", "results"))))
        .outcome,
    ).toBe("association-changed");
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(candidate("fresh", "results"))))
        .outcome,
    ).toBe("committed");
  });

  it("preserves source after transport rejection and does not revive older intent", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const old = deferred();
    const pending = model.deliver(model.begin("results"), old.promise);
    await expect(
      model.deliver(model.begin("results"), Promise.reject(new Error("network failed"))),
    ).rejects.toThrow("network failed");
    old.resolve(candidate("old"));
    expect((await pending).outcome).toBe("stale");
    expect(model.canWrite("results", "initial")).toBe(true);
  });

  it("rejects same-target reentrant switching while host commit is synchronous", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const result = await model.deliver(model.begin("results"), Promise.resolve(candidate("new")), {
      commit() {
        expect(() => model.begin("results")).toThrow("explicit recovery");
      },
    });
    expect(result.outcome).toBe("committed");
  });

  it("revokes source write authority before synchronous source cleanup", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const observed = [];
    await model.deliver(model.begin("results"), Promise.resolve(candidate("new")), {
      commit() {
        observed.push(model.canWrite("results", "initial"));
      },
      disposeSource(identity) {
        observed.push(model.canWrite("results", identity));
      },
    });
    expect(observed).toEqual([false, false]);
    expect(model.canWrite("results", "new")).toBe(true);
  });

  it("fences irreversible commit failure without claiming rollback", async () => {
    const model = createDeliveryModel({ results: "initial" });
    let externalDisplay = "initial";
    const result = await model.deliver(model.begin("results"), Promise.resolve(candidate("new")), {
      commit() {
        externalDisplay = "partial-new";
        throw new Error("host failure");
      },
    });
    expect(result.outcome).toBe("commit-damaged");
    expect(externalDisplay).toBe("partial-new");
    expect(model.canWrite("results", "initial")).toBe(false);
    expect(() => model.begin("results")).toThrow("explicit recovery");
  });

  it("reports history failure separately from a committed destination", async () => {
    const model = createDeliveryModel({ results: "initial" });
    const result = await model.deliver(model.begin("results"), Promise.resolve(candidate("new")), {
      history() {
        throw new Error("history rejected");
      },
    });
    expect(result.outcome).toBe("committed-history-failed");
    expect(model.canWrite("results", "new")).toBe(true);
  });

  it("does not revive disposed response identity on Back", async () => {
    const model = createDeliveryModel({ results: "initial" });
    await model.deliver(model.begin("results"), Promise.resolve(candidate("new")));
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(candidate("initial")))).outcome,
    ).toBe("identity-rejected");
    expect(
      (await model.deliver(model.begin("results"), Promise.resolve(candidate("fresh-back"))))
        .outcome,
    ).toBe("committed");
  });

  it("keeps cleanup failure distinct from destination and history commit", async () => {
    const model = createDeliveryModel({ results: "initial" });
    let historyCalls = 0;
    const result = await model.deliver(model.begin("results"), Promise.resolve(candidate("new")), {
      disposeSource() {
        throw new Error("cleanup failed");
      },
      history() {
        historyCalls++;
      },
    });
    expect(result.outcome).toBe("committed");
    expect(result.cleanupError.message).toBe("cleanup failed");
    expect(historyCalls).toBe(1);
    expect(model.canWrite("results", "new")).toBe(true);
  });
});

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, i) => i !== index)).map((rest) => [value, ...rest]),
  );
}

describe("bounded exhaustive response orders", () => {
  for (const order of permutations([0, 1, 2, 3])) {
    it(`selects latest intent for each target under completion order ${order.join(",")}`, async () => {
      const model = createDeliveryModel({ results: "initial", panel: "panel-initial" });
      const targetNames = ["results", "panel", "results", "panel"];
      const replies = targetNames.map(() => deferred());
      const pending = replies.map((reply, index) =>
        model.deliver(model.begin(targetNames[index]), reply.promise),
      );
      for (const index of order) {
        replies[index].resolve(candidate(`response-${index}`, targetNames[index]));
        await pending[index];
      }
      expect(model.snapshot("results").active).toBe("response-2");
      expect(model.snapshot("panel").active).toBe("response-3");
      expect(model.events.filter((event) => event[0] === "commit")).toHaveLength(2);
    });
  }
});
