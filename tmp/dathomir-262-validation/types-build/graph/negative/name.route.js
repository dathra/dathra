import { clientModule, defineComponent, defineRoute } from '@dathra/core/server';
const Broken = defineComponent({
  client: clientModule('../one/widget.client.js', import.meta.url),
  server() { return {}; },
  template(values, { bind }) { return bind('misspelled', { server: 'existing SSR' }); },
});
const route = defineRoute({ render(request) { return Broken(undefined, request); } });
export { route };
