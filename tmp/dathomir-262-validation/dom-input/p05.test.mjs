import { beforeAll, afterAll, expect, it } from "vitest";
import { harness, inputHTML } from "./browser-harness.mjs";
let h;
beforeAll(async () => {
  h = await harness("p05");
});
afterAll(async () => {
  await h.close();
});

it("adopts pre-admission Japanese edit while content automatically changes Count:7 to Count=7", async () => {
  const r = await h.observe("preboot edit and automatic refresh", inputHTML, async (page) => {
    await page.locator("#a").fill("あ");
    return page.evaluate(() => {
      const p = Proof,
        a = p.groupFixture(),
        log = [],
        original = a.controls[0].node;
      const owner = p.controlledGroup(
        a,
        p.groupRegistry((value) => value, log),
      );
      const [start, text, end] = document.getElementById("status").childNodes;
      const bind = p.contentMarker(start, end);
      bind.publish("Count = 7");
      return {
        draft: owner.model.peek(),
        value: original.value,
        defaultValue: original.defaultValue,
        propertyWrites: owner.cells[0].writes,
        sameControl: original === document.getElementById("a"),
        sameText: text === start.nextSibling,
        content: text.data,
        trace: owner.trace,
        snapshot: a.snapshot,
        log,
      };
    });
  });
  expect(r.draft).toBe("あ");
  expect(r.value).toBe("あ");
  expect(r.defaultValue).toBe("a");
  expect(r.snapshot).toBe("a");
  expect(r.propertyWrites).toBe(0);
  expect(r.sameControl && r.sameText).toBe(true);
  expect(r.content).toBe("Count = 7");
  expect(r.trace.map((item) => item.reason)).toEqual(["read", "adopt", "commit"]);
});

it("recaptures edits after preflight and after capture listener registration", async () => {
  const r = await h.observe("listener registration gap", inputHTML, (page) =>
    page.evaluate(() => {
      const p = Proof,
        a = p.groupFixture(),
        input = a.controls[0].node;
      const owner = p.controlledGroup(a, p.groupRegistry(), {
        afterPreflight() {
          input.value = "preflight-gap";
        },
        afterListeners() {
          input.value = "listener-gap";
          input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        },
      });
      return {
        model: owner.model.peek(),
        value: input.value,
        revision: owner.cells[0].revision,
        writes: owner.cells[0].writes,
        trace: owner.trace,
      };
    }),
  );
  expect(r.model).toBe("listener-gap");
  expect(r.value).toBe("listener-gap");
  expect(r.revision).toBe(1);
  expect(r.writes).toBe(0);
});

it("rechecks silent live value changes before commit even without an input event", async () => {
  const r = await h.observe("silent revision gap", inputHTML, (page) =>
    page.evaluate(() => {
      const p = Proof,
        a = p.groupFixture(),
        input = a.controls[0].node;
      const owner = p.controlledGroup(a, p.groupRegistry(), {
        beforeCommit(attempt) {
          if (attempt === 0) input.value = "silent-new";
        },
      });
      return {
        model: owner.model.peek(),
        value: input.value,
        revision: owner.cells[0].revision,
        adopted: owner.trace.filter((item) => item.reason === "adopt").map((item) => item.value),
      };
    }),
  );
  expect(r.model).toBe("silent-new");
  expect(r.value).toBe("silent-new");
  expect(r.revision).toBe(0);
  expect(r.adopted).toEqual(["a", "silent-new"]);
});

it("rejects unstable revision within bounded staging and keeps the latest native edit", async () => {
  const r = await h.observe("unstable native admission", inputHTML, (page) =>
    page.evaluate(() => {
      const p = Proof,
        a = p.groupFixture(),
        input = a.controls[0].node;
      let error, retry;
      try {
        p.controlledGroup(a, p.groupRegistry(), {
          beforeCommit(attempt) {
            input.value = `edit-${attempt}`;
          },
        });
      } catch (e) {
        error = e.message;
      }
      try {
        p.controlledGroup(a, p.groupRegistry());
      } catch (e) {
        retry = e.message;
      }
      return { error, retry, value: input.value, defaultValue: input.defaultValue };
    }),
  );
  expect(r.error).toMatch(/^UNSTABLE_NATIVE_REVISION/);
  expect(r.retry).toMatch(/^ADMISSION_TERMINAL/);
  expect(r.value).toBe("edit-2");
  expect(r.defaultValue).toBe("a");
});

