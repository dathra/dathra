/** Assimilate one trusted author result without nominal realm checks. */
function pendingResult(value: unknown): Promise<unknown> | undefined {
  if ((typeof value !== "object" || value === null) && typeof value !== "function")
    return undefined;
  const then: unknown = Reflect.get(value, "then");
  if (typeof then !== "function") return undefined;
  // Read once; defer invocation as Promise resolution does, and contain thrown calls.
  return new Promise((resolve, reject) => {
    Promise.resolve()
      .then(() => Reflect.apply(then, value, [resolve, reject]))
      .catch(reject);
  });
}

export { pendingResult };
