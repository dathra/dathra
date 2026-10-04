import { clientModule } from '@dathra/core/server';
const ref = clientModule('./no-default.client.js', import.meta.url);
export { ref };