it("failed required commit keeps native edit, discards provisional model and removes listeners", async () => {
  const r = await h.observe("failed admission native preservation", inputHTML, (page) =>
    page.evaluate(() => {
      const p = Proof,
        a = p.groupFixture(),
        input = a.controls[0].node,
        log = [];
      input.value = "あ";
      let error;
      try {
        p.controlledGroup(
          a,
          p.groupRegistry((value) => value, log),
          {
            beforeCommit(attempt) {
              if (attempt === 0) {
                input.value = "あい";
                input.dispatchEvent(new InputEvent("input"));
              }
            },
            failCommit: true,
          },
        );
      } catch (e) {
        error = e.message;
      }
      const calls = log.length,
        atFailure = input.value;
      input.value = "late";
      input.dispatchEvent(new InputEvent("input"));
      return {
        error,
        value: input.value,
        atFailure,
        calls,
        callsAfterLate: log.length,
        snapshot: a.snapshot,
      };
    }),
  );
  expect(r.error).toMatch(/^REQUIRED_COMMIT_FAILURE/);
  expect(r.atFailure).toBe("あい");
  expect(r.value).toBe("late");
  expect(r.callsAfterLate).toBe(r.calls);
  expect(r.snapshot).toBe("a");
});

it("native and controlled draft both preserve preboot edit; only controlled installs a keystroke sink", async () => {
  const r = await h.observe("native versus controlled", inputHTML, async (page) => {
    await page.locator("#a").fill("draft");
    await page.locator("#b").fill("draft");
    await page.evaluate(() => {
      window.nativeCase = Proof.nativeDraft(document.getElementById("a"));
      window.sinkLog = [];
      window.controlledCase = Proof.controlledGroup(
        Proof.groupFixture(["b"]),
        Proof.groupRegistry((value) => value, sinkLog),
      );
    });
    await page.locator("#a").press("End");
    await page.locator("#a").press("x");
    await page.locator("#b").press("End");
    await page.locator("#b").press("x");
    return page.evaluate(() => ({
      native: nativeCase.read(),
      baseline: nativeCase.baseline(),
      controlled: controlledCase.model.peek(),
      current: document.getElementById("b").value,
      sinkCalls: sinkLog.length,
      reasons: sinkLog.map((item) => item.reason),
    }));
  });
  expect(r.native).toBe("draftx");
  expect(r.controlled).toBe("draftx");
  expect(r.current).toBe("draftx");
  expect(r.baseline).toBe("a");
  expect(r.reasons.filter((reason) => reason === "input")).toHaveLength(1);
  expect(r.reasons[0]).toBe("adopt");
  expect(r.reasons.at(-1)).toBe("input");
});

it("holds unknown prebootstrap composition formatting until a native blur boundary", async () => {
  const r = await h.observe("unknown composition hold", inputHTML, async (page) => {
    await page.locator("#a").fill("draft");
    await page.evaluate(() => {
      window.case05 = Proof.controlledGroup(
        Proof.groupFixture(),
        Proof.groupRegistry((value) => value.toUpperCase()),
      );
    });
    const before = await page.evaluate(() => ({
      value: document.getElementById("a").value,
      model: case05.model.peek(),
      pending: case05.pending,
      writes: case05.cells[0].writes,
    }));
    await page.locator("#b").focus();
    const after = await page.evaluate(() => ({
      value: document.getElementById("a").value,
      pending: case05.pending,
      writes: case05.cells[0].writes,
    }));
    return { before, after };
  });
  expect(r.before).toEqual({
    value: "draft",
    model: "draft",
    pending: "composition-or-unknown",
    writes: 0,
  });
  expect(r.after).toEqual({ value: "DRAFT", pending: null, writes: 1 });
});

it("preserves caret and selection on equal-value refresh using actual keyboard selection", async () => {
  const r = await h.observe("same-value caret", inputHTML, async (page) => {
    await page.locator("#a").fill("abcd");
    await page.locator("#a").press("Home");
    await page.locator("#a").press("ArrowRight");
    await page.locator("#a").press("Shift+ArrowRight");
    const before = await page.evaluate(() => {
      const input = document.getElementById("a");
      return [input.selectionStart, input.selectionEnd];
    });
    const after = await page.evaluate(() => {
      const owner = Proof.controlledGroup(Proof.groupFixture(), Proof.groupRegistry());
      owner.refresh();
      owner.refresh();
      const input = document.getElementById("a");
      return {
        selection: [input.selectionStart, input.selectionEnd],
        writes: owner.cells[0].writes,
        focused: document.activeElement === input,
      };
    });
    return { before, after };
  });
  expect(r.before).toEqual([1, 2]);
  expect(r.after).toEqual({ selection: [1, 2], writes: 0, focused: true });
});

