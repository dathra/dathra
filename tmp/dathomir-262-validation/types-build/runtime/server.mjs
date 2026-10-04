/** Metadata only; never imports the referenced browser module. */
function clientModule(specifier, baseURL) {
  return Object.freeze({ specifier, baseURL, key: new URL(specifier, baseURL).href });
}
/** Limited experimental snapshot; alias isolation and admission are out of scope. */
function snapshot(value) {
  if (!value || typeof value !== "object") return value;
  if (value.__type__ === "signal" && typeof value.peek === "function") {
    const saved = snapshot(value.peek());
    return Object.freeze({ value: saved, peek: () => saved });
  }
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, snapshot(v)])));
}
/** Execute the initial server template only on the server. */
function defineComponent(spec) {
  return async (input, request, options) => {
    const values = snapshot(await spec.server(spec.input ? spec.input(input) : input, request));
    const tools = {
      bind(name, settings) {
        return { kind: "bind", name, ...settings };
      },
      on(event, name, settings) {
        return { kind: "on", event, name, ...settings };
      },
      id(local) {
        return local;
      },
    };
    return {
      kind: "component",
      client: spec.client,
      body: await spec.template(values, tools, request),
      options,
    };
  };
}
/** Create a pure server description. */
function el(tag, attributes, ...children) {
  return { kind: "element", tag, attributes, children };
}
/** Keep the existing render request form in this experiment. */
function defineRoute(spec) {
  return spec;
}
function escape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}
/** Render only the small fixture grammar and record explicit activated associations. */
function renderExperiment(content, catalog) {
  const activation = new Map();
  function render(node, owner) {
    if (node === null || node === undefined || typeof node === "boolean") return "";
    if (Array.isArray(node)) return node.map((v) => render(v, owner)).join("");
    if (typeof node === "string" || typeof node === "number") return escape(node);
    if (node.kind === "component") return render(node.body, node.client);
    if (node.kind === "bind" || node.kind === "on") {
      validateMarker(node, owner);
      return node.kind === "bind"
        ? `<!--bind:${escape(node.name)}-->${render(node.server, owner)}<!--/bind-->`
        : "";
    }
    if (node.kind === "element") {
      const attrs = new Map();
      const booleanAttributes = new Set([
        "checked",
        "disabled",
        "multiple",
        "required",
        "readonly",
        "selected",
      ]);
      function initial(value) {
        if (value?.kind === "bind") {
          validateMarker(value, owner);
          return value.server;
        }
        return value;
      }
      function attribute(name, value) {
        value = initial(value);
        if (
          value === null ||
          value === undefined ||
          (booleanAttributes.has(name) && value === false)
        )
          return;
        if (booleanAttributes.has(name) && value === true) attrs.set(name, ` ${name}`);
        else attrs.set(name, ` ${name}="${escape(value)}"`);
      }
      for (const [name, value] of Object.entries(node.attributes)) {
        if (name === "on") {
          for (const event of value) render(event, owner);
        } else if (!name.startsWith("_") && name !== "props") attribute(name, value);
      }
      const props = node.attributes.props || {};
      for (const [name, value] of Object.entries(props)) {
        if (name === "defaultChecked" && "checked" in props) continue;
        if (name === "defaultChecked" || name === "checked") attribute("checked", value);
        else if (name === "defaultValue" || name === "value") attribute("value", value);
        else throw new Error(`E_EXPERIMENT_PROPERTY_SERIALIZER: ${name}`);
      }
      return `<${node.tag}${[...attrs.values()].join("")}>${render(node.children, owner)}</${node.tag}>`;
    }
    throw new Error(`E_DESCRIPTION_KIND: ${node.kind}`);
  }
  function validateMarker(node, owner) {
    if (!owner) throw new Error("E_NO_ASSOCIATION");
    const entry = catalog[owner.key];
    if (!entry) throw new Error(`E_MODULE_LOOKUP: ${owner.key}`);
    if (!entry.names.includes(node.name))
      throw new Error(`E_FUNCTION_NAME: ${node.name}; available ${entry.names.join(",")}`);
    activation.set(owner.key, entry);
  }
  const html = render(content, undefined);
  const entries = [...activation.values()];
  const modules = entries.map((entry) => entry.publicURL || entry.file);
  return {
    html,
    modules,
    bootstrap: modules.length
      ? '<script type="module" src="/proof/non-root/assets/bootstrap.mjs"></script>'
      : "",
    payload: modules.length
      ? { associations: entries.map((entry) => entry.id || "fixture-only-opaque") }
      : null,
  };
}
export { clientModule, defineComponent, el, defineRoute, renderExperiment };
