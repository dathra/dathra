import { clientModule } from '@dathra/core/server';
import type A from '../one/widget.client.js';
const wrong = clientModule<typeof A>('../two/widget.client.js', import.meta.url);
export { wrong };