it("holds differing multi-control drafts and does not treat refresh or remote model change as resolution", async () => {
  const r = await h.observe("multi-control conflict", inputHTML, async (page) => {
    await page.locator("#a").fill("first");
    await page.locator("#b").fill("second");
    return page.evaluate(() => {
      const owner = Proof.controlledGroup(Proof.groupFixture(["a", "b"]), Proof.groupRegistry());
      owner.model.set("remote");
      owner.refresh();
      return {
        conflict: owner.conflict,
        pending: owner.pending,
        model: owner.model.peek(),
        values: owner.cells.map((cell) => cell.node.value),
        writes: owner.cells.map((cell) => cell.writes),
      };
    });
  });
  expect(r).toEqual({
    conflict: true,
    pending: "conflicting-native-drafts",
    model: "remote",
    values: ["first", "second"],
    writes: [0, 0],
  });
});

it("explicit edit resolves a group only after all unprotected declared peers match", async () => {
  const r = await h.observe("explicit group resolution", inputHTML, (page) =>
    page.evaluate(() => {
      const a = document.getElementById("a"),
        b = document.getElementById("b");
      a.value = "first";
      b.value = "second";
      const owner = Proof.controlledGroup(Proof.groupFixture(["a", "b"]), Proof.groupRegistry());
      // A known native boundary clears the peer protection, without resolving its competing draft.
      b.dispatchEvent(new FocusEvent("blur"));
      a.value = "chosen";
      a.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: false }));
      return {
        conflict: owner.conflict,
        pending: owner.pending,
        model: owner.model.peek(),
        values: [a.value, b.value],
        writes: owner.cells.map((cell) => cell.writes),
      };
    }),
  );
  expect(r.conflict).toBe(false);
  expect(r.pending).toBe(null);
  expect(r.model).toBe("chosen");
  expect(r.values).toEqual(["chosen", "chosen"]);
  expect(r.writes).toEqual([0, 1]);
});

it("synthetic composition holds formatter writes and releases at synthetic compositionend", async () => {
  const r = await h.observe("synthetic composition state only", inputHTML, (page) =>
    page.evaluate(() => {
      const input = document.getElementById("a");
      input.value = "draft";
      const owner = Proof.controlledGroup(
        Proof.groupFixture(),
        Proof.groupRegistry((value) => `[${value}]`),
      );
      const trust = [];
      input.addEventListener("compositionstart", (e) => trust.push(e.isTrusted));
      input.dispatchEvent(new CompositionEvent("compositionstart", { data: "" }));
      input.value = "あ";
      input.dispatchEvent(
        new InputEvent("input", {
          isComposing: true,
          data: "あ",
          inputType: "insertCompositionText",
        }),
      );
      const during = {
        value: input.value,
        model: owner.model.peek(),
        pending: owner.pending,
        writes: owner.cells[0].writes,
      };
      input.dispatchEvent(new CompositionEvent("compositionend", { data: "あ" }));
      return {
        during,
        after: { value: input.value, pending: owner.pending, writes: owner.cells[0].writes },
        trust,
        nativeIME: false,
      };
    }),
  );
  expect(r.during).toEqual({
    value: "あ",
    model: "あ",
    pending: "composition-or-unknown",
    writes: 0,
  });
  expect(r.after).toEqual({ value: "[あ]", pending: null, writes: 1 });
  expect(r.trust).toEqual([false]);
  expect(r.nativeIME).toBe(false);
});

it("stale publication rejects a native revision change before writing", async () => {
  const r = await h.observe("active revision guard", inputHTML, (page) =>
    page.evaluate(() => {
      const input = document.getElementById("a");
      input.value = "before";
      const owner = Proof.controlledGroup(Proof.groupFixture(), Proof.groupRegistry());
      owner.refresh(() => {
        input.value = "newer";
        input.dispatchEvent(new InputEvent("input", { isComposing: false }));
      });
      return {
        value: input.value,
        model: owner.model.peek(),
        revision: owner.cells[0].revision,
        writes: owner.cells[0].writes,
        staleRejects: owner.trace.filter((item) => item.reason === "stale-publication-rejected")
          .length,
      };
    }),
  );
  expect(r.value).toBe("newer");
  expect(r.model).toBe("newer");
  expect(r.revision).toBe(1);
  expect(r.writes).toBe(0);
  expect(r.staleRejects).toBe(1);
});

