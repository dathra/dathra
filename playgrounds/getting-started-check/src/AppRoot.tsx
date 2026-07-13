import { defineComponent } from "@dathra/components";

import "./Counter";

const AppRoot = defineComponent("app-root", () => {
  return (
    <main>
      <h1>Dathra App</h1>
      <my-counter initial="5"></my-counter>
    </main>
  );
});

export { AppRoot };
