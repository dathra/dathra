/**
 * Dathra Web Components client-side plugin
 * 
 * This plugin imports and registers Dathra Web Components
 * on the client side only.
 */
import "@/lib/dathra";

export default defineNuxtPlugin(() => {
  // Components are registered via side effects in the import above
});
