import { clientModule } from '@dathra/core/server';
import type A from '../one/widget.client.js';
const forward = clientModule;
const ref = forward<typeof A>('../one/widget.client.js', import.meta.url);
export { ref };