it("native reset completion reaches controlled sink; canceled reset does not", async () => {
  const r = await h.observe("controlled reset adapter", inputHTML, async (page) => {
    await page.locator("#a").fill("dirty");
    await page.evaluate(() => {
      window.resetLog = [];
      window.resetOwner = Proof.controlledGroup(
        Proof.groupFixture(),
        Proof.groupRegistry((value) => value, resetLog),
      );
    });
    await page.locator("button").click();
    await page.waitForFunction(() => resetOwner.trace.some((item) => item.reason === "reset-task"));
    const reset = await page.evaluate(() => ({
      value: document.getElementById("a").value,
      model: resetOwner.model.peek(),
      reasons: resetLog.map((item) => item.reason),
    }));
    await page.locator("#a").fill("keep");
    await page.evaluate(() =>
      document
        .getElementById("form")
        .addEventListener("reset", (event) => event.preventDefault(), { once: true }),
    );
    await page.locator("button").click();
    await page.waitForFunction(
      () => resetOwner.trace.filter((item) => item.reason === "reset-task").length === 2,
    );
    const canceled = await page.evaluate(() => ({
      value: document.getElementById("a").value,
      model: resetOwner.model.peek(),
      reasons: resetLog.map((item) => item.reason),
    }));
    return { reset, canceled };
  });
  expect(r.reset.value).toBe("a");
  expect(r.reset.model).toBe("a");
  expect(r.reset.reasons.at(-1)).toBe("reset");
  expect(r.canceled.value).toBe("keep");
  expect(r.canceled.model).toBe("keep");
  expect(r.canceled.reasons.filter((reason) => reason === "reset")).toHaveLength(1);
});

it("same association duplicate admission creates one sink listener and disposal removes it", async () => {
  const r = await h.observe("one owner and listener", inputHTML, (page) =>
    page.evaluate(() => {
      const p = Proof,
        a = p.groupFixture(),
        log = [],
        registry = p.groupRegistry((value) => value, log);
      const first = p.controlledGroup(a, registry),
        second = p.controlledGroup(a, registry),
        input = a.controls[0].node;
      input.value = "edit";
      input.dispatchEvent(new InputEvent("input"));
      const activeCalls = log.length;
      first.dispose();
      first.dispose();
      input.value = "late";
      input.dispatchEvent(new InputEvent("input"));
      return {
        sameOwner: first === second,
        activeCalls,
        afterDispose: log.length,
        model: first.model.peek(),
      };
    }),
  );
  expect(r).toEqual({ sameOwner: true, activeCalls: 2, afterDispose: 2, model: "edit" });
});

it("a newer native input after reset invalidates its delayed sink candidate", async () => {
  const r = await h.observe("reset revision gap", inputHTML, async (page) => {
    await page.evaluate(() => {
      const input = document.getElementById("a");
      input.value = "dirty";
      window.resetGapLog = [];
      window.resetGapOwner = Proof.controlledGroup(
        Proof.groupFixture(),
        Proof.groupRegistry((value) => value, resetGapLog),
      );
      document.getElementById("form").reset();
      input.value = "newer";
      input.dispatchEvent(new InputEvent("input", { isComposing: false }));
    });
    await page.waitForFunction(() =>
      resetGapOwner.trace.some((item) => item.reason === "reset-task"),
    );
    return page.evaluate(() => ({
      value: document.getElementById("a").value,
      model: resetGapOwner.model.peek(),
      reasons: resetGapLog.map((item) => item.reason),
      resetTask: resetGapOwner.trace.find((item) => item.reason === "reset-task"),
    }));
  });
  expect(r.value).toBe("newer");
  expect(r.model).toBe("newer");
  expect(r.reasons).toEqual(["adopt", "input"]);
  expect(r.resetTask.current[0]).toBeGreaterThan(r.resetTask.captured[0]);
});

it("disposal cancels owned delayed reset work", async () => {
  const r = await h.observe("reset timer disposal", inputHTML, (page) =>
    page.evaluate(async () => {
      const input = document.getElementById("a");
      input.value = "dirty";
      const log = [];
      const owner = Proof.controlledGroup(
        Proof.groupFixture(),
        Proof.groupRegistry((value) => value, log),
      );
      document.getElementById("form").reset();
      owner.dispose();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        value: input.value,
        model: owner.model.peek(),
        state: owner.state,
        reasons: log.map((item) => item.reason),
        resetTasks: owner.trace.filter((item) => item.reason === "reset-task").length,
      };
    }),
  );
  expect(r).toEqual({
    value: "a",
    model: "dirty",
    state: "disposed",
    reasons: ["adopt"],
    resetTasks: 0,
  });
});

it("rejects sink resource acquisition during provisional model-only admission", async () => {
  const r = await h.observe("model-only sink phase", inputHTML, (page) =>
    page.evaluate(() => {
      const p = Proof,
        input = document.getElementById("a");
      input.value = "draft";
      let error;
      try {
        p.controlledGroup(p.groupFixture(), {
          draftText: (ctx) => ctx.values.draft.value,
          setDraft(ctx) {
            ctx.timeout(() => {}, 1);
          },
        });
      } catch (e) {
        error = e.message;
      }
      return { error, value: input.value };
    }),
  );
  expect(r.error).toMatch(/^MODEL_ONLY_PHASE/);
  expect(r.value).toBe("draft");
});
