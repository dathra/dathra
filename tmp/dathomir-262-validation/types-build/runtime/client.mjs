/** Experimental flat client registry; no attachment or reconciliation implementation. */
function defineClient(functions, options) {
  if (!functions || typeof functions !== "object") throw new Error("E_CLIENT_RECORD");
  for (const [name, fn] of Object.entries(functions)) {
    if (typeof fn !== "function") throw new Error(`E_CLIENT_FUNCTION: ${name}`);
  }
  const result = { functions: Object.freeze({ ...functions }) };
  if (options?.create) {
    const p = options.create;
    if (
      typeof p.input !== "function" ||
      typeof p.initialize !== "function" ||
      typeof p.template !== "function"
    ) {
      throw new Error("E_CREATE_PROFILE: input/initialize/template required");
    }
    if (p.receive && typeof functions[p.receive] !== "function") throw new Error("E_RECEIVE_NAME");
    result.create = Object.freeze({ ...p });
  }
  return Object.freeze(result);
}
/** Return a description without DOM or listener effects. */
function el(tag, attributes, ...children) {
  return { kind: "element", tag, attributes, children };
}
/** Record a lazy intent; this experiment does not initialize or reconcile children. */
function createComponent(client, options) {
  if (!client?.create) throw new Error("E_NO_CREATE_PROFILE");
  return { kind: "created", client, ...options };
}
export { defineClient, el, createComponent };
