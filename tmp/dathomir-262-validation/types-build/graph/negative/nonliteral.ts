import { clientModule } from '@dathra/core/server';
const path = '../one/widget.client.js';
const ref = clientModule(path, import.meta.url);
export { ref };
