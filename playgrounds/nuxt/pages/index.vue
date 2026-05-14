<template>
  <div class="container">
    <h1>Dathra × Nuxt 4 (SSR)</h1>

    <hr />

    <h2>Greeting Component</h2>
    <my-greeting name="Nuxt" v-html="greetingHtml" />

    <hr />

    <h2>Counter Component</h2>
    <my-counter initial="5" v-html="counterHtml" />
  </div>
</template>

<script setup lang="ts">
import { renderDSDContent } from "@dathra/components/ssr";
import { MyGreeting } from "@/lib/dathra/MyGreeting";
import { MyCounter } from "@/lib/dathra/MyCounter";

// SSR: compute DSD content
const greetingHtml = useState<string>("dathra-greeting", () =>
  import.meta.server
    ? renderDSDContent(MyGreeting, { name: "Nuxt" })
    : "",
);
const counterHtml = useState<string>("dathra-counter", () =>
  import.meta.server
    ? renderDSDContent(MyCounter, { initial: "5" })
    : "",
);
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
}

h1 {
  color: #00dc82;
}

hr {
  margin: 30px 0;
  border: none;
  border-top: 1px solid #ddd;
}
</style>
