import { clientModule, defineComponent } from '@dathra/core/server';
import { signal } from '@dathra/reactivity';
import { otherParser } from '../row-input.js';
import type Client from '../row.client.js';
const Row = defineComponent({
  client: clientModule<typeof Client>('../row.client.js', import.meta.url), input: otherParser,
  server(input) { return { draft: signal(input.label), id: input.id }; },
  template(values, { bind }) { return bind('draftText', { server: values.draft.value }); },
});
export { Row };
